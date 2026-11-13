"""The analyst council. Every claim carries an exact quote that we verify against the cited source."""
import re
from typing import Annotated

from pydantic import AfterValidator, BaseModel

from . import rag
from .llm import chat_json

# Model echoes the "[tag]" format; keep the bare id so citations can be matched to documents.
Source = Annotated[str, AfterValidator(lambda v: v.strip().strip("[]").strip())]


class Evidence(BaseModel):
    quote: str   # verbatim text copied from the source excerpt
    source: Source
    url: str = ""
    verified: bool = False  # set by us, not the model: does the quote really appear in that source?


class Finding(Evidence):
    claim: str


def _context(hits: list[dict]) -> str:
    return "\n\n".join(f"[{h['source']}]\n{h['text']}" for h in hits)


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip().lower()


def _verify(items: list[Evidence], hits: list[dict]) -> None:
    """Grounding check: a quote is verified only if it literally appears in an excerpt with the cited source."""
    by_source: dict[str, list[dict]] = {}
    for h in hits:
        by_source.setdefault(h["source"], []).append(h)
    for ev in items:
        for h in by_source.get(ev.source, []):
            if _norm(ev.quote) in _norm(h["text"]):
                ev.verified, ev.url = True, h["url"]
                break


QUOTE_RULE = """Each excerpt starts with its [source] tag. For every fact give an EXACT quote copied character-for-character
from one excerpt plus that excerpt's source tag. Keep each quote to the shortest exact span that proves the claim (under ~25 words). Use only the excerpts; never invent numbers.
Plain English for a first-time investor. Never recommend buying, selling or holding; no target price, no rating."""


# ---------- Q&A ----------

class Answer(BaseModel):
    answer: str
    evidence: list[Evidence]


ASK_SYSTEM = f"""You answer questions about one Indian listed company. Answer in 1-3 sentences with the actual numbers.
If the excerpts do not contain the answer, say so and return empty evidence.
{QUOTE_RULE}"""

ASK_EXAMPLE = """{"answer": "Total debt was Rs 8,000 crore at the end of FY2026, up from Rs 7,500 crore.", "evidence": [{"quote": "FY2026: Rs 8,000 crore, FY2025: Rs 7,500 crore", "source": "yfinance-balance-sheet"}]}"""


def ask(ticker: str, question: str) -> Answer:
    hits = rag.search(ticker, question)
    ans = chat_json(ASK_SYSTEM, f"Question: {question}\n\nExcerpts:\n{_context(hits)}", Answer, ASK_EXAMPLE)
    _verify(ans.evidence, hits)
    return ans


# ---------- Fundamentals agent ----------

class Fundamentals(BaseModel):
    company: str
    points: list[Finding]
    red_flags: list[Finding]
    not_found: list[str] = []  # topics the documents did not cover; honest gaps beat guesses


# Each topic is one retrieval query; the agent reads the union of the hits.
FUNDAMENTALS_TOPICS = [
    "Total Revenue and revenue growth",
    "Operating Income and operating margin",
    "Net Income profit after tax",
    "Total Debt borrowings",
    "Free Cash Flow and Operating Cash Flow",
    "promoter shareholding and shares pledged or encumbered",
    "Independent Auditor's Report Opinion: in our opinion the financial statements give a true and fair view",
    "auditor's report qualified opinion emphasis of matter key audit matters",
    "related party transactions",
]

FUNDAMENTALS_SYSTEM = f"""You are the Fundamentals analyst on Samiksha, an educational stock research desk for Indian retail investors.
Cover: revenue and growth, margins, profit, debt, cash flow, promoter pledging, auditor remarks, related-party deals.
"points" = the key facts (5-8). "red_flags" = genuine concerns visible in the excerpts (can be empty; do not manufacture any).
"not_found" = any of those topics the excerpts do not cover.
Auditor: say whether the audit opinion is unmodified (clean) or qualified; skip standard boilerplate.
A quote must include its label or context (e.g. "Promoter and Promoter Group 71.74%"), never a bare number.
{QUOTE_RULE}"""

FUNDAMENTALS_EXAMPLE = """{"company": "Example Ltd", "points": [{"claim": "Revenue grew about 12% to Rs 5,600 crore in FY2026.", "quote": "Total Revenue (income-statement, fiscal year ending March): FY2026: Rs 5,600 crore, FY2025: Rs 5,000 crore", "source": "yfinance-income-statement"}], "red_flags": [{"claim": "Promoters have pledged 10% of their shares.", "quote": "Shares pledged or otherwise encumbered 10.0%", "source": "annual-report-2026 p.88"}], "not_found": ["related-party transactions"]}"""


def fundamentals(ticker: str, company: str) -> Fundamentals:
    hits, seen = [], set()
    for topic in FUNDAMENTALS_TOPICS:
        for h in rag.search(ticker, topic, k=4):
            if (h["source"], h["text"]) not in seen:
                seen.add((h["source"], h["text"]))
                hits.append(h)
    out = chat_json(FUNDAMENTALS_SYSTEM, f"Company: {company}\n\nExcerpts:\n{_context(hits)}", Fundamentals, FUNDAMENTALS_EXAMPLE)
    _verify(out.points + out.red_flags, hits)
    return out
