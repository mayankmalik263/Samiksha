import json
import queue
import threading

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from . import agents, guardrail, llm, rag

# Demo universe (NSE). Only these are accepted until ingestion is generic.
DEMO_STOCKS = {
    "RELIANCE": "Reliance Industries",
    "TCS": "Tata Consultancy Services",
    "HDFCBANK": "HDFC Bank",
    "INFY": "Infosys",
    "ITC": "ITC",
    "ADANIENT": "Adani Enterprises",
}
DISCLAIMER = "Educational. Not investment advice."

app = FastAPI(title="Samiksha")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"], allow_methods=["*"], allow_headers=["*"])


def _ticker(raw: str) -> str:
    ticker = raw.strip().upper()
    if ticker not in DEMO_STOCKS:
        raise HTTPException(404, f"Unknown ticker. Try one of: {', '.join(DEMO_STOCKS)}")
    return ticker


def _run(fn, *args):
    try:
        return fn(*args)
    except FileNotFoundError as e:  # stock not ingested yet
        raise HTTPException(409, str(e))
    except Exception as e:
        raise HTTPException(502, f"LLM call failed: {e}")


@app.get("/stocks")
def stocks():
    return DEMO_STOCKS


@app.get("/health")
def health():
    """For the deploy check and the demo: which stocks are ready, and how fresh each briefing is."""
    ready = {t: (rag.DATA / t / "vectors.npy").exists() for t in DEMO_STOCKS}
    latest = {t: (f.stem.removeprefix("briefing-") if (f := agents.latest_briefing(t)) else None) for t in DEMO_STOCKS}
    return {"ok": True, "model": llm.MODEL, "key_set": llm.API_KEY.startswith("bc_"), "ingested": ready, "latest_briefing": latest}


class AskRequest(BaseModel):
    ticker: str
    question: str


@app.get("/firewall")
def firewall():
    """What the firewall did in each stock's latest cached briefing, for the landing page. Reads files only: a page view
    never starts a council."""
    out = []
    for t in DEMO_STOCKS:
        if f := agents.latest_briefing(t):
            g = json.loads(f.read_text("utf-8"))["guardrail"]
            out.append({"ticker": t, "as_of": f.stem.removeprefix("briefing-"), "passed": g["passed"], "blocked": g["blocked"]})
    return {"stocks": out}


@app.post("/ask")
def ask(req: AskRequest):
    ticker = _ticker(req.ticker)
    answer = guardrail.firewall(_run(agents.ask, ticker, req.question[:500]).model_dump())
    return {"ticker": ticker, **answer, "disclaimer": DISCLAIMER}


class AnalyzeRequest(BaseModel):
    ticker: str
    fresh: bool = False  # skip today's cached briefing and re-run the council


@app.post("/analyze")
def analyze(req: AnalyzeRequest):
    ticker = _ticker(req.ticker)
    return {"ticker": ticker, "council": _run(agents.council, ticker, DEMO_STOCKS[ticker], req.fresh), "disclaimer": DISCLAIMER}


def _sse(event: dict) -> str:
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"


@app.get("/analyze/stream")
def analyze_stream(ticker: str, fresh: bool = False):
    """Server-sent events: one event per agent as it finishes (already firewalled), then the full briefing.
    Events: start | cached | agent {agent, status: running|done|error, seconds, data} | done {council} | error {status, detail}."""
    ticker = _ticker(ticker)
    events: queue.Queue = queue.Queue()

    def work():
        try:
            council = agents.council(ticker, DEMO_STOCKS[ticker], fresh, events.put)
            events.put({"type": "done", "ticker": ticker, "company": DEMO_STOCKS[ticker], "council": council,
                        "disclaimer": DISCLAIMER})
        except FileNotFoundError as e:  # stock not ingested yet
            events.put({"type": "error", "status": 409, "detail": str(e)})
        except Exception as e:
            events.put({"type": "error", "status": 502, "detail": f"LLM call failed: {e}"})
        events.put(None)

    threading.Thread(target=work, daemon=True).start()  # ponytail: the run continues if the browser leaves; it still caches

    def stream():
        yield _sse({"type": "hello", "ticker": ticker, "company": DEMO_STOCKS[ticker]})
        while True:
            try:
                event = events.get(timeout=15)
            except queue.Empty:
                yield ": keep-alive\n\n"  # BharatCode can be slow; keep proxies from closing the connection
                continue
            if event is None:
                return
            yield _sse(event)

    return StreamingResponse(stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
