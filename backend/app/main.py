from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import agents

# Demo universe (NSE). Only these are accepted until ingestion is generic.
DEMO_STOCKS = {
    "RELIANCE": "Reliance Industries",
    "TCS": "Tata Consultancy Services",
    "HDFCBANK": "HDFC Bank",
    "INFY": "Infosys",
    "ITC": "ITC",
    "ADANIENT": "Adani Enterprises",
}

# ponytail: hard-coded synthetic doc for the Day 1 spine; Day 2 replaces it with real ingestion + RAG.
SAMPLE_DOCS = [{
    "source": "sample-synthetic-note",
    "text": "SYNTHETIC SAMPLE (not real data). Revenue grew 9% year on year to Rs 1,000 crore. "
            "Operating margin fell from 21% to 18%. Net debt rose to Rs 300 crore. "
            "Promoters have pledged 4% of their holding. The auditor flagged no qualifications.",
}]

app = FastAPI(title="Samiksha")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"], allow_methods=["*"], allow_headers=["*"])


class AnalyzeRequest(BaseModel):
    ticker: str


@app.get("/stocks")
def stocks():
    return DEMO_STOCKS


@app.post("/analyze")
def analyze(req: AnalyzeRequest):
    ticker = req.ticker.strip().upper()
    if ticker not in DEMO_STOCKS:
        raise HTTPException(404, f"Unknown ticker. Try one of: {', '.join(DEMO_STOCKS)}")
    try:
        result = agents.fundamentals(DEMO_STOCKS[ticker], SAMPLE_DOCS)
    except Exception as e:
        raise HTTPException(502, f"LLM call failed: {e}")
    return {"ticker": ticker, "fundamentals": result, "disclaimer": "Educational. Not investment advice."}
