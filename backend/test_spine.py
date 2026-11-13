"""Offline check of the spine: fake Qwen + fake retrieval -> parsed, grounded API JSON. Run: python test_spine.py"""
from types import SimpleNamespace

from fastapi.testclient import TestClient

from app import llm, rag
from app.main import app

HITS = [{"source": "ar p.5", "url": "u#page=5", "text": "Total  Debt\nRs 9,000 crore"}]
rag.search = lambda t, q, k=6: HITS
replies, calls = [], []


def fake_create(**kw):
    calls.append(kw)
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=replies.pop(0)))])


llm.client.chat.completions.create = fake_create
c = TestClient(app)

# /analyze: bad first reply -> retry; Qwen echoes a schema object before the answer -> parser skips it.
replies[:] = ["not json", '<think>hmm</think>{"$defs": {}, "type": "object"}\n```json\n{"company":"TCS",'
              '"points":[{"claim":"Debt is Rs 9,000 crore","quote":"total debt rs 9,000 crore","source":"[ar p.5]"}],'
              '"red_flags":[{"claim":"made up","quote":"Debt is zero","source":"ar p.5"}]}\n```']
r = c.post("/analyze", json={"ticker": " tcs "})
assert r.status_code == 200, r.text
f = r.json()["fundamentals"]
assert len(calls) == 2
assert f["points"][0]["verified"] and f["points"][0]["url"] == "u#page=5" and f["points"][0]["source"] == "ar p.5"
assert not f["red_flags"][0]["verified"]  # quote not in the source -> not verified
assert f["not_found"] == []

# /ask: same grounding check.
replies[:] = ['{"answer":"x","evidence":[{"quote":"total debt rs 9,000 crore","source":"ar p.5"},{"quote":"Debt is zero","source":"ar p.5"}]}']
r = c.post("/ask", json={"ticker": "TCS", "question": "debt?"}).json()
assert [e["verified"] for e in r["evidence"]] == [True, False], r

assert c.post("/analyze", json={"ticker": "PUMPDUMP"}).status_code == 404
print("spine ok")
