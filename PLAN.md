# Samiksha — Project Plan

> **Samiksha** (समीक्षा) means "critical review / analysis." Indians already say *film samiksha* and *pustak samiksha* (film review, book review) — so **"stock samiksha"** is instantly understood.
>
> **Tagline:** *Every stock, reviewed — both sides, with sources.*
>
> **One line:** Samiksha is an AI "research desk" that reads a company's own filings, earnings calls and news, runs a team of AI analysts that argue the bull and bear case, and hands you a balanced, fully-sourced briefing — so you understand a stock before you invest. It explains; it never tells you to buy or sell.

_Last updated: 2026-11-13_

---

## 1. Why this project exists (the problem)

India now has **over 12 crore unique investors** and **21+ crore demat accounts**, and a huge share of them are **first-time investors from smaller cities**. Most of them face the same wall:

- A company's real story is buried in a **300-page annual report**, a **1-hour earnings call**, and scattered news. Nobody has time to read all that.
- Existing apps mostly show **charts and numbers** ("what") but don't explain **what it means** ("so what").
- The honest analysis that does exist is either **paywalled, jargon-heavy, or trying to sell you a product**.

So people invest on tips, hype, and gut feeling. Samiksha turns the primary sources a company publishes about itself into a **plain-English, balanced briefing** that a normal person can actually read and trust.

---

## 2. Who it's for (customers)

| Segment | Who they are | What they want |
|---|---|---|
| **Primary — the new retail investor** | 22–40, tier-1/2/3 cities, SIP + a few direct stocks, not finance experts | "Just tell me, in simple words, is this company healthy and what are the risks?" |
| **Secondary — the serious DIY investor** | Reads Screener, does homework, wants to save time | A fast, sourced first-pass so they don't read the whole annual report cold |
| **Later — finance creators / advisors** | Need quick, cited research to build their own content/advice | A research assistant that cites everything |

The primary customer is the underserved beginner the big tools talk over. That's the wedge.

---

## 3. The market (why it's worth building)

- **12 crore** unique investors; **21.6 crore** demat accounts (Dec 2025).
- **5.9 crore** mutual-fund investors; **11 crore** SIP investors; **3.5 crore** of them from non–tier-1 cities.
- People already **pay for research tools**: StockEdge ₹399/month (₹3,999/yr), Trendlyne / Tickertape / Screener premium, etc. Willingness-to-pay of **₹200–1,400/month is proven**.
- The market grows every month (SIP inflows ₹28,000 crore/month and rising).

**Takeaway:** large, growing, and already used to paying — but the beginner-friendly, "explain it honestly" niche is wide open.

---

## 4. Competitors and where we fit

| Player | What they do | Gap Samiksha fills |
|---|---|---|
| Tickertape, Trendlyne, StockEdge, Screener | Screeners, charts, numbers, some reports | They show data; they don't *explain both sides in plain English with citations* |
| stockknocks.ai | AI fundamental analysis | Closest, but not a multi-agent debate / beginner-first briefing |
| Finfluencers / Telegram tips | Opinions, often biased, often paid | Samiksha is sourced, balanced, and sells you nothing |

**Our edge:** (1) a **multi-agent bull-vs-bear debate** instead of a one-sided summary, (2) **every claim cited** to the company's own documents, (3) **plain language**, and (4) we deliberately **give no buy/sell call** — which also keeps us on the right side of the law (see §5).

---

## 5. The regulation (SEBI) — and how we stay safe

India's market regulator (SEBI) updated its rules in 2024–2025. The key point for us:

- If a tool gives **recommendations** ("buy", "sell", "target price") it is doing **Research Analyst** work and needs **SEBI RA registration** (an exam + minimum net worth + compliance).
- If a tool **only informs and educates** — stating facts, explaining both sides, citing sources, and **not** telling you what to do — it stays largely **outside** that requirement.

**Samiksha is designed to sit firmly on the "information" side:**

- The output is a **balanced briefing**: bull case, bear case, risks, "what to watch" — **no rating, no target, no buy/sell**.
- A **compliance guardrail in the code** blocks any recommendation language and rejects any claim without a source, automatically, before the user sees it.
- Every briefing carries a clear **"Educational. Not investment advice."** disclaimer.

**Upgrade path:** If we later want to add explicit buy/sell calls or model portfolios, the founder registers as an **individual SEBI Research Analyst** (NISM Series-XV exam + ₹1 lakh net worth — doable solo). That becomes a *feature unlock*, not a launch blocker.

---

## 6. What the product does

### MVP (hackathon scope)
1. User enters an NSE/BSE company (ticker or name).
2. Samiksha fetches that company's **annual report, latest earnings-call transcript, recent news, and financials** (all public).
3. A **council of AI agents** reads it all and runs a **bull-vs-bear debate + risk check**.
4. User gets a **sourced research briefing**: both cases, key numbers, risks, "what to watch", disclaimer — with **clickable citations** back to the source.
5. The whole "council debating" process **streams live** on screen (the wow moment).

### Later (product)
- More agents (industry/peer comparison, macro).
- Saved watchlists, email/WhatsApp alerts on new filings.
- A wider universe of stocks, mutual funds, and re-runs when new reports drop.
- Accounts + freemium paywall.

---

## 7. How it works (architecture overview)

```
1. Enter a stock
        ↓
2. Data ingestion (public): annual report · earnings call · news · financials
        ↓
3. Knowledge store (RAG): chunk + embed + make searchable (every answer is citable)
        ↓
4. Analyst council (parallel agents): Fundamentals · Earnings-call · News & sentiment
        ↓
5. Bull vs Bear debate + Risk stress-test
        ↓
6. Chief synthesizer: merges into one balanced briefing, every claim cited
        ↓
7. Compliance guardrail: no buy/sell/target, citations required (enforced in code)
        ↓
8. Research briefing: both sides · sources · what to watch · disclaimer
```

"RAG" (Retrieval-Augmented Generation) just means: we store the company's documents, and whenever an agent makes a claim it must **pull the exact passage it's based on** — so nothing is made up.

---

## 8. The AI agents (the "council")

| Agent | Reads | Produces |
|---|---|---|
| **Fundamentals** | Annual report, financials | Revenue/margin trends, debt, cash flow, promoter pledging, auditor notes, related-party deals, red flags |
| **Earnings-call** | Latest concall transcript | Management guidance, tone, promises-vs-delivery |
| **News & sentiment** | Recent news | Material recent events, context |
| **Bull** | All of the above (via RAG) | The strongest **case for**, each point cited |
| **Bear** | All of the above (via RAG) | The strongest **case against**, each point cited |
| **Risk** | Bull + bear output | Stress-tests both sides, surfaces what could break |
| **Chief synthesizer** | Everything | One balanced, cited briefing — no verdict |

All agents run on **Qwen 3.8 27B via the BharatCode API** (the hackathon's provided model), using structured JSON output so the app can render it cleanly.

---

## 9. Data sources (all public)

| Data | Source | How we pull it |
|---|---|---|
| Price + financials | Yahoo Finance (`yfinance`, `.NS` tickers) | Free library, no key |
| Annual report (PDF) | Company IR page / BSE / Screener.in | Scrape link, parse PDF text |
| Earnings-call transcript | Screener.in / company site | Scrape + parse |
| News headlines | News search / RSS | Query by company name |

For the hackathon demo we **pre-cache 6–8 well-known stocks** so the live demo is instant and never waits on a flaky download — but the pipeline itself is generic and works for any listed company.

---

## 10. The output contract (our safety firewall)

The synthesizer must return structured data that the guardrail checks **before** the user sees it:

```json
{
  "company": "…",
  "as_of_date": "…",
  "bull_case":  [{ "claim": "…", "source": "…" }],
  "bear_case":  [{ "claim": "…", "source": "…" }],
  "key_numbers":[{ "metric": "…", "value": "…", "source": "…" }],
  "risks":      [{ "risk": "…", "source": "…" }],
  "what_to_watch": ["…"],
  "disclaimer": "Educational. Not investment advice."
}
```

The guardrail **rejects and regenerates** the response if: any claim has no `source`, **or** the text contains buy/sell/target/recommend/multibagger-type language. This keeps Samiksha legally safe *by construction*.

---

## 11. Tech stack (summary)

Full details, scaling, and free-tier limits are in **DEPLOYMENT.md**. In short:

- **AI model:** Qwen 3.8 27B via BharatCode (OpenAI-compatible).
- **Backend:** Python + FastAPI (the agent orchestration).
- **Frontend:** Next.js + Tailwind (streams the live debate).
- **Knowledge store:** vector database + embeddings (for RAG).
- **Infra:** scalable, free-tier-first, Cloudflare-heavy where it fits + a container backend for the Python agents (see DEPLOYMENT.md).

---

## 12. How we make money (monetization)

- **Freemium:** a few free briefings per month → paid plan for unlimited.
- **Target price:** ₹199–399/month (in line with what StockEdge/Tickertape already charge).
- **Later:** alerts, watchlists, and a "pro" tier; possibly a B2B/API tier for finance creators.
- Deliberately **no ads, no selling financial products** — trust is the moat.

---

## 13. Build roadmap

### Hackathon (10 days)
- **Days 1–2 — Spine:** scaffold backend + frontend, wire Qwen, one agent returns clean JSON end-to-end, pick 6 demo stocks.
- **Days 2–3 — Data + RAG:** ingest one stock (financials + annual report + concall + news) → chunk → embed → store; confirm sourced retrieval.
- **Days 3–5 — The council:** build the analyst agents, then bull/bear debate loop, risk agent, chief synthesizer, and the guardrail validator.
- **Days 6–7 — Frontend:** ticker input → **live streaming "council debate"** → briefing card with clickable citations, "what to watch", disclaimer.
- **Day 8 — Harden:** cache demo stocks, grounding checks, error handling, latency.
- **Days 9–10 — Ship:** README, deploy, record <5-min demo video, submit.

### After the hackathon (product)
- Broaden stock universe + auto re-run on new filings.
- Accounts, watchlists, alerts, freemium paywall.
- More agents (peer comparison, macro).
- Consider SEBI RA registration if adding explicit calls.

---

## 14. Risks and how we handle them

| Risk | Mitigation |
|---|---|
| AI makes things up (hallucination) | Citation-or-reject guardrail; agents may only assert what the documents actually say |
| Data download fails mid-demo | Pre-cached demo stocks; generic pipeline still shown |
| Multi-agent is slow | Stream the debate (turns latency into a feature), cache aggressively, cap debate rounds |
| Regulatory (SEBI) | Information-only output contract + guardrail + disclaimer; RA registration as a later unlock |
| Trust ("why believe the AI?") | Every claim links to the source document; we show both sides and give no verdict |

---

## 15. What success looks like

- **Hackathon:** a working end-to-end demo that makes judges feel "this is a real product," strong on the stated criteria (impact, AI use, works end-to-end, originality, demo).
- **Product (first 6 months):** live for the public, a growing free user base, first paying subscribers, and briefings people actually trust and share.

---

## Appendix — plain-English glossary

- **Agent:** one AI "worker" with a specific job (e.g., read the annual report).
- **Multi-agent:** several such workers cooperating/debating.
- **RAG (Retrieval-Augmented Generation):** the AI must fetch the real source passage before it answers, so it can't make things up.
- **Embedding / vector DB:** a way to store text so the AI can search it by meaning, not just keywords.
- **Concall:** earnings/analyst conference call a company holds after results.
- **SEBI:** India's stock-market regulator.
- **RA (Research Analyst):** a SEBI licence needed to publish stock recommendations.
