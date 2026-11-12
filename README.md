# 🪔 Samiksha

### *Every stock, reviewed — both sides, with sources.*

**An AI research desk that reads a company's own filings, earnings calls and news, runs a council of AI analysts that argue the bull and bear case, and hands you a balanced, fully-sourced briefing — so you understand a stock before you invest.**

*It explains. It never tells you to buy or sell.*

<br>

![Status](https://img.shields.io/badge/status-building-F2A900?style=for-the-badge)
![Arthaton 2026](https://img.shields.io/badge/Arthaton-2026-0F2F2B?style=for-the-badge)
![Made in India](https://img.shields.io/badge/Made%20in-India%20🇮🇳-FF9933?style=for-the-badge)

![Python](https://img.shields.io/badge/Python-FastAPI-3776AB?style=flat-square&logo=python&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-React-000000?style=flat-square&logo=next.js&logoColor=white)
![Qwen](https://img.shields.io/badge/LLM-Qwen%203.8%2027B-6E56CF?style=flat-square)
![Cloudflare](https://img.shields.io/badge/Edge-Cloudflare-F38020?style=flat-square&logo=cloudflare&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)

</div>

---

> ### ⚠️ The problem
>
> India has **12+ crore investors** — most of them new. But a company's real story is buried in a **300-page annual report**, a **1-hour earnings call**, and scattered news. So people invest on tips and hype.
>
> **Samiksha turns a company's own primary sources into a briefing a normal person can actually read — and trust.**

---

## ✨ What makes Samiksha different


|                                |                                                                                                                               |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| 🧠**A council, not a chatbot** | Multiple AI agents each read a different source, then**debate the bull vs bear case** — you see both sides, not one opinion. |
| 🔗**Every claim is cited**     | Nothing is made up. Each point links back to the exact line in the annual report, transcript, or filing.                      |
| 🗣️**Plain English**          | Written for a first-time investor, not a CA. No jargon walls.                                                                 |
| ⚖️**No tips, by design**     | Samiksha gives**no buy/sell/target** — it informs, you decide. (This is also how it stays on the right side of SEBI rules.)  |
| 🪔**Built for India**          | NSE/BSE companies, Indian filings, Indian context — on the BharatCode Qwen model.                                            |

---

## 🏗️ How it works

```
1. Enter a stock  (NSE/BSE ticker or name)
        │
2. Data ingestion (public)   annual report · earnings call · news · financials
        │
3. Knowledge store (RAG)      chunk + embed → every answer is citable
        │
4. Analyst council            Fundamentals · Earnings-call · News & sentiment   (parallel)
        │
5. Bull ⇄ Bear debate + Risk  strongest case for · strongest case against · stress-test
        │
6. Chief synthesizer          one balanced briefing, every claim cited
        │
7. Compliance guardrail       no buy/sell/target · citations enforced (in code)
        │
8. Research briefing          both sides · sources · what to watch · disclaimer
```

---

## 🤖 The analyst council


| Agent                 | Reads                     | Produces                                                              |
| --------------------- | ------------------------- | --------------------------------------------------------------------- |
| **Fundamentals**      | Annual report, financials | Debt, margins, cash flow, promoter pledging, auditor notes, red flags |
| **Earnings-call**     | Latest concall transcript | Guidance, tone, promises-vs-delivery                                  |
| **News & sentiment**  | Recent news               | Material recent events                                                |
| **Bull** 🐂           | Everything (via RAG)      | The strongest**case for**, each point cited                           |
| **Bear** 🐻           | Everything (via RAG)      | The strongest**case against**, each point cited                       |
| **Risk**              | Bull + bear               | Stress-tests both sides                                               |
| **Chief synthesizer** | All of it                 | One balanced, cited briefing —**no verdict**                         |

All agents run on **Qwen 3.8 27B** via the **BharatCode** API.

---

## 🛠️ Tech stack

**AI** — Qwen 3.8 27B (BharatCode, OpenAI-compatible) · RAG with vector search
**Backend** — Python · FastAPI · async multi-agent orchestrator
**Frontend** — Next.js · Tailwind (streams the live debate)
**Infra** — Cloudflare (Pages · R2 · Vectorize · Workers AI) · Google Cloud Run · Neon Postgres · Upstash

> Full architecture, scaling and infra details → **[DEPLOYMENT.md](DEPLOYMENT.md)**
> Full product + market + business plan → **[PLAN.md](PLAN.md)**

---

## 🔐 SEBI-safe by design

Samiksha is built to **inform, not advise**. The output is a balanced briefing — bull case, bear case, risks, "what to watch" — with **no rating, no target, no buy/sell call**. A compliance guardrail in the code **blocks recommendation language and rejects any uncited claim** before you ever see it. Every briefing carries a clear *"Educational — not investment advice"* disclaimer.

---

## 🚀 Getting started

> 🚧 Under active construction for **Arthaton 2026**. Setup steps below are the intended flow.

```bash
# 1. Clone
git clone https://github.com/<your-username>/Samiksha.git
cd Samiksha

# 2. Backend
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # add your BHARATCODE_API_KEY and other keys

# 3. Run the API
uvicorn app.main:app --reload

# 4. Frontend (in a second terminal)
cd ../frontend
npm install
npm run dev
```

Then open `http://localhost:3000` and enter a stock.

---

## 🗺️ Roadmap

- [X]  Project plan + architecture + deployment design
- [ ]  Data ingestion + RAG store
- [ ]  The analyst council (agents + debate + synthesizer)
- [ ]  Compliance guardrail
- [ ]  Live-streaming "council debate" UI
- [ ]  Demo + deploy + submit (Arthaton 2026)
- [ ]  Public launch · accounts · watchlists · alerts

---

## 🏆 Built for Arthaton 2026 — and within its rules

Samiksha is an entry for **[Arthaton 2026](https://arthaton.com/)** and is built to respect the hackathon's rules:

- 🤖 **AI is the point.** Samiksha is powered by **Qwen 3.8 27B via the BharatCode API**. All AI models/APIs used are credited here in the README, as the rules require.
- 🧪 **No real financial data.** Samiksha uses only **public, sample, or synthetic market data** (public filings, transcripts, prices). It **never** stores or requires real bank details, passwords, PAN numbers, or broker API keys in this repository.
- 🚫 **No real trades.** Samiksha is a read-only research tool — it does **not** connect to a broker and **never places trades**. It informs; it does not transact.

---

## ⚠️ Disclaimer

Samiksha is an **educational research tool**. It does **not** provide investment advice or buy/sell recommendations, and nothing it produces should be treated as such. Always do your own research and consult a SEBI-registered professional before investing. All data shown comes from public sources and may contain errors.

---

<div align="center">

**Built with 🪔 for Arthaton 2026**

*Samiksha — because you deserve to understand your money.*

</div>
