"""Offline check of the spine: fake Qwen reply -> parsed -> /analyze JSON. Run: python test_spine.py"""
from types import SimpleNamespace

from fastapi.testclient import TestClient

from app import llm
from app.main import app

# Real failure seen live: Qwen echoes the schema object, then answers. Parser must skip to the valid object.
REPLY = '<think>hmm</think>{"$defs": {"x": {}}, "type": "object"}\n```json\n{"company":"TCS","points":[{"claim":"Revenue +9%","source":"[sample-synthetic-note]"}],"red_flags":[]}\n```'
calls = []


def fake_create(**kw):
    calls.append(kw)
    content = "not json" if len(calls) == 1 else REPLY  # first reply bad -> exercises retry
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])


llm.client.chat.completions.create = fake_create
c = TestClient(app)

r = c.post("/analyze", json={"ticker": " tcs "})
assert r.status_code == 200, r.text
assert r.json()["fundamentals"]["points"][0]["source"] == "sample-synthetic-note"
assert len(calls) == 2
assert c.post("/analyze", json={"ticker": "PUMPDUMP"}).status_code == 404

# Grounding check: a real quote is verified, a made-up one is not.
from app import rag

rag.search = lambda t, q, k=6: [{"source": "ar p.5", "url": "u#page=5", "text": "Total  Debt\nRs 9,000 crore"}]
REPLY = '{"answer":"x","evidence":[{"quote":"total debt rs 9,000 crore","source":"[ar p.5]"},{"quote":"Debt is zero","source":"ar p.5"}]}'
r = c.post("/ask", json={"ticker": "TCS", "question": "debt?"}).json()
assert [e["verified"] for e in r["evidence"]] == [True, False], r
assert r["evidence"][0]["url"] == "u#page=5"
print("spine ok")
