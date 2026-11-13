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

from . import guardrail, rag
from .llm import chat_json

# Model sometimes echoes the "[E3]" format; keep the bare id.
Ref = Annotated[str, AfterValidator(lambda v: v.strip().strip("[]").strip().upper())]


class Evidence(BaseModel):
    quote: str   # short verbatim text copied from the excerpt
    ref: Ref     # excerpt id the model cites, e.g. "E3"
    source: str = ""        # filled in by us from the ref
    url: str = ""
    verified: bool = False  # set by us, not the model: quote in the excerpt AND every claimed number in it
    issue: str = ""         # why it failed verification (shown in the guardrail log)


class Finding(Evidence):
    claim: str


def _context(hits: list[dict]) -> str:
    return "\n\n".join(f"[E{i}] ({h['source']})\n{h['text']}" for i, h in enumerate(hits, 1))


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip().lower()


def _verify(items: list[Evidence], hits: list[dict]) -> None:
    """Grounding check: resolve E<n> to its excerpt; verified only if the quote literally appears in it
    and (for findings) every number in the claim appears in that excerpt too."""
    for ev in items:
        m = re.fullmatch(r"E(\d+)", ev.ref)
        if not (m and 1 <= int(m.group(1)) <= len(hits)):
            ev.issue = f"cites an excerpt that doesn't exist ({ev.ref})"
            continue
        h = hits[int(m.group(1)) - 1]
        ev.source, ev.url = h["source"], h["url"]
        if _norm(ev.quote) not in _norm(h["text"]):
            ev.issue = "quote not found in the cited source"
        elif m := guardrail.advice(ev.quote):  # seen live: a broker's "Buy ...; target of Rs 2530" headline as evidence
            ev.issue = f"relays a third-party buy/sell call or target ('{m}')"
        elif bad := guardrail.unsupported_numbers(getattr(ev, "claim", ""), h["text"]):
            ev.issue = f"number(s) {', '.join(sorted(bad))} not in the cited source"
        else:
            ev.verified = True


def _advice_check(obj: BaseModel) -> str | None:
    """chat_json hook: any recommendation language in model-written text triggers one rewrite."""
    for text in guardrail.written_texts(obj.model_dump()):
        if m := guardrail.advice(text):
            return f"'{m}' in: {text[:160]}"
    return None


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
    ans = chat_json(ASK_SYSTEM, f"Question: {question}\n\nExcerpts:\n{_context(hits)}", Answer, ASK_EXAMPLE, check=_advice_check)
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
    out = chat_json(system, f"Company: {company}\n\nExcerpts:\n{_context(hits)}", schema, example, check=_advice_check)
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


# ---------- The debate: Bull vs Bear, rebuttals, Risk, Chief synthesizer ----------
# Debaters never see raw documents: they argue only from verified findings (F1, F2...), and every
# argument's numbers must exist in the findings it cites. Inform, never advise.

class Argument(BaseModel):
    point: str
    refs: list[Ref]           # finding ids, e.g. ["F3", "F7"]
    answers: Ref = ""         # rebuttals only: the opposing argument this answers, e.g. "A2"
    sources: list[dict] = []  # filled in by us from the referenced findings
    verified: bool = False    # set by us: cites real findings and invents no numbers
    issue: str = ""


class Case(BaseModel):
    arguments: list[Argument]


class Verdict(BaseModel):
    bottom_line: str           # balanced 2-3 sentence summary weighing both sides; never a recommendation
    what_to_watch: list[str]


DEBATE_RULES = """You argue ONLY from the numbered verified findings given. Every argument cites 1-3 finding ids in "refs" (e.g. ["F2","F9"]).
Use numbers exactly as they appear in the findings; never add new numbers. One or two short sentences per argument.
You argue about the BUSINESS (growth, profits, balance sheet, management, news), never about whether to buy the stock.
Never recommend buying, selling or holding; no rating, no target price, no "undervalued/overvalued"."""

BULL_SYSTEM = f"""You are the Bull analyst on Samiksha. Make the strongest HONEST case that the business is in good shape:
3-4 arguments, strongest first. Don't exaggerate or ignore what the findings say.
{DEBATE_RULES}"""

BEAR_SYSTEM = f"""You are the Bear analyst on Samiksha. Make the strongest HONEST case that the business has real problems:
3-4 arguments, strongest first. Don't exaggerate or ignore what the findings say.
{DEBATE_RULES}"""

REBUTTAL_SYSTEM = """You are the {side} analyst on Samiksha, rebutting the opposing analyst. Their arguments are numbered A1, A2...
Answer their 2 strongest arguments: set "answers" to the argument id you are answering and counter it with evidence.
{rules}"""

RISK_SYSTEM = f"""You are the Risk analyst on Samiksha. Stress-test both sides of the debate: what could break the bull case,
and what could make the bear case worse (or prove it wrong)? 3-4 risks, most important first, as "arguments".
{DEBATE_RULES}"""

SYNTH_SYSTEM = """You are the Chief synthesizer on Samiksha, an educational research desk. You get verified findings and the bull and bear arguments.
"bottom_line" = 2-3 plain-English sentences that weigh the strongest bull point against the strongest bear point, for a first-time investor.
"what_to_watch" = 2-4 short, concrete things to monitor next (results, guidance, events).
Never tell the reader to buy, sell or hold; no rating, no target price, no "good/bad investment" verdict. Inform, don't advise."""

CASE_EXAMPLE = """{"arguments": [{"point": "Margins are at a four-year high of 25.0% while debt stays small.", "refs": ["F2", "F6"]}]}"""
REBUTTAL_EXAMPLE = """{"arguments": [{"answers": "A1", "point": "The revenue dip came from one large contract ending, not lost clients.", "refs": ["F1", "F3"]}]}"""
SYNTH_EXAMPLE = """{"bottom_line": "Example Ltd is growing profitably with little debt, but its home market shrank and management sounded cautious about the next two quarters.", "what_to_watch": ["Whether next quarter's deal wins hold up", "Any change in margin guidance"]}"""


def _findings_text(findings: list[Finding]) -> str:
    return "\n".join(f"[F{i}] {f.claim} ({f.source})" for i, f in enumerate(findings, 1))


def _args_text(args: list[Argument]) -> str:
    return "\n".join(f"[A{i}] {a.point}" for i, a in enumerate(args, 1))


def _resolve(args: list[Argument], findings: list[Finding]) -> list[Argument]:
    """Attach the cited findings as sources; verified only if refs are real and no number is invented."""
    for a in args:
        ids = [int(m.group(1)) for r in a.refs if (m := re.fullmatch(r"F(\d+)", r)) and 1 <= int(m.group(1)) <= len(findings)]
        cited = [findings[i - 1] for i in dict.fromkeys(ids)]
        a.sources = [{"source": f.source, "url": f.url, "quote": f.quote, "finding": f.claim} for f in cited]
        support = " ".join(f"{f.claim} {f.quote}" for f in cited)
        if not cited:
            a.issue = "cites no verified finding"
        elif bad := guardrail.unsupported_numbers(a.point, support):
            a.issue = f"number(s) {', '.join(sorted(bad))} not in the cited findings"
        else:
            a.verified = True
    return args


def _debater(system: str, user: str, findings: list[Finding], example: str = CASE_EXAMPLE) -> list[Argument]:
    case = chat_json(system, user, Case, example, check=_advice_check)
    return _resolve(case.arguments, findings)


def _rebut(side: str, base: str, opponent: list[Argument], findings: list[Finding]) -> list[Argument]:
    system = REBUTTAL_SYSTEM.format(side=side, rules=DEBATE_RULES)
    return _debater(system, f"{base}\n\nOpposing arguments:\n{_args_text(opponent)}", findings, REBUTTAL_EXAMPLE)


def debate(company: str, findings: list[Finding]) -> dict:
    """Round 1: Bull and Bear in parallel. Round 2 (all parallel): both rebuttals, the Risk agent, the Chief synthesizer.
    Two LLM rounds after the analysts instead of four: speed is the constraint on BharatCode."""
    if not findings:
        raise ValueError("no verified findings to debate")
    base = f"Company: {company}\n\nVerified findings:\n{_findings_text(findings)}"
    errors: dict[str, str] = {}

    def get(name, fut, default):  # each debater fails on its own (seen live: a 503 from BharatCode)
        try:
            return fut.result() if fut else default
        except Exception as e:
            errors[name] = f"{type(e).__name__}: {e}"
            return default

    with ThreadPoolExecutor(4) as pool:
        bull = get("bull_case", pool.submit(_debater, BULL_SYSTEM, base, findings), [])
        bear = get("bear_case", pool.submit(_debater, BEAR_SYSTEM, base, findings), [])
        if not bull and not bear:
            raise ValueError(f"both debaters failed: {errors}")
        sides = f"\n\nBull arguments:\n{_args_text(bull)}\n\nBear arguments:\n{_args_text(bear)}"
        bull_reb = pool.submit(_rebut, "Bull", base, bear, findings) if bear else None
        bear_reb = pool.submit(_rebut, "Bear", base, bull, findings) if bull else None
        risk = pool.submit(_debater, RISK_SYSTEM, base + sides, findings)
        verdict = get("bottom_line", pool.submit(chat_json, SYNTH_SYSTEM, base + sides, Verdict, SYNTH_EXAMPLE, check=_advice_check), None)
        out = {
            "bottom_line": verdict.bottom_line if verdict else "",
            "bull_case": bull,
            "bear_case": bear,
            "bull_rebuttals": get("bull_rebuttals", bull_reb, []),  # bull answering the bear's arguments
            "bear_rebuttals": get("bear_rebuttals", bear_reb, []),  # bear answering the bull's arguments
            "risks": get("risks", risk, []),
            "what_to_watch": verdict.what_to_watch if verdict else [],
        }
    if errors:
        out["errors"] = errors  # partial briefing: shown, but not cached
    return out


# ---------- The pipeline: analysts (parallel) -> debate -> guardrail firewall, cached per day ----------

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
        out["briefing"] = debate(company, findings)
    except Exception as e:
        out["briefing"] = {"error": f"{type(e).__name__}: {e}"}
    out = guardrail.firewall(jsonable_encoder(out))  # nothing unverified or advisory leaves the server
    if not any(isinstance(v, dict) and ("error" in v or "errors" in v) for v in out.values()):  # only cache complete briefings
        cache.parent.mkdir(parents=True, exist_ok=True)
        cache.write_text(json.dumps(out, ensure_ascii=False), "utf-8")
    return out


