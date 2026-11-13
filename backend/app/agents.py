"""The analyst council. Day 1: Fundamentals agent. Day 2: sourced Q&A over the knowledge store."""
import re

from typing import Annotated

from pydantic import AfterValidator, BaseModel

from .llm import chat_json

# Model echoes the "[tag]" format; keep the bare id so citations can be matched to documents.
Source = Annotated[str, AfterValidator(lambda v: v.strip().strip("[]").strip())]


class Point(BaseModel):
    claim: str
    source: Source  # must name the document the claim came from


class Fundamentals(BaseModel):
    company: str
    points: list[Point]
    red_flags: list[Point]


FUNDAMENTALS_SYSTEM = """You are the Fundamentals analyst on Samiksha, an educational stock research desk for Indian retail investors.
Read ONLY the documents given. State facts about revenue, margins, debt, cash flow, promoter pledging, auditor notes and related-party deals.
Rules: every claim must cite the [source] tag of the document it came from; never invent numbers; plain English;
never recommend buying, selling or holding, and never give a target price or rating."""


FUNDAMENTALS_EXAMPLE = """{"company": "Example Ltd", "points": [{"claim": "Revenue grew 12% to Rs 500 crore.", "source": "annual-report-2025"}], "red_flags": [{"claim": "Promoters pledged 10% of holding.", "source": "shareholding-q2"}]}"""


class Evidence(BaseModel):
    quote: str   # verbatim text copied from the source chunk
    source: Source
    url: str = ""
    verified: bool = False  # set by us, not the model: does the quote really appear in that source?


class Answer(BaseModel):
    answer: str
    evidence: list[Evidence]


ASK_SYSTEM = """You answer questions about one Indian listed company for a first-time investor, using ONLY the excerpts given.
Each excerpt starts with its [source] tag. Answer in 1-3 plain-English sentences with the actual numbers.
For every fact, add evidence: an EXACT quote copied character-for-character from one excerpt (a short line or table row) and that excerpt's source tag.
If the excerpts do not contain the answer, say so and return empty evidence. Never recommend buying, selling or holding."""

ASK_EXAMPLE = """{"answer": "Total debt was Rs 8,000 crore at the end of FY2026, up from Rs 7,500 crore.", "evidence": [{"quote": "FY2026: Rs 8,000 crore, FY2025: Rs 7,500 crore", "source": "yfinance-balance-sheet"}]}"""


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip().lower()


def ask(ticker: str, question: str) -> Answer:
    from . import rag

    hits = rag.search(ticker, question)
    body = "\n\n".join(f"[{h['source']}]\n{h['text']}" for h in hits)
    ans = chat_json(ASK_SYSTEM, f"Question: {question}\n\nExcerpts:\n{body}", Answer, ASK_EXAMPLE)
    by_source = {}
    for h in hits:
        by_source.setdefault(h["source"], []).append(h)
    for ev in ans.evidence:  # grounding check: quote must literally exist in the cited excerpt
        for h in by_source.get(ev.source, []):
            if _norm(ev.quote) in _norm(h["text"]):
                ev.verified, ev.url = True, h["url"]
    return ans


def fundamentals(company: str, docs: list[dict]) -> Fundamentals:
    """docs: [{"source": "...", "text": "..."}]"""
    body = "\n\n".join(f"[{d['source']}]\n{d['text']}" for d in docs)
    return chat_json(FUNDAMENTALS_SYSTEM, f"Company: {company}\n\nDocuments:\n{body}", Fundamentals, FUNDAMENTALS_EXAMPLE)
