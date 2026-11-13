"use client";

import { motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Nav from "@/components/Nav";
import HeroCited from "@/components/HeroCited";
import { API, DEMO_STOCKS, type Blocked } from "@/lib/council";
import CountUp from "@/components/reactbits/CountUp";
import ScrollReveal from "@/components/reactbits/ScrollReveal";

// Apple's default UI spring: critically damped (no overshoot), ~0.4 s to settle.
const SPRING = { type: "spring", bounce: 0, duration: 0.45 } as const;

function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ ...SPRING, delay }}
    >
      {children}
    </motion.div>
  );
}

function StockPicker({ inputRef }: { inputRef: React.RefObject<HTMLInputElement | null> }) {
  const router = useRouter();
  const [ticker, setTicker] = useState("TCS");
  const go = (t = ticker) => {
    const k = t.trim().toUpperCase();
    if (k in DEMO_STOCKS) router.push(`/s/${k}`);
  };
  const valid = ticker.trim().toUpperCase() in DEMO_STOCKS;
  return (
    <form
      className="mt-9 max-w-xl"
      onSubmit={(e) => {
        e.preventDefault();
        go();
      }}
    >
      <div className="flex flex-wrap items-stretch gap-2 rounded-[22px] border border-line-2 bg-paper p-2 shadow-[0_10px_40px_-18px_rgb(27_24_53/0.35)]">
        <label htmlFor="ticker" className="sr-only">NSE ticker</label>
        <input
          ref={inputRef}
          id="ticker"
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          list="tickers"
          autoComplete="off"
          spellCheck={false}
          className="min-w-0 flex-1 rounded-2xl bg-transparent px-4 py-3 font-mono text-lg tracking-wide text-ink uppercase outline-none placeholder:text-muted"
          placeholder="TCS"
        />
        <datalist id="tickers">
          {Object.entries(DEMO_STOCKS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </datalist>
        <button type="submit" disabled={!valid} className="press inline-flex min-h-12 items-center gap-2 rounded-2xl bg-neel px-6 font-medium text-white hover:bg-neel-deep disabled:cursor-not-allowed disabled:opacity-50">
          Convene the council <span aria-hidden="true">→</span>
        </button>
      </div>
      {!valid && ticker.trim() && <p className="mt-2 text-sm text-firewall">Pick one of the six demo stocks below.</p>}
      <div className="mt-4 flex flex-wrap gap-2" role="list" aria-label="Demo stocks">
        {Object.entries(DEMO_STOCKS).map(([k, v]) => (
          <button
            key={k}
            type="button"
            role="listitem"
            onClick={() => {
              setTicker(k);
              go(k);
            }}
            title={v}
            className={`press min-h-11 rounded-full border px-4 font-mono text-sm ${
              ticker.toUpperCase() === k ? "border-neel bg-neel-tint text-neel" : "border-line-2 bg-paper text-ink-2 hover:border-neel/50 hover:text-ink"
            }`}
          >
            {k}
          </button>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted">
        A fresh council takes a few minutes on the live model. Briefings already written replay instantly.
      </p>
    </form>
  );
}

const ROUNDS = [
  {
    n: "01",
    title: "Research",
    who: "Fundamentals · Earnings call · News",
    body: "Three analysts read the latest annual report, the earnings-call transcript, five years of financials and a month of headlines, in parallel. Every finding quotes its source word for word, and the quote is checked in code.",
  },
  {
    n: "02",
    title: "Debate",
    who: "The Bull · The Bear",
    body: "Two debaters build the strongest case for and against, using only verified findings. Then each answers the other's arguments one by one.",
  },
  {
    n: "03",
    title: "Verdict",
    who: "Risk · Chief",
    body: "A risk analyst stress-tests both sides, and the Chief writes a balanced bottom line plus what to watch next. A firewall removes anything unverified or advisory before you see it.",
  },
];

type Totals = { passed: number; blocked: (Blocked & { ticker: string })[]; stocks: number; asOf: string };

/** The firewall's real record across the six cached briefings (GET /firewall reads files only, never runs a council). */
function useFirewall() {
  const [t, setT] = useState<Totals | null>(null);
  useEffect(() => {
    fetch(`${API}/firewall`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(({ stocks }: { stocks: { ticker: string; as_of: string; passed: number; blocked: Blocked[] }[] }) => {
        if (!stocks.length) return;
        setT({
          passed: stocks.reduce((n, s) => n + s.passed, 0),
          blocked: stocks.flatMap((s) => s.blocked.map((b) => ({ ...b, ticker: s.ticker }))),
          stocks: stocks.length,
          asOf: stocks.map((s) => s.as_of).sort().at(-1)!,
        });
      })
      .catch(() => {}); // no backend: the section still explains the firewall, just without numbers
  }, []);
  return t;
}

const where = (w: string) => w.replace(/^\./, "").replace(/^briefing\./, "").replace(/\..*$/, "").replace(/_/g, " ");
const reason = (r: string) => r.replace("number(s)", "number").replace(/^advice language: /, "reads like advice: ");

/** One of each kind of catch if the record has them (a made-up number, a quote not in its source, advice), up to three. */
function examples(blocked: Totals["blocked"]) {
  const kinds = [/number/, /quote|not found|verified/, /advice/];
  const picked = kinds.map((k) => blocked.find((b) => k.test(b.reason))).filter(Boolean) as Totals["blocked"];
  for (const b of blocked) if (picked.length < 3 && !picked.includes(b)) picked.push(b);
  return picked.slice(0, 3);
}

export default function Home() {
  const reduce = useReducedMotion();
  const fw = useFirewall();
  const tickerRef = useRef<HTMLInputElement>(null);
  return (
    <div className="paper">
      <Nav>
        <a href="#how" className="rounded-md hover:text-ink">How it works</a>
        <a href="#firewall" className="rounded-md hover:text-ink">The firewall</a>
      </Nav>

      <main>
        {/* ---------- hero ---------- */}
        <section className="relative mx-auto grid max-w-7xl items-center gap-6 px-4 pt-10 pb-16 sm:px-6 lg:min-h-[calc(100svh-64px)] lg:grid-cols-[1.05fr_1fr] lg:pt-4">
          <div className="relative z-10">
            <motion.p
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={SPRING}
              className="inline-flex items-center gap-2 rounded-full bg-paper/80 px-3 py-1.5 text-sm font-medium text-ink-2 ring-1 ring-line-2"
            >
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-haldi" />
              AI research desk for Indian stocks
            </motion.p>
            <motion.h1
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING, delay: 0.08 }}
              className="mt-6 text-[clamp(3rem,8.4vw,7.2rem)] leading-[0.95] font-bold tracking-[-0.03em] text-ink"
            >
              Every claim,
              <br />
              <span className="text-neel">
                <span className="highlight">cited.</span>
              </span>
            </motion.h1>
            <motion.p
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING, delay: 0.16 }}
              className="mt-7 max-w-xl text-lg leading-relaxed text-ink-2 sm:text-xl"
            >
              A council of AI analysts reads the annual report, the earnings call and the news, argues both sides, and
              hands you a balanced briefing. Every sentence links to the exact line it came from. No tips. Ever.
            </motion.p>
            <motion.div initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: 0.24 }}>
              <StockPicker inputRef={tickerRef} />
            </motion.div>
          </div>
          <div className="relative h-[500px] sm:h-[460px] lg:h-[520px]">
            <HeroCited />
          </div>
        </section>

        {/* ---------- marquee of sources (pauses under the pointer) ---------- */}
        <div className="group overflow-hidden border-y border-line bg-ink py-4 text-ground" aria-hidden="true">
          <div className="flex w-max animate-marquee gap-10 text-xl font-semibold tracking-[-0.011em] whitespace-nowrap group-hover:[animation-play-state:paused] sm:text-2xl">
            {Array.from({ length: 2 }).flatMap((_, k) =>
              ["Annual reports", "Earnings-call transcripts", "Five years of financials", "30 days of news", "Every claim cited", "No buy or sell calls", "Bull and Bear, both heard"].map((t, i) => (
                <span key={`${k}-${i}`} className="flex items-center gap-10">
                  {t}
                  <span className="inline-block h-2 w-8 rounded-full bg-haldi" />
                </span>
              )),
            )}
          </div>
        </div>

        {/* ---------- how it works ---------- */}
        <section id="how" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-24 sm:px-6 lg:py-32">
          <Reveal>
            <p className="kicker text-haldi-text">How the council works</p>
            <h2 className="mt-3 max-w-3xl text-[clamp(2.2rem,5vw,4rem)] leading-[1.04] font-bold tracking-[-0.025em]">
              Seven analysts. Three rounds. One balanced read.
            </h2>
          </Reveal>
          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {ROUNDS.map((r, i) => (
              <Reveal key={r.n} delay={i * 0.06}>
                <article className="relative h-full rounded-[28px] border border-line bg-paper p-7">
                  <span className="text-6xl font-bold tracking-[-0.03em] text-line-2 tabular-nums">{r.n}</span>
                  <h3 className="mt-6 text-2xl font-semibold tracking-[-0.018em]">{r.title}</h3>
                  <p className="mt-1 text-sm font-medium text-neel">{r.who}</p>
                  <p className="mt-4 leading-relaxed text-ink-2">{r.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ---------- the firewall: real numbers from the cached briefings ---------- */}
        <section id="firewall" className="scroll-mt-20 bg-ink py-24 text-ground lg:py-32">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr]">
            <Reveal>
              <p className="kicker text-haldi">The firewall</p>
              <h2 className="mt-3 text-[clamp(2.2rem,5vw,4rem)] leading-[1.04] font-bold tracking-[-0.025em]">
                Our own AI made things up. The firewall caught it.
              </h2>
              <p className="mt-6 max-w-lg text-lg leading-relaxed text-lilac">
                Before anything reaches you, code checks that every quote really is in its source, that every number in
                a claim appears in its evidence, and that nothing reads like a buy, sell or target-price call.
              </p>
              {fw && (
                <>
                  <div className="mt-10 flex gap-10">
                    <div>
                      <div className="text-6xl font-bold tracking-[-0.03em] tabular-nums"><CountUp to={fw.passed} from={Math.round(fw.passed * 0.8)} duration={1.2} /></div>
                      <div className="mt-1 text-sm text-lilac">statements passed</div>
                    </div>
                    <div>
                      <div className="text-6xl font-bold tracking-[-0.03em] text-haldi tabular-nums"><CountUp to={fw.blocked.length} duration={1.2} /></div>
                      <div className="mt-1 text-sm text-lilac">kept out</div>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-lilac/80">
                    Across the latest briefings for all {fw.stocks} demo stocks, up to{" "}
                    {new Date(fw.asOf).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}.
                  </p>
                </>
              )}
            </Reveal>
            <div className="flex flex-col gap-4">
              {fw &&
                examples(fw.blocked).map((b, i) => (
                  <Reveal key={i} delay={i * 0.06}>
                    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="text-lilac">
                          <span className="font-mono">{b.ticker}</span> · {where(b.where)}
                        </span>
                        <span className="rounded-full bg-firewall-tint px-3 py-1 text-caption font-medium text-firewall">{reason(b.reason)}</span>
                      </div>
                      <p className="mt-3 line-clamp-3 text-lg leading-snug text-ground/70 line-through decoration-firewall-tint/60 decoration-2">{b.text}</p>
                    </div>
                  </Reveal>
                ))}
              <Reveal delay={0.18}>
                <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                  <span className="text-sm text-lilac">Asked: “Should I buy TCS now? What&apos;s the target price?”</span>
                  <p className="mt-3 text-2xl font-semibold tracking-[-0.018em] text-ground">“No recommendation is given.”</p>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ---------- inform, don't advise ---------- */}
        <section className="mx-auto max-w-5xl px-4 py-28 text-center sm:px-6 lg:py-40">
          <Reveal>
            {/* React Bits ScrollReveal: each word sharpens in as you scroll, the haldi highlighter passing over it */}
            <ScrollReveal
              highlightColor="#D97706"
              baseOpacity={0.12}
              baseRotation={0}
              blurStrength={4}
              containerClassName="m-0!"
              textClassName="text-[clamp(2rem,4.6vw,3.8rem)]! leading-[1.1]! font-bold tracking-[-0.025em]"
            >
              Samiksha informs. It never advises. No ratings, no targets, no buy, sell or hold. Just both sides, with the receipts.
            </ScrollReveal>
            <button
              type="button"
              onClick={() => {
                window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
                tickerRef.current?.focus({ preventScroll: true });
              }}
              className="press mt-12 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-neel px-7 font-medium text-white hover:bg-neel-deep"
            >
              Pick a stock ↑
            </button>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-muted sm:px-6">
          <p>
            <strong className="font-semibold text-ink">Educational. Not investment advice.</strong> Samiksha is not a SEBI-registered adviser.
          </p>
          <p>Sources: BSE filings · company transcripts · Yahoo Finance · Google News</p>
        </div>
      </footer>
    </div>
  );
}
