"""Knowledge store: ingest a stock's public sources -> chunk -> embed -> search with citations.

CLI:  python -m app.rag ingest TCS
      python -m app.rag ask TCS "what's the debt?"
      python -m app.rag analyze TCS [fresh]  (analyst council + final briefing; cached per day unless "fresh")
"""
import hashlib
import json
import re
import sys
import threading
import xml.etree.ElementTree as ET
from datetime import datetime
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import quote_plus

import fitz  # pymupdf
import numpy as np
import requests

DATA = Path(__file__).resolve().parent.parent / "data"
UA = {"User-Agent": "Mozilla/5.0", "Referer": "https://www.bseindia.com/"}
CHUNK = 1200  # chars; ~300 tokens


# ---------- fetching (cached on disk: annual reports are ~20 MB and slow) ----------

def fetch(url: str, ext: str) -> Path:
    path = DATA / "raw" / (hashlib.sha1(url.encode()).hexdigest()[:16] + ext)
    if path.exists():
        return path
    part = path.with_suffix(ext + ".part")
    part.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(6):  # BSE drops big downloads midway; resume with a Range request
        have = part.stat().st_size if part.exists() else 0
        try:
            with requests.get(url, headers={**UA, "Range": f"bytes={have}-"} if have else UA, timeout=60, stream=True) as r:
                if r.status_code == 416:  # already have it all
                    break
                r.raise_for_status()
                with open(part, "ab" if r.status_code == 206 else "wb") as f:  # 200 = server ignored Range, restart
                    for block in r.iter_content(1 << 16):
                        f.write(block)
            break
        except requests.exceptions.RequestException as e:
            if attempt == 5:
                raise
            print(f"  download interrupted ({type(e).__name__}), resuming from {part.stat().st_size // 1024} KB...")
    part.replace(path)  # only a complete download gets the real name
    return path


def screener_links(ticker: str) -> dict:
    """Latest annual report + concall transcript PDF links from the company's Screener page."""
    html = fetch(f"https://www.screener.in/company/{ticker}/consolidated/", ".html").read_text("utf-8", "ignore")
    ar = re.search(r'href="([^"]+\.pdf)"[^>]*>\s*Annual Report (\d{4})', html)
    cc = re.search(r'nowrap"[^>]*>([^<]+)</div>\s*<a\s+class="button-chip"\s+href="([^"]+)"[^>]*title="Raw Transcript"', html)
    return {
        "annual_report": (ar.group(1), f"annual-report-{ar.group(2)}") if ar else None,
        "concall": (cc.group(2), "concall-" + cc.group(1).strip().lower().replace(" ", "-")) if cc else None,
    }


# The rupee glyph in many Indian annual-report fonts extracts as a capital H ("H84,329 crore", "H 31/- per share").
# Only an H directly before an amount AND a unit is a rupee: "H2 FY26" / "H1" (half-years) stay as they are.
_RUPEE = re.compile(r"\bH ?(?=\d[\d,]*(?:\.\d+)?\s*(?:crore|cr\b|lakh|/-|million|billion|per share))", re.I)


def clean_pdf_text(text: str) -> str:
    """Fix the rupee glyph, re-join hyphenated words, and turn hard line breaks into spaces so sentences flow:
    the model quotes whole sentences instead of fragments cut at PDF line ends."""
    text = _RUPEE.sub("₹", text)
    text = re.sub(r"(\w)-\n(?=[a-z])", r"\1", text)
    return re.sub(r"\s*\n\s*", " ", text)


def pdf_docs(url: str, name: str) -> list[dict]:
    with fitz.open(fetch(url, ".pdf")) as pdf:
        return [{"source": f"{name} p.{i + 1}", "url": f"{url}#page={i + 1}", "text": clean_pdf_text(p.get_text())}
                for i, p in enumerate(pdf)]


def financial_docs(ticker: str) -> list[dict]:
    import yfinance as yf

    t = yf.Ticker(f"{ticker}.NS")
    docs = []
    # One doc per line item: a whole table embeds as noise, "Total Debt: FY2026 ..." embeds as debt.
    for name, df in [("balance-sheet", t.balance_sheet), ("income-statement", t.income_stmt), ("cash-flow", t.cashflow)]:
        df = (df / 1e7).round(0).dropna(how="all")  # INR -> crore
        for item, row in df.iterrows():
            vals = ", ".join(f"FY{d.year}: Rs {v:,.0f} crore" for d, v in row.items() if v == v)  # v == v skips NaN
            docs.append({"source": f"yfinance-{name}", "url": f"https://finance.yahoo.com/quote/{ticker}.NS/financials",
                         "text": f"{item} ({name}, fiscal year ending March): {vals}"})
    return docs


def news_docs(company: str) -> list[dict]:
    url = f"https://news.google.com/rss/search?q={quote_plus(chr(34) + company + chr(34))}+when:30d&hl=en-IN&gl=IN&ceid=IN:en"
    root = ET.fromstring(requests.get(url, headers=UA, timeout=30).content)
    docs = []
    for item in root.iter("item"):
        date = parsedate_to_datetime(item.findtext("pubDate")).date().isoformat()
        docs.append({"source": f"news {date}", "url": item.findtext("link"), "text": f"{date}: {item.findtext('title')}"})
    return docs


# ---------- chunk + embed ----------

def chunk(doc: dict) -> list[dict]:
    text = re.sub(r"[ \t]+", " ", doc["text"]).strip()
    if len(text) < 40:  # blank / image-only pages
        return []
    if len(text) <= CHUNK:
        return [{**doc, "text": text}]
    # ponytail: fixed-size char windows with overlap; switch to section-aware splitting if retrieval misses context
    return [{**doc, "text": text[i:i + CHUNK]} for i in range(0, len(text), CHUNK - 200)]


_model = None


def embed(texts: list[str]) -> np.ndarray:
    global _model
    if _model is None:
        from fastembed import TextEmbedding  # bge-small: same family as Cloudflare Workers AI, swap later
        _model = TextEmbedding("BAAI/bge-small-en-v1.5", cache_dir=str(DATA / "models"))
    return np.array(list(_model.embed(texts)), dtype=np.float32)  # already L2-normalised


def ingest(ticker: str, company: str) -> int:
    links = screener_links(ticker)
    docs = financial_docs(ticker) + news_docs(company)
    for key in ("annual_report", "concall"):
        if links[key]:
            docs += pdf_docs(*links[key])
    chunks = [c for d in docs for c in chunk(d)]
    out = DATA / ticker
    out.mkdir(parents=True, exist_ok=True)
    np.save(out / "vectors.npy", embed([c["text"] for c in chunks]))
    (out / "chunks.json").write_text(json.dumps({"ingested": datetime.now().isoformat(timespec="seconds"), "chunks": chunks}), "utf-8")
    return len(chunks)


# ---------- search ----------

_index: dict = {}
_lock = threading.Lock()  # council agents search in parallel; load the model/index once


def load(ticker: str) -> tuple[np.ndarray, list[dict]]:
    with _lock:
        if ticker not in _index:
            d = DATA / ticker
            if not (d / "vectors.npy").exists():
                raise FileNotFoundError(f"{ticker} not ingested. Run: python -m app.rag ingest {ticker}")
            _index[ticker] = (np.load(d / "vectors.npy"), json.loads((d / "chunks.json").read_text("utf-8"))["chunks"])
        embed([])  # make sure the model is loaded under the lock too
    return _index[ticker]


def search(ticker: str, query: str, k: int = 6, only: str | None = None) -> list[dict]:
    """only: restrict to chunks whose source starts with this prefix, e.g. "concall" or "news"."""
    vecs, chunks = load(ticker)
    # ponytail: brute-force cosine over a numpy array; fine for ~1k chunks/stock, move to Cloudflare Vectorize when multi-stock
    scores = vecs @ embed(["Represent this sentence for searching relevant passages: " + query])[0]
    if only:
        scores = np.where([c["source"].startswith(only) for c in chunks], scores, -np.inf)
    return [{**chunks[i], "score": float(scores[i])} for i in np.argsort(-scores)[:k] if scores[i] > -np.inf]


def docs(ticker: str, only: str) -> list[dict]:
    """Every chunk from one source type (the news set is small enough to read whole)."""
    return [c for c in load(ticker)[1] if c["source"].startswith(only)]


if __name__ == "__main__":
    from .main import DEMO_STOCKS

    cmd, ticker = sys.argv[1], sys.argv[2].upper()
    if cmd == "ingest":
        print(f"{ticker}: {ingest(ticker, DEMO_STOCKS[ticker])} chunks")
    elif cmd == "ask":
        from .agents import ask

        print(ask(ticker, " ".join(sys.argv[3:])).model_dump_json(indent=2))
    elif cmd == "analyze":
        from .agents import council

        print(json.dumps(council(ticker, DEMO_STOCKS[ticker], fresh="fresh" in sys.argv), indent=2, ensure_ascii=False))
