"""Offline check of the whole pipeline: fake Qwen + fake retrieval -> grounded, firewalled API JSON.
Run: python test_spine.py   (and: python -m app.guardrail)"""
import tempfile
from pathlib import Path
from types import SimpleNamespace

from fastapi.testclient import TestClient

from app import guardrail, llm, rag
from app.main import app

rag.DATA = Path(tempfile.mkdtemp())  # never touch the real data/ (briefings get cached there)
HITS = [{"source": "ar p.5", "url": "u#page=5", "text": "Total  Debt\nRs 9,000 crore"}]
rag.load = lambda t: None
rag.search = lambda t, q, k=6, only=None: HITS
rag.docs = lambda t, only: [{"source": "news 2026-11-01", "url": "n1", "text": "2026-11-01: TCS wins big deal - ET"}]

replies: dict[str, list[str]] = {}  # agents run in parallel threads, so fake replies are queued per agent
calls = []


def who(system: str) -> str:
    if "rebutting" in system:
        return "Bull rebuttal" if "Bull analyst" in system else "Bear rebuttal"
    return next(a for a in ("Fundamentals", "Earnings-call", "News analyst", "Bull analyst", "Bear analyst",
                            "Risk analyst", "Chief synthesizer", "answer questions") if a in system)


def chunks(text: str):  # what a streamed completion yields
    return [SimpleNamespace(choices=[SimpleNamespace(delta=SimpleNamespace(content=text[i:i + 7]))]) for i in range(0, len(text), 7)]


def fake_create(**kw):
    assert kw["stream"] is True
    agent = who(kw["messages"][0]["content"])
    calls.append(agent)
    return chunks(replies[agent].pop(0))


# Stall handling: a stream that goes silent mid-way is retried, not fatal.
attempts = []


def stalling_create(**kw):
    attempts.append(1)
    if len(attempts) == 1:
        def gen():
            yield from chunks('{"half": ')
            raise llm.http.ReadTimeout("no tokens for 180s")
        return gen()
    return chunks('{"ok": true}')


llm.client.chat.completions.create = stalling_create
llm.time.sleep = lambda s: None
assert llm.complete([], {}) == '{"ok": true}' and len(attempts) == 2

# "Model unavailable" arrives mid-stream as a plain APIError (seen live) -> retried; a 401 is not.
import httpx2  # noqa: E402  (same HTTP library the SDK uses)
from openai import APIError, AuthenticationError  # noqa: E402

_req = httpx2.Request("POST", "https://x")
assert llm._retryable(APIError("Model unavailable.", _req, body=None))
assert not llm._retryable(AuthenticationError("bad key", response=httpx2.Response(401, request=_req), body=None))

llm.client.chat.completions.create = fake_create
c = TestClient(app)

FUND = ('{"company":"TCS","points":[{"claim":"Debt is Rs 9,000 crore","quote":"total debt rs 9,000 crore","ref":"[E1]"}],'
        '"red_flags":[{"claim":"made up","quote":"Debt is zero","ref":"E1"},'
        '{"claim":"bad ref","quote":"Rs 9,000 crore","ref":"E7"},'
        '{"claim":"Debt is Rs 9,500 crore","quote":"Rs 9,000 crore","ref":"E1"}]}')
EARN = '{"company":"TCS","guidance":[],"highlights":[],"concerns":[],"tone":{"claim":"calm","quote":"Rs 9,000 crore","ref":"E1"}}'
EARN_ADVICE = EARN.replace('"highlights":[]', '"highlights":[{"claim":"Investors should buy the stock","quote":"Rs 9,000 crore","ref":"E1"}]')
NEWS = '{"company":"TCS","events":[{"claim":"Won a deal","quote":"TCS wins big deal","ref":"E1"}],"overall":"positive"}'
BULL = ('{"arguments":[{"point":"Debt is only Rs 9,000 crore","refs":["F1"]},{"point":"ghost","refs":["F99"]},'
        '{"point":"Debt is Rs 1,234 crore","refs":["F1"]}]}')
BEAR = '{"arguments":[{"point":"Tone was calm","refs":["[F2]","F3"]}]}'
BULL_REB = '{"arguments":[{"answers":"A1","point":"Calm is fine","refs":["F2"]}]}'
BEAR_REB_ADVICE = '{"arguments":[{"answers":"A1","point":"TCS is a strong buy","refs":["F1"]}]}'
RISK = '{"arguments":[{"point":"Debt could rise","refs":["F1"]}]}'
SYNTH_ADVICE = '{"bottom_line":"Investors should buy the stock now.","what_to_watch":["Next quarter","Buy on dips"]}'
SYNTH = '{"bottom_line":"Balanced view.","what_to_watch":["Next quarter"]}'

# 1) Parsing retries, advice rewrites, invented numbers, firewall, one analyst failing -> nothing cached.
replies.update({
    "Fundamentals": ["not json", '<think>hmm</think>{"$defs": {}, "type": "object"}\n```json\n' + FUND + "\n```"],
    "Earnings-call": [EARN_ADVICE, EARN],             # advice -> one rewrite -> clean
    "News analyst": ["nope", "still nope"],           # fails twice -> this analyst errors, the rest carry on
    "Bull analyst": [BULL], "Bear analyst": [BEAR], "Bull rebuttal": [BULL_REB],
    "Bear rebuttal": [BEAR_REB_ADVICE, BEAR_REB_ADVICE],  # still advisory after rewrite -> firewall drops it
    "Risk analyst": [RISK], "Chief synthesizer": [SYNTH_ADVICE, SYNTH_ADVICE],
})
r = c.post("/analyze", json={"ticker": " tcs "})
assert r.status_code == 200, r.text
out = r.json()["council"]
assert calls.count("Fundamentals") == 2 and calls.count("Earnings-call") == 2
f = out["fundamentals"]
assert [p["claim"] for p in f["points"]] == ["Debt is Rs 9,000 crore"] and f["points"][0]["url"] == "u#page=5"
assert f["red_flags"] == []  # all three failed verification and were removed
reasons = " | ".join(b["reason"] for b in out["guardrail"]["blocked"])
for expected in ("quote not found", "doesn't exist (E7)", "9500 not in the cited source", "cites no verified finding",
                 "1234 not in the cited findings", "advice language"):
    assert expected in reasons, (expected, reasons)
assert out["earnings_call"]["tone"]["verified"] and out["earnings_call"]["highlights"] == []
assert "error" in out["news"]
b = out["briefing"]  # findings seen by the debate: F1 = debt point, F2 = tone
assert [a["point"] for a in b["bull_case"]] == ["Debt is only Rs 9,000 crore"]
assert b["bull_case"][0]["sources"][0]["url"] == "u#page=5"
assert len(b["bear_case"][0]["sources"]) == 1     # F2 resolves, F3 out of range ignored
assert b["bull_rebuttals"][0]["answers"] == "A1" and b["bear_rebuttals"] == []
assert b["risks"][0]["verified"]
assert b["bottom_line"] == guardrail.WITHHELD and b["what_to_watch"] == ["Next quarter"]
assert not list(rag.DATA.glob("*/briefing-*.json"))  # incomplete briefing not cached

# 2) A complete run is cached; the next request is served without any LLM call.
replies.update({"Fundamentals": [FUND], "Earnings-call": [EARN], "News analyst": [NEWS], "Bull analyst": [BULL],
                "Bear analyst": [BEAR], "Bull rebuttal": [BULL_REB], "Bear rebuttal": [BULL_REB],
                "Risk analyst": [RISK], "Chief synthesizer": [SYNTH]})
first = c.post("/analyze", json={"ticker": "TCS"}).json()["council"]
assert first["briefing"]["bottom_line"] == "Balanced view."
n = len(calls)
assert c.post("/analyze", json={"ticker": "TCS"}).json()["council"] == first
assert len(calls) == n  # cache hit

# 2b) The live stream: one firewalled event per agent as it lands, then the full briefing. Cached -> "cached" marker.
import json  # noqa: E402


def sse(r):
    return [json.loads(line[6:]) for line in r.text.splitlines() if line.startswith("data: ")]


ev = sse(c.get("/analyze/stream", params={"ticker": "tcs"}))
assert [e["type"] for e in ev] == ["hello", "cached", "done"] and ev[-1]["council"] == first
replies.update({"Fundamentals": [FUND], "Earnings-call": [EARN], "News analyst": [NEWS], "Bull analyst": [BULL],
                "Bear analyst": [BEAR], "Bull rebuttal": [BULL_REB], "Bear rebuttal": [BULL_REB],
                "Risk analyst": [RISK], "Chief synthesizer": [SYNTH]})
ev = sse(c.get("/analyze/stream", params={"ticker": "TCS", "fresh": True}))
done = {e["agent"]: e for e in ev if e["type"] == "agent" and e["status"] == "done"}
assert set(done) == {"fundamentals", "earnings_call", "news", "bull_case", "bear_case", "bull_rebuttals",
                     "bear_rebuttals", "risks", "chief"}, done.keys()
assert [a["point"] for a in done["bull_case"]["data"]] == ["Debt is only Rs 9,000 crore"]  # firewalled before streaming
assert done["fundamentals"]["data"]["red_flags"] == [] and ev[-1]["type"] == "done"
assert c.get("/analyze/stream", params={"ticker": "PUMPDUMP"}).status_code == 404

# 3) One debater failing (seen live: BharatCode 503) -> the rest of the debate still returns, flagged, not cached.
def flaky_create(**kw):
    if who(kw["messages"][0]["content"]) == "Bear analyst":
        raise RuntimeError("503 Model unavailable")
    return fake_create(**kw)


llm.client.chat.completions.create = flaky_create
replies.update({"Fundamentals": [FUND], "Earnings-call": [EARN], "News analyst": [NEWS], "Bull analyst": [BULL],
                "Bear rebuttal": [BULL_REB], "Risk analyst": [RISK], "Chief synthesizer": [SYNTH]})
for cached in rag.DATA.glob("*/briefing-*.json"):
    cached.unlink()
b = c.post("/analyze", json={"ticker": "TCS", "fresh": True}).json()["council"]["briefing"]
assert b["bull_case"] and b["bear_case"] == [] and b["bull_rebuttals"] == [] and b["bear_rebuttals"]
assert "503" in b["errors"]["bear_case"] and b["bottom_line"] == "Balanced view."
assert not list(rag.DATA.glob("*/briefing-*.json"))
llm.client.chat.completions.create = fake_create

# /ask: advice rewrite + grounding + firewall.
replies["answer questions"] = ['{"answer":"It is a strong buy","evidence":[]}',
                               '{"answer":"Debt is Rs 9,000 crore","evidence":[{"quote":"total debt rs 9,000 crore","ref":"E1"},{"quote":"Debt is zero","ref":"E1"}]}']
r = c.post("/ask", json={"ticker": "TCS", "question": "debt?"}).json()
assert r["answer"] == "Debt is Rs 9,000 crore" and len(r["evidence"]) == 1 and r["evidence"][0]["verified"], r
assert len(r["guardrail"]["blocked"]) == 1

# A broker's call quoted as "evidence" is never verified (seen live: "Buy TCS; target of Rs 2530: Geojit").
rag.search = lambda t, q, k=6, only=None: [{"source": "news 2026-10-15", "url": "n", "text": "Buy Tata Consultancy Services; target of Rs 2530: Geojit"}]
replies["answer questions"] = ['{"answer":"No recommendation is given.","evidence":[{"quote":"Buy Tata Consultancy Services; target of Rs 2530","ref":"E1"}]}']
r = c.post("/ask", json={"ticker": "TCS", "question": "Should I buy?"}).json()
assert r["evidence"] == [] and "third-party buy/sell call" in r["guardrail"]["blocked"][0]["reason"], r

assert c.post("/analyze", json={"ticker": "PUMPDUMP"}).status_code == 404

# The Chief's bottom line: a sentence with a number no finding contains is cut, and the firewall logs it.
from app import agents  # noqa: E402

fs = [agents.Finding(claim="Debt is Rs 9,000 crore", quote="Rs 9,000 crore", ref="E1", verified=True)]
kept, cut = agents._supported_sentences("Debt is Rs 9,000 crore. It rose 20% in a year. Watch margins.", fs)
assert kept == "Debt is Rs 9,000 crore. Watch margins." and "20" in cut[0]["reason"], (kept, cut)
fw = guardrail.firewall({"briefing": {"bottom_line": kept, "_blocked": cut}})
assert "_blocked" not in fw["briefing"] and fw["guardrail"]["blocked"][0]["where"] == ".briefing.bottom_line"
assert agents._verdict_check(fs)(agents.Verdict(bottom_line="Debt is 12% higher.", what_to_watch=[]))

# No briefing today -> the most recent one is served with its date, without any model call (demo-day safety).
old = rag.DATA / "INFY" / "briefing-2026-11-01.json"
old.parent.mkdir(parents=True, exist_ok=True)
old.write_text('{"briefing": {"bottom_line": "older"}, "guardrail": {"passed": 0, "blocked": []}}', "utf-8")
n = len(calls)
ev = sse(c.get("/analyze/stream", params={"ticker": "INFY"}))
assert ev[1] == {"type": "cached", "as_of": "2026-11-01"} and ev[-1]["council"]["as_of"] == "2026-11-01" and len(calls) == n
h = c.get("/health").json()
assert h["ok"] and h["latest_briefing"]["INFY"] == "2026-11-01" and h["latest_briefing"]["ITC"] is None

# No public transcript (ITC) -> an honest "unavailable", not a failure that would stop the briefing caching.
_search = rag.search
rag.search = lambda t, q, k=6, only=None: [] if only == "concall" else HITS
assert agents.earnings_call("ITC", "ITC").unavailable
rag.search = _search

# PDF text: the rupee glyph extracts as "H"; half-years ("H2 FY26") must survive; line breaks flow into sentences.
for raw, want in {"dividend of H 31/- per share": "dividend of ₹31/- per share", "(H612 crore)": "(₹612 crore)",
                  "drag in H2 FY26": "drag in H2 FY26", "manage-\nment expects": "management expects",
                  "operating\nmargin of 25.0%": "operating margin of 25.0%"}.items():
    assert rag.clean_pdf_text(raw) == want, (raw, rag.clean_pdf_text(raw))
print("spine ok")
