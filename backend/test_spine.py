"""Offline check of the spine: fake Qwen + fake retrieval -> parsed, grounded API JSON. Run: python test_spine.py"""
import tempfile
from pathlib import Path
from types import SimpleNamespace

from fastapi.testclient import TestClient

from app import llm, rag
from app.main import app

rag.DATA = Path(tempfile.mkdtemp())  # never touch the real data/ (briefings get cached there)
HITS = [{"source": "ar p.5", "url": "u#page=5", "text": "Total  Debt\nRs 9,000 crore"}]
rag.load = lambda t: None
rag.search = lambda t, q, k=6, only=None: HITS
rag.docs = lambda t, only: [{"source": "news 2026-11-01", "url": "n1", "text": "2026-11-01: TCS wins big deal - ET"}]

# Agents run in parallel threads, so fake replies are queued per agent (picked by its system prompt).
AGENTS = ("Fundamentals", "Earnings-call", "News analyst", "Chief synthesizer", "answer questions")
replies: dict[str, list[str]] = {}
calls = []


def fake_create(**kw):
    agent = next(a for a in AGENTS if a in kw["messages"][0]["content"])
    calls.append(agent)
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=replies[agent].pop(0)))])


llm.client.chat.completions.create = fake_create
c = TestClient(app)

FUND_OK = ('{"company":"TCS","points":[{"claim":"Debt is Rs 9,000 crore","quote":"total debt rs 9,000 crore","ref":"[E1]"}],'
           '"red_flags":[{"claim":"made up","quote":"Debt is zero","ref":"E1"},{"claim":"bad ref","quote":"Rs 9,000 crore","ref":"E7"}]}')
EARN_OK = '{"company":"TCS","guidance":[],"highlights":[],"concerns":[],"tone":{"claim":"calm","quote":"Rs 9,000 crore","ref":"E1"}}'
NEWS_OK = '{"company":"TCS","events":[{"claim":"Won a deal","quote":"TCS wins big deal","ref":"E1"}],"overall":"positive"}'
SYNTH_OK = ('{"bottom_line":"Balanced.","bull_case":[{"point":"Low debt","refs":["F1"]},{"point":"ghost","refs":["F99"]}],'
            '"bear_case":[{"point":"Calm tone","refs":["[F2]","F3"]}],"risks":[],"what_to_watch":["Next quarter"]}')

# 1) Retry + schema-echo parsing; one analyst fails -> others + briefing still return; nothing cached.
replies.update({
    "Fundamentals": ["not json", '<think>hmm</think>{"$defs": {}, "type": "object"}\n```json\n' + FUND_OK + "\n```"],
    "Earnings-call": [EARN_OK],
    "News analyst": ["nope", "still nope"],
    "Chief synthesizer": [SYNTH_OK],
})
r = c.post("/analyze", json={"ticker": " tcs "})
assert r.status_code == 200, r.text
council = r.json()["council"]
f = council["fundamentals"]
assert calls.count("Fundamentals") == 2
assert f["points"][0]["verified"] and f["points"][0]["source"] == "ar p.5" and f["points"][0]["url"] == "u#page=5"
assert not f["red_flags"][0]["verified"]                              # quote not in the excerpt
assert not f["red_flags"][1]["verified"] and f["red_flags"][1]["source"] == ""  # E7 doesn't exist
assert council["earnings_call"]["tone"]["verified"]                    # single (non-list) findings verified too
assert "error" in council["news"]
b = council["briefing"]  # synthesizer saw only verified findings: F1 = debt point, F2 = tone
assert [p["point"] for p in b["bull_case"]] == ["Low debt"]           # point citing only F99 dropped
assert b["bull_case"][0]["sources"][0]["url"] == "u#page=5"
assert len(b["bear_case"][0]["sources"]) == 1                          # F2 resolves, F3 out of range ignored
assert not list(rag.DATA.glob("*/briefing-*.json"))                    # incomplete briefing not cached

# 2) Complete run is cached; the next request is served without any LLM call.
replies.update({"Fundamentals": [FUND_OK], "Earnings-call": [EARN_OK], "News analyst": [NEWS_OK], "Chief synthesizer": [SYNTH_OK]})
assert "error" not in c.post("/analyze", json={"ticker": "TCS"}).json()["council"]["news"]
n = len(calls)
assert c.post("/analyze", json={"ticker": "TCS"}).json()["council"]["news"]["overall"] == "positive"
assert len(calls) == n  # cache hit

# /ask: same grounding check.
replies["answer questions"] = ['{"answer":"x","evidence":[{"quote":"total debt rs 9,000 crore","ref":"E1"},{"quote":"Debt is zero","ref":"E1"}]}']
r = c.post("/ask", json={"ticker": "TCS", "question": "debt?"}).json()
assert [e["verified"] for e in r["evidence"]] == [True, False], r

assert c.post("/analyze", json={"ticker": "PUMPDUMP"}).status_code == 404
print("spine ok")
