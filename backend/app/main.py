from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import agents, guardrail

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


class AskRequest(BaseModel):
    ticker: str
    question: str


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
