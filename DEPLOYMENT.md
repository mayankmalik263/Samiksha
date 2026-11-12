# Samiksha — Deployment & Infrastructure

_How Samiksha is built to run: scalable from day one, mostly on free tiers, and able to grow to paying tiers **without a rewrite**._

_Last updated: 2026-11-13_

---

## 1. Design goals

1. **Scalable by architecture, not by luck.** Every piece can scale independently and the compute-heavy part (the AI agents) is decoupled behind a queue, so traffic spikes don't take the app down.
2. **Free-tier-first, scale-ready.** Everything here has a generous free tier for launch, and a clear paid tier it grows into — no migration later.
3. **Cloudflare where it is genuinely the best tool** (edge, static hosting, object storage, vector search, embeddings), and a real **container platform for the Python agents** (which cannot run on Cloudflare Workers).
4. **Stateless workers.** No state lives in the app servers — all state is in managed data services — so we can add/remove workers freely.

> **Why not "just Vercel/Render"?** Those are fine for a simple web app, but Samiksha's core is a **long-running, bursty, compute-heavy multi-agent pipeline**. That needs a real job queue + autoscaling container workers, plus a vector DB and object storage. The stack below is built for that.

---

## 2. The stack at a glance

| Layer | Technology | Free tier | Scales to |
|---|---|---|---|
| **DNS, CDN, WAF, rate-limiting** | **Cloudflare** | Free | Enterprise, unlimited |
| **Frontend hosting** | **Cloudflare Pages** (Next.js) | Free, unlimited requests | Global edge |
| **Backend API + agent workers** | **Google Cloud Run** (Docker, Python/FastAPI) | Generous free tier, scales to zero | Thousands of concurrent, autoscaled |
| **LLM** | **Qwen 3.8 27B via BharatCode** (OpenAI-compatible) | 10M tokens/day (student) | Pluggable to any OpenAI-compatible model |
| **Embeddings** | **Cloudflare Workers AI** (`bge` models) | Free daily allowance | Pay-per-use, no servers |
| **Vector database** | **Cloudflare Vectorize** | Free tier | Millions of vectors |
| **Relational database** | **Neon** (serverless Postgres) | Free tier, branching | Autoscaling Postgres |
| **Object storage (PDFs, cached briefings)** | **Cloudflare R2** | Free tier, **zero egress fees** | Unlimited |
| **Job queue + cache + rate limits** | **Upstash** (serverless Redis / QStash) | Free tier | Pay-per-request |
| **Auth** | **Clerk** (or Supabase Auth) | Free up to ~10k MAU | Paid tiers |
| **CI/CD** | **GitHub Actions** | Free for public repos | — |
| **Error monitoring** | **Sentry** | Free tier | Paid tiers |
| **Product analytics** | **PostHog** (or Cloudflare Web Analytics) | Free tier | Paid tiers |
| **Containerization** | **Docker** | — | — |

Everything above has a free tier that comfortably covers a hackathon + early launch, and a paid tier it upgrades into with no code change.

---

## 3. Why each choice

- **Cloudflare (edge + Pages + R2 + Vectorize + Workers AI):** one platform for the "fast, global, cheap" layer. Pages serves the frontend from 300+ cities; R2 stores PDFs with **no egress fees** (important when serving/caching documents); Vectorize + Workers AI give us **managed vector search and embeddings without running a GPU or a vector server**. This is Cloudflare used *where it's actually best*.
- **Google Cloud Run for the Python backend:** Cloudflare Workers can't run our long-running, library-heavy Python agents. Cloud Run runs our Docker container, **autoscales on demand, scales to zero when idle** (so idle cost ≈ ₹0), and allows long request/processing times. It's the most scalable option with a genuine free tier.
- **Neon (serverless Postgres):** stores users, saved briefings, watchlists, usage. Serverless = scales up/down automatically, has DB branching for safe testing, free tier for launch.
- **Upstash (queue + cache):** the AI pipeline is decoupled — the API **enqueues** an analysis job and returns immediately; a **worker** processes it. This is what makes the app survive spikes. Upstash is serverless (pay per request), free tier, no Redis server to manage.
- **BharatCode Qwen** is the required model, but the code uses the **OpenAI-compatible interface**, so we can swap or add models (fallbacks) with a config change.

---

## 4. Architecture for scale (request flow)

```
                    ┌─────────────── Cloudflare (DNS · CDN · WAF · rate-limit) ───────────────┐
   Browser ───────▶ │  Cloudflare Pages (Next.js frontend)                                     │
                    └───────────────────────────────┬─────────────────────────────────────────┘
                                                     │  POST /analyze?ticker=…
                                                     ▼
                                   ┌──────────── API (Cloud Run, FastAPI) ────────────┐
                                   │  • check cache (Neon/R2): briefing exists today?  │
                                   │  • if not → enqueue job (Upstash) → return job_id │
                                   └───────────────────────────┬───────────────────────┘
                                                               │ (job)
                                                               ▼
                                   ┌──────────── Worker (Cloud Run, autoscaled) ───────┐
                                   │  1. Ingest: fetch report/concall/news/financials  │
                                   │     → store PDFs in R2                             │
                                   │  2. Embed (Workers AI) → upsert to Vectorize       │
                                   │  3. Run agent council (Qwen via BharatCode)        │
                                   │  4. Bull/Bear debate + Risk + Chief synthesizer    │
                                   │  5. Compliance guardrail (no buy/sell, cite-check) │
                                   │  6. Save briefing → Neon + R2                      │
                                   │     push live progress → client (SSE/WebSocket)    │
                                   └───────────────────────────────────────────────────┘
```

**Why this scales:**
- The **queue decouples** the fast web layer from the slow AI layer — a traffic spike fills the queue instead of crashing the app.
- **Workers are stateless and autoscale** on Cloud Run — add more under load, scale to zero when idle.
- **Vectorize, Neon, R2, Upstash each scale on their own** — no single bottleneck.
- **Caching**: a briefing for (ticker, date) is computed once and reused — most reads never hit the AI pipeline at all.

---

## 5. Environments

| Environment | Frontend | Backend | Data |
|---|---|---|---|
| **Local dev** | `next dev` | `uvicorn` + Docker Compose | Neon dev branch, local/Upstash |
| **Staging** | Cloudflare Pages (preview) | Cloud Run (staging service) | Neon branch, separate Vectorize index |
| **Production** | Cloudflare Pages (prod) | Cloud Run (prod service) | Neon main, prod indexes |

Neon database **branching** gives each environment (and each PR) its own isolated copy of the data safely.

---

## 6. CI/CD (GitHub Actions)

On push to `main`:
1. Lint + test (backend: `pytest`/`ruff`; frontend: `eslint`/typecheck).
2. Build the backend **Docker image** → deploy to **Cloud Run**.
3. Build the frontend → deploy to **Cloudflare Pages**.
4. Run DB migrations against Neon.

Pull requests get a **preview deploy** (Cloudflare Pages preview + Cloud Run revision + Neon branch) so every change is testable in isolation.

---

## 7. Secrets & configuration

Secrets live in **GitHub Actions secrets** + the platform's own secret store (Cloud Run secrets, Cloudflare environment variables) — **never in the repo**.

Core environment variables:

```
# LLM
BHARATCODE_API_KEY=
LLM_BASE_URL=https://bharatcode.ai/api/model/v1
LLM_MODEL=qwen-3.8-27b

# Data
NEON_DATABASE_URL=
UPSTASH_REDIS_URL=
UPSTASH_REDIS_TOKEN=

# Cloudflare
CF_ACCOUNT_ID=
CF_API_TOKEN=
VECTORIZE_INDEX=
R2_BUCKET=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
WORKERS_AI_TOKEN=

# Auth / monitoring
CLERK_SECRET_KEY=
SENTRY_DSN=
```

A `.env.example` (committed) lists every variable with blank values; a real `.env` (git-ignored) holds the actual secrets locally.

---

## 8. Security

- All traffic HTTPS, behind Cloudflare WAF + rate-limiting (protects against abuse and scraping of our own endpoint).
- **No secrets in the repo** (it's public). `.gitignore` covers `.env`, keys, caches.
- Per-user and per-IP rate limits on the expensive `/analyze` endpoint (Upstash).
- The BharatCode key stays **server-side only** (never shipped to the browser).
- Input validation on the ticker; only known/listed symbols are accepted.

---

## 9. Observability

- **Sentry** for backend + frontend errors.
- **Structured logs** from Cloud Run (searchable in Google Cloud Logging).
- **PostHog** for product analytics (which stocks are searched, funnel, retention).
- Per-request **token + cost tracking** on LLM calls, so we always know unit economics.

---

## 10. Scaling playbook (what to do as we grow)

| When | Do |
|---|---|
| Launch / hackathon | Everything on free tiers; pre-cache demo stocks |
| First real users | Turn on caching + rate limits; monitor LLM token cost per briefing |
| Traffic grows | Raise Cloud Run max instances; move to Upstash/Neon paid tiers (no code change) |
| Heavy repeat reads | Lean harder on cached briefings + R2/CDN; most reads never touch the AI |
| Cost optimisation | Batch embeddings; cache RAG chunks per company; cap debate rounds; add a cheaper model fallback for simple stages |

---

## 11. Open decisions (to confirm later)

- **Auth provider:** Clerk (fastest) vs Supabase Auth (bundles Postgres) — pick when we add accounts.
- **Frontend on Pages via OpenNext** vs a lighter Vite SPA — decide at frontend build time based on how much server-rendering we need.
- **Embeddings:** Cloudflare Workers AI (managed) is default; `sentence-transformers` in the container is the offline fallback.
- **Model fallback:** add a second OpenAI-compatible model (e.g. DeepSeek via BharatCode) for resilience/cost once past MVP.
