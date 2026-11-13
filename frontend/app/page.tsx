"use client";

import { motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import Nav from "@/components/Nav";
import Mark3D from "@/components/three/Mark3D";
import { DEMO_STOCKS } from "@/lib/council";
import { GLOW } from "@/components/council/Council";
import BorderGlow from "@/components/reactbits/BorderGlow";
import CountUp from "@/components/reactbits/CountUp";
import FoldText from "@/components/reactbits/FoldText";
import ScrollReveal from "@/components/reactbits/ScrollReveal";
import VariableProximity from "@/components/reactbits/VariableProximity";

const EASE = [0.16, 1, 0.3, 1] as const;

function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 28, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.9, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

function StockPicker() {
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
        <button
          type="submit"
          disabled={!valid}
          className="group inline-flex min-h-12 items-center gap-2 rounded-2xl bg-neel px-6 font-medium text-white transition-[background-color,transform] duration-300 hover:bg-neel-deep active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Convene the council
          <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
        </button>
      </div>
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
            className={`min-h-11 rounded-full border px-4 font-mono text-sm transition-colors ${
              ticker.toUpperCase() === k ? "border-neel bg-neel-tint text-neel" : "border-line-2 bg-paper text-ink-2 hover:border-neel/50 hover:text-ink"
            }`}
          >
            {k}
          </button>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted">
        A fresh council takes a few minutes on the live model. Briefings already written today replay instantly.
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

const BLOCKED = [
  { where: "Fundamentals", text: "Promoter Tata Sons holds 71.74% of shares with no change during the year.", reason: "quote not found in the cited source" },
  { where: "Bear case", text: "Total debt rose to Rs 11,283 crore from Rs 9,392 crore, a notable increase even as net income…", reason: "number 1.4 not in the cited findings" },
  { where: "Risk", text: "The bull argument for robust balance sheet strength is weakened by the 20% increase in total debt…", reason: "numbers 1.4 and 20 not in the cited findings" },
];

export default function Home() {
  const reduce = useReducedMotion();
  const words = ["Every", "claim,"];
  const heroRef = useRef<HTMLHeadingElement>(null);
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
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE }}
              className="inline-flex items-center gap-2 rounded-full border border-line-2 bg-paper/80 px-3 py-1.5 text-xs font-medium tracking-wide text-ink-2"
            >
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-haldi" />
              AI research desk for Indian stocks
            </motion.p>
            <h1 ref={heroRef} className="mt-6 font-display text-[clamp(3rem,8.4vw,7.2rem)] leading-[0.92] font-semibold tracking-[-0.045em] text-ink">
              {words.map((w, i) => (
                <motion.span
                  key={w}
                  className="mr-[0.22em] inline-block"
                  initial={reduce ? false : { opacity: 0, y: "0.5em", rotateX: -40 }}
                  animate={{ opacity: 1, y: 0, rotateX: 0 }}
                  transition={{ duration: 1, delay: 0.15 + i * 0.1, ease: EASE }}
                >
                  {/* React Bits VariableProximity: letters thicken toward the cursor (Space Grotesk's weight axis) */}
                  <VariableProximity
                    label={w}
                    containerRef={heroRef}
                    fromFontVariationSettings="'wght' 560"
                    toFontVariationSettings="'wght' 700"
                    radius={170}
                    falloff="gaussian"
                    smoothing={0.25}
                    idleWave
                  />
                </motion.span>
              ))}
              <br />
              <motion.span
                className="inline-block text-neel"
                initial={reduce ? false : { opacity: 0, y: "0.5em", rotateX: -40 }}
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                transition={{ duration: 1, delay: 0.38, ease: EASE }}
              >
                <span className="highlight">cited.</span>
              </motion.span>
            </h1>
            <motion.p
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.55, ease: EASE }}
              className="mt-7 max-w-xl text-lg leading-relaxed text-ink-2 sm:text-xl"
            >
              A council of AI analysts reads the annual report, the earnings call and the news, argues both sides, and
              hands you a balanced briefing. Every sentence links to the exact line it came from. No tips. Ever.
            </motion.p>
            <motion.div initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.7, ease: EASE }}>
              <StockPicker />
            </motion.div>
          </div>
          <div className="relative -mx-4 h-[380px] sm:mx-0 sm:h-[520px] lg:h-[680px]">
            <Mark3D mode="hero" className="absolute inset-0" />
          </div>
        </section>

        {/* ---------- marquee of sources ---------- */}
        <div className="overflow-hidden border-y border-line bg-ink py-4 text-ground" aria-hidden="true">
          <div className="flex w-max animate-marquee gap-10 font-display text-xl font-medium whitespace-nowrap sm:text-2xl">
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
            <p className="font-mono text-sm text-haldi-text">How the council works</p>
            <h2 className="mt-3 max-w-3xl font-display text-[clamp(2.2rem,5vw,4rem)] leading-[1.02] font-semibold tracking-[-0.035em]">
              <FoldText text="Seven analysts. Three rounds. One balanced read." splitBy="word" trigger="scroll" fontSize="1em" fontWeight="inherit" stagger={0.06} duration={0.8} />
            </h2>
          </Reveal>
          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {ROUNDS.map((r, i) => (
              <Reveal key={r.n} delay={i * 0.12}>
                <BorderGlow {...GLOW} borderRadius={28} className="h-full">
                <article className="group relative h-full overflow-hidden p-7">
                  <span className="font-display text-7xl font-semibold tracking-tighter text-line-2 transition-colors duration-500 group-hover:text-neel/25">{r.n}</span>
                  <h3 className="mt-6 font-display text-2xl font-semibold">{r.title}</h3>
                  <p className="mt-1 font-mono text-xs text-neel">{r.who}</p>
                  <p className="mt-4 leading-relaxed text-ink-2">{r.body}</p>
                  <span aria-hidden="true" className="absolute right-7 bottom-7 h-2 w-14 origin-left scale-x-50 rounded-full bg-haldi transition-transform duration-700 group-hover:scale-x-100" />
                </article>
                </BorderGlow>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ---------- the firewall ---------- */}
        <section id="firewall" className="scroll-mt-20 bg-ink py-24 text-ground lg:py-32">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr]">
            <Reveal>
              <p className="font-mono text-sm text-haldi">The firewall</p>
              <h2 className="mt-3 font-display text-[clamp(2.2rem,5vw,4rem)] leading-[1.02] font-semibold tracking-[-0.035em]">
                <FoldText text="Our own AI made things up. The firewall caught it." splitBy="word" trigger="scroll" fontSize="1em" fontWeight="inherit" stagger={0.06} duration={0.8} />
              </h2>
              <p className="mt-6 max-w-lg text-lg leading-relaxed text-lilac">
                Before anything reaches you, code checks that every quote really is in its source, that every number in
                a claim appears in its evidence, and that nothing reads like a buy, sell or target-price call.
              </p>
              <div className="mt-10 flex gap-10">
                <div>
                  <div className="font-display text-6xl font-semibold tracking-tight"><CountUp to={40} mode="roll" duration={1.6} easing="spring" replayOnHover /></div>
                  <div className="mt-1 text-sm text-lilac">statements passed</div>
                </div>
                <div>
                  <div className="font-display text-6xl font-semibold tracking-tight text-haldi"><CountUp to={3} mode="roll" duration={1.6} delay={0.2} easing="spring" replayOnHover /></div>
                  <div className="mt-1 text-sm text-lilac">blocked</div>
                </div>
              </div>
              <p className="mt-3 font-mono text-xs text-lilac/80">From the TCS briefing, 13 Nov 2026</p>
            </Reveal>
            <div className="flex flex-col gap-4">
              {BLOCKED.map((b, i) => (
                <Reveal key={i} delay={i * 0.12}>
                  <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-xs text-lilac">{b.where}</span>
                      <span className="rounded-full bg-haldi/15 px-3 py-1 font-mono text-xs text-[#FBBF24]">blocked · {b.reason}</span>
                    </div>
                    <p className="mt-3 text-lg leading-snug text-ground/70 line-through decoration-haldi decoration-2">{b.text}</p>
                  </div>
                </Reveal>
              ))}
              <Reveal delay={0.36}>
                <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                  <span className="font-mono text-xs text-lilac">Asked: “Should I buy TCS now? What&apos;s the target price?”</span>
                  <p className="mt-3 font-display text-2xl text-ground">“No recommendation is given.”</p>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ---------- inform, don't advise ---------- */}
        <section className="mx-auto max-w-5xl px-4 py-28 text-center sm:px-6 lg:py-40">
          <Reveal>
            {/* React Bits ScrollReveal: each word sharpens in as you scroll, flashing haldi on the way */}
            <ScrollReveal
              highlightColor="#D97706"
              baseOpacity={0.12}
              baseRotation={2}
              blurStrength={5}
              containerClassName="m-0!"
              textClassName="font-display text-[clamp(2rem,4.6vw,3.8rem)]! leading-[1.08]! font-semibold tracking-[-0.03em]"
            >
              Samiksha informs. It never advises. No ratings, no targets, no buy, sell or hold. Just both sides, with the receipts.
            </ScrollReveal>
            <a
              href="#top"
              onClick={(e) => {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
              }}
              className="mt-12 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-neel px-7 font-medium text-white transition-colors hover:bg-neel-deep"
            >
              Pick a stock ↑
            </a>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-muted sm:px-6">
          <p>
            <strong className="font-semibold text-ink">Educational. Not investment advice.</strong> Samiksha is not a SEBI-registered adviser.
          </p>
          <p className="font-mono text-xs">Sources: BSE filings · company transcripts · Yahoo Finance · Google News</p>
        </div>
      </footer>
    </div>
  );
}
