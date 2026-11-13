"""The analyst council (Fundamentals, Earnings-call, News) running in parallel, then the Chief synthesizer.

Grounding: analysts cite numbered excerpts (E1, E2...) with a short exact quote that we verify in code.
The synthesizer cites analyst findings by id (F1, F2...) and only ever sees verified findings.
Speed: BharatCode decodes at ~3-26 tokens/s, so time ~= output tokens. IDs instead of source strings,
short quotes and capped list sizes keep output small; analysts run concurrently; briefings are cached per day.
"""
import json
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from typing import Annotated, Literal

from fastapi.encoders import jsonable_encoder
from pydantic import AfterValidator, BaseModel

from . import rag
from .llm import chat_json

# Model sometimes echoes the "[E3]" format; keep the bare id.
Ref = Annotated[str, AfterValidator(lambda v: v.strip().strip("[]").strip().upper())]


class Evidence(BaseModel):
    quote: str   # short verbatim text copied from the excerpt
    ref: Ref     # excerpt id the model cites, e.g. "E3"
    source: str = ""        # filled in by us from the ref
    url: str = ""
    verified: bool = False  # set by us, not the model: does the quote really appear in that excerpt?


class Finding(Evidence):
    claim: str


def _context(hits: list[dict]) -> str:
    return "\n\n".join(f"[E{i}] ({h['source']})\n{h['text']}" for i, h in enumerate(hits, 1))


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip().lower()


def _verify(items: list[Evidence], hits: list[dict]) -> None:
    """Grounding check: resolve E<n> to its excerpt; verified only if the quote literally appears in it."""
    for ev in items:
        m = re.fullmatch(r"E(\d+)", ev.ref)
        if m and 1 <= int(m.group(1)) <= len(hits):
            h = hits[int(m.group(1)) - 1]
            ev.source, ev.url = h["source"], h["url"]
            ev.verified = _norm(ev.quote) in _norm(h["text"])


QUOTE_RULE = """Each excerpt starts with its id like [E3]. For every fact give "ref" (the excerpt id) and "quote":
a SHORT exact span (3-12 words) copied character-for-character from that excerpt that proves the fact.
Use numbers exactly as written in the excerpt. Use only the excerpts; never invent numbers.
Plain English for a first-time investor. Never recommend buying, selling or holding; no target price, no rating."""


def _evidence_in(obj: BaseModel) -> list[Evidence]:
    found = []
    for v in obj.__dict__.values():  # every Evidence field, list or single
        items = v if isinstance(v, list) else [v]
        found += [x for x in items if isinstance(x, Evidence)]
    return found


# ---------- Q&A ----------

class Answer(BaseModel):
    answer: str
    evidence: list[Evidence]


ASK_SYSTEM = f"""You answer questions about one Indian listed company. Answer in 1-3 sentences with the actual numbers.
If the excerpts do not contain the answer, say so and return empty evidence.
{QUOTE_RULE}"""

ASK_EXAMPLE = """{"answer": "Total debt was Rs 8,000 crore at the end of FY2026, up from Rs 7,500 crore.", "evidence": [{"quote": "FY2026: Rs 8,000 crore, FY2025: Rs 7,500 crore", "ref": "E2"}]}"""


def ask(ticker: str, question: str) -> Answer:
    hits = rag.search(ticker, question)
    ans = chat_json(ASK_SYSTEM, f"Question: {question}\n\nExcerpts:\n{_context(hits)}", Answer, ASK_EXAMPLE)
    _verify(ans.evidence, hits)
    return ans


# ---------- shared analyst machinery ----------

def _gather(ticker: str, topics: list[str], k: int = 3, only: str | None = None) -> list[dict]:
    """One retrieval per topic; the agent reads the de-duplicated union."""
    hits, seen = [], set()
    for topic in topics:
        for h in rag.search(ticker, topic, k=k, only=only):
            if (h["source"], h["text"]) not in seen:
                seen.add((h["source"], h["text"]))
                hits.append(h)
    return hits


def _analyst(company: str, hits: list[dict], system: str, schema: type[BaseModel], example: str):
    """One Qwen call over the numbered excerpts, then verify every quote in the output."""
    if not hits:
        raise ValueError("no source documents of this type were ingested")
    out = chat_json(system, f"Company: {company}\n\nExcerpts:\n{_context(hits)}", schema, example)
    _verify(_evidence_in(out), hits)
    return out


# ---------- Fundamentals agent ----------

class Fundamentals(BaseModel):
    company: str
    points: list[Finding]
    red_flags: list[Finding]
    not_found: list[str] = []  # topics the documents did not cover; honest gaps beat guesses


FUNDAMENTALS_TOPICS = [
    "Total Revenue and revenue growth",
    "Operating Income and operating margin",
    "Net Income profit after tax",
    "Total Debt borrowings",
    "Free Cash Flow and Operating Cash Flow",
    "promoter shareholding and shares pledged or encumbered",
    "Independent Auditor's Report Opinion: in our opinion the financial statements give a true and fair view",
    "related party transactions",
]

FUNDAMENTALS_SYSTEM = f"""You are the Fundamentals analyst on Samiksha, an educational stock research desk for Indian retail investors.
Cover: revenue and growth, margins, profit, debt, cash flow, promoter holding/pledging, audit opinion, related-party deals.
"points" = at most 7 key facts, one per topic. "red_flags" = at most 3 genuine concerns visible in the excerpts (can be empty; never manufacture one).
"not_found" = short names of topics the excerpts do not cover. Audit: say if the opinion is unmodified (clean) or qualified.
Keep each claim to one short sentence.
{QUOTE_RULE}"""

FUNDAMENTALS_EXAMPLE = """{"company": "Example Ltd", "points": [{"claim": "Revenue grew to Rs 5,600 crore in FY2026 from Rs 5,000 crore.", "quote": "FY2026: Rs 5,600 crore, FY2025: Rs 5,000 crore", "ref": "E1"}], "red_flags": [{"claim": "Promoters have pledged 10% of their shares.", "quote": "pledged or otherwise encumbered 10.0%", "ref": "E7"}], "not_found": ["related-party transactions"]}"""


def fundamentals(ticker: str, company: str) -> Fundamentals:
    return _analyst(company, _gather(ticker, FUNDAMENTALS_TOPICS), FUNDAMENTALS_SYSTEM, Fundamentals, FUNDAMENTALS_EXAMPLE)


# ---------- Earnings-call agent ----------

class EarningsCall(BaseModel):
    company: str
    guidance: list[Finding]    # what management expects or plans next
    highlights: list[Finding]  # key numbers and wins reported on the call
    concerns: list[Finding]    # weak spots management admitted or analysts pressed on
    tone: Finding | None = None  # overall management tone, backed by a quote
    not_found: list[str] = []


EARNINGS_TOPICS = [
    "outlook and guidance for the coming quarters and the year",
    "demand environment and client spending decisions",
    "deal wins, order book and total contract value TCV",
    "operating margin outlook, cost pressures and wage hikes",
    "headcount, hiring, attrition and utilisation",
    "risks, challenges and headwinds mentioned by management",
    "analyst questions about growth weakness, pricing and concerns",
]

EARNINGS_SYSTEM = f"""You are the Earnings-call analyst on Samiksha. The excerpts come from the company's latest earnings call transcript.
"guidance" = at most 3 things management expects or plans next. "highlights" = at most 3 key numbers or wins they reported.
"concerns" = at most 3 weaknesses management admitted or analysts pressed on (can be empty).
"tone" = one finding on management's overall tone (confident, cautious, defensive...) with a quote that shows it.
Attribute statements ("Management expects...", "An analyst asked..."); never state the future as fact. One short sentence per claim.
{QUOTE_RULE}"""

EARNINGS_EXAMPLE = """{"company": "Example Ltd", "guidance": [{"claim": "Management expects margins to stay in the 24-26% band.", "quote": "operating within our 24 to 26% margin band", "ref": "E4"}], "highlights": [{"claim": "The quarter's order book was $10 billion.", "quote": "TCV of $10 billion", "ref": "E1"}], "concerns": [{"claim": "An analyst asked why growth in Europe slowed.", "quote": "what explains the slowdown in Europe", "ref": "E9"}], "tone": {"claim": "Management sounded cautiously optimistic.", "quote": "cautiously optimistic about the second half", "ref": "E2"}, "not_found": []}"""


def earnings_call(ticker: str, company: str) -> EarningsCall:
    return _analyst(company, _gather(ticker, EARNINGS_TOPICS, only="concall"), EARNINGS_SYSTEM, EarningsCall, EARNINGS_EXAMPLE)


# ---------- News agent ----------

class News(BaseModel):
    company: str
    events: list[Finding]  # material events only
    overall: Literal["positive", "negative", "mixed", "neutral", "quiet"]  # tone of the news flow, not a view on the stock
    not_found: list[str] = []


NEWS_SYSTEM = f"""You are the News analyst on Samiksha. The excerpts are recent news headlines (last 30 days).
"events" = at most 5 material events for the business (results, big deals, management changes, legal/regulatory action, layoffs, M&A).
Merge headlines about the same event. Skip share-price moves, market wrap-ups and listicles. One short sentence per claim.
"overall" = the tone of this news flow ("quiet" if nothing material happened).
{QUOTE_RULE}"""

NEWS_EXAMPLE = """{"company": "Example Ltd", "events": [{"claim": "The company won a large contract from a European bank.", "quote": "bags $500 million deal from European bank", "ref": "E3"}], "overall": "positive", "not_found": []}"""


def news(ticker: str, company: str) -> News:
    return _analyst(company, rag.docs(ticker, "news"), NEWS_SYSTEM, News, NEWS_EXAMPLE)


# ---------- Chief synthesizer: the final balanced verdict (never a buy/sell call) ----------

class Point(BaseModel):
    point: str
    refs: list[Ref]          # finding ids, e.g. ["F3", "F7"]
    sources: list[dict] = []  # filled in by us from the referenced verified findings


class Briefing(BaseModel):
    bottom_line: str           # balanced 2-3 sentence summary weighing both sides
    bull_case: list[Point]
    bear_case: list[Point]
    risks: list[Point]
    what_to_watch: list[str]


SYNTH_SYSTEM = """You are the Chief synthesizer on Samiksha, an educational research desk. You get numbered, verified findings
from three analysts (fundamentals, earnings call, news). Write a balanced briefing using ONLY those findings.
"bottom_line" = 2-3 plain-English sentences weighing the strongest positives against the strongest concerns.
"bull_case", "bear_case", "risks" = 2-4 points each; every point cites 1-3 finding ids in "refs" (e.g. ["F2","F9"]).
"what_to_watch" = 2-4 short things an investor should monitor next.
Never tell the reader to buy, sell or hold; no rating, no target price, no "good/bad investment" verdict. Inform, don't advise."""

SYNTH_EXAMPLE = """{"bottom_line": "Example Ltd is growing profitably with low debt, but its home market shrank and management sounded cautious about the next two quarters.", "bull_case": [{"point": "Margins are at a multi-year high.", "refs": ["F2"]}], "bear_case": [{"point": "Home-market revenue fell sharply.", "refs": ["F8", "F12"]}], "risks": [{"point": "Growth depends on a demand recovery management has not promised.", "refs": ["F10"]}], "what_to_watch": ["Whether the next quarter's deal wins hold up"]}"""


def synthesize(company: str, findings: list[Finding]) -> Briefing:
    if not findings:
        raise ValueError("no verified findings to synthesize")
    body = "\n".join(f"[F{i}] {f.claim} ({f.source})" for i, f in enumerate(findings, 1))
    out = chat_json(SYNTH_SYSTEM, f"Company: {company}\n\nVerified findings:\n{body}", Briefing, SYNTH_EXAMPLE)
    for section in (out.bull_case, out.bear_case, out.risks):
        for p in section:
            ids = [int(m.group(1)) for r in p.refs if (m := re.fullmatch(r"F(\d+)", r)) and 1 <= int(m.group(1)) <= len(findings)]
            p.sources = [{"source": findings[i - 1].source, "url": findings[i - 1].url, "quote": findings[i - 1].quote} for i in ids]
        section[:] = [p for p in section if p.sources]  # citation-or-reject: a point with no valid finding behind it is dropped
    return out


# ---------- The council: analysts in parallel -> synthesizer, cached per day ----------

ANALYSTS = {"fundamentals": fundamentals, "earnings_call": earnings_call, "news": news}


def council(ticker: str, company: str, fresh: bool = False) -> dict:
    cache = rag.DATA / ticker / f"briefing-{date.today()}.json"
    if cache.exists() and not fresh:
        return json.loads(cache.read_text("utf-8"))
    rag.load(ticker)  # fail fast (409) if the stock isn't ingested, before spending LLM calls
    with ThreadPoolExecutor(len(ANALYSTS)) as pool:  # LLM calls are I/O-bound; threads are enough
        futures = {name: pool.submit(fn, ticker, company) for name, fn in ANALYSTS.items()}
    out, findings = {}, []
    for name, fut in futures.items():
        try:
            out[name] = fut.result()
            findings += [f for f in _evidence_in(out[name]) if isinstance(f, Finding) and f.verified]
        except Exception as e:  # one analyst failing shouldn't sink the whole briefing
            out[name] = {"error": f"{type(e).__name__}: {e}"}
    try:
        out["briefing"] = synthesize(company, findings)
    except Exception as e:
        out["briefing"] = {"error": f"{type(e).__name__}: {e}"}
    out = jsonable_encoder(out)
    if not any("error" in v for v in out.values()):  # only cache complete briefings
        cache.parent.mkdir(parents=True, exist_ok=True)
        cache.write_text(json.dumps(out, ensure_ascii=False), "utf-8")
    return out
