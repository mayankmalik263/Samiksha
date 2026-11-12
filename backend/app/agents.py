"""The analyst council. Day 1: Fundamentals agent only."""
from pydantic import BaseModel, field_validator

from .llm import chat_json


class Point(BaseModel):
    claim: str
    source: str  # must name the document the claim came from

    @field_validator("source")
    @classmethod
    def strip_brackets(cls, v: str) -> str:
        return v.strip().strip("[]").strip()  # model echoes the [tag] format; keep the bare id for citation checks


class Fundamentals(BaseModel):
    company: str
    points: list[Point]
    red_flags: list[Point]


FUNDAMENTALS_SYSTEM = """You are the Fundamentals analyst on Samiksha, an educational stock research desk for Indian retail investors.
Read ONLY the documents given. State facts about revenue, margins, debt, cash flow, promoter pledging, auditor notes and related-party deals.
Rules: every claim must cite the [source] tag of the document it came from; never invent numbers; plain English;
never recommend buying, selling or holding, and never give a target price or rating."""


FUNDAMENTALS_EXAMPLE = """{"company": "Example Ltd", "points": [{"claim": "Revenue grew 12% to Rs 500 crore.", "source": "annual-report-2025"}], "red_flags": [{"claim": "Promoters pledged 10% of holding.", "source": "shareholding-q2"}]}"""


def fundamentals(company: str, docs: list[dict]) -> Fundamentals:
    """docs: [{"source": "...", "text": "..."}]"""
    body = "\n\n".join(f"[{d['source']}]\n{d['text']}" for d in docs)
    return chat_json(FUNDAMENTALS_SYSTEM, f"Company: {company}\n\nDocuments:\n{body}", Fundamentals, FUNDAMENTALS_EXAMPLE)
