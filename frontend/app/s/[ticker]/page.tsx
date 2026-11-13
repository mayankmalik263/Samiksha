"use client";

import { motion, useReducedMotion } from "motion/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Nav from "@/components/Nav";
import { AnalystCard, DebateColumn, Firewall, Verdict } from "@/components/council/Council";
import ReportDeck from "@/components/council/ReportDeck";
import Trace from "@/components/council/Trace";
import CountUp from "@/components/reactbits/CountUp";
import FoldText from "@/components/reactbits/FoldText";
import ShinyText from "@/components/reactbits/ShinyText";
import Stepper, { Step } from "@/components/reactbits/Stepper";
import { AGENTS, DEMO_STOCKS, progressOf, useCouncil, type AgentKey, type AgentState, type Phase } from "@/lib/council";

// WebGL only exists in the browser; the flat logo stands in while the scene loads.
const CouncilStage = dynamic(() => import("@/components/three/CouncilStage"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/samiksha-symbol.svg" alt="" className="h-40 w-auto opacity-80" />
    </div>
  ),
});

const EASE = [0.16, 1, 0.3, 1] as const;

const HEADLINE: Record<Phase, string> = {
  connecting: "Convening the council…",
  live: "The council is in session",
  replay: "Replaying today's briefing",
  done: "The briefing is ready",
  error: "The council couldn't finish",
};

const DOING: Partial<Record<AgentKey, string>> = {
  fundamentals: "Fundamentals is reading the annual report and five years of financials",
  earnings_call: "Earnings call is reading the concall transcript",
  news: "News is reading a month of headlines",
  bull_case: "The Bull is building the case for",
  bear_case: "The Bear is building the case against",
  bull_rebuttals: "The Bull is answering the Bear",
  bear_rebuttals: "The Bear is answering the Bull",
  risks: "Risk is stress-testing both sides",
  chief: "The Chief is weighing both sides",
};

/** How many verified findings or arguments each agent produced: the size of its quote burst on the stage. */
function countOf(key: AgentKey, s: AgentState): number {
  const d = s.data as Record<string, unknown> | unknown[] | undefined;
  if (!d) return 0;
  if (Array.isArray(d)) return d.length;
  if ("error" in d) return 0;
  const len = (k: string) => (Array.isArray(d[k]) ? (d[k] as unknown[]).length : 0);
  if (key === "fundamentals") return len("points") + len("red_flags");
  if (key === "earnings_call") return len("highlights") + len("guidance") + len("concerns");
  if (key === "news") return len("events");
  return 0;
}

function Elapsed({ t0, running }: { t0: number; running: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);
  const s = Math.max(0, Math.round((now - t0) / 1000));
  return <span className="font-mono tabular-nums">{Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")}</span>;
}

function Round({ n, title, note, children }: { n: string; title: string; note: string; children: React.ReactNode }) {
  return (
    <section className="mt-14 first:mt-0">
      <div className="mb-6 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="font-mono text-sm text-haldi-text">{n}</span>
        <h2 className="font-display text-3xl font-semibold tracking-[-0.02em]">
          {/* React Bits FoldText: the title folds open like the logo's corners */}
          <FoldText text={title} fontSize="1em" fontWeight="inherit" foldStyle="paper" hinge="top" stagger={0.05} duration={0.7} />
        </h2>
        <span className="text-sm text-muted">{note}</span>
      </div>
      {children}
    </section>
  );
}

function CouncilPage() {
  const reduce = useReducedMotion() ?? false;
  const { ticker: raw } = useParams<{ ticker: string }>();
  const ticker = decodeURIComponent(raw).toUpperCase();
  const rerun = useSearchParams().get("fresh") === "1";
  const known = ticker in DEMO_STOCKS;
  const st = useCouncil(known ? ticker : "", rerun);
  const a = st.agents;
  const running = st.phase === "live" || st.phase === "replay" || st.phase === "connecting";
  const doneCount = AGENTS.filter((x) => a[x.key].status === "done").length;
  const started = (round: number) => AGENTS.some((x) => x.round === round && a[x.key].status !== "waiting");
  const stage = st.phase === "done" ? 4 : started(3) ? 3 : started(2) ? 2 : 1;
  const counts = useMemo(() => Object.fromEntries(AGENTS.map((x) => [x.key, countOf(x.key, a[x.key])])) as Record<AgentKey, number>, [a]);
  const doing = AGENTS.filter((x) => a[x.key].status === "running").map((x) => DOING[x.key]);
  const [tab, setTab] = useState<"report" | "full">("report");
  const reportRef = useRef<HTMLDivElement>(null);

  if (!known)
    return (
      <div className="paper min-h-svh">
        <Nav />
        <main className="mx-auto max-w-3xl px-4 py-24 text-center">
          <h1 className="font-display text-4xl font-semibold">“{ticker}” isn&apos;t in the demo yet</h1>
          <p className="mt-4 text-ink-2">Try one of: {Object.keys(DEMO_STOCKS).join(", ")}.</p>
          <Link href="/" className="mt-8 inline-flex min-h-12 items-center rounded-2xl bg-neel px-6 font-medium text-white">Back home</Link>
        </main>
      </div>
    );

  return (
    <div className="paper min-h-svh">
      <Nav>
        <Link href="/" className="rounded-md hover:text-ink">Another stock</Link>
      </Nav>
      <main className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        {/* ---------- header ---------- */}
        <section className="flex flex-wrap items-end justify-between gap-6 pt-8">
          <div>
            <p className="font-mono text-sm text-muted">NSE · {ticker}</p>
            <h1 className="mt-2 font-display text-[clamp(2.2rem,5.4vw,4.2rem)] leading-[0.98] font-semibold tracking-[-0.04em]">{DEMO_STOCKS[ticker]}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-3" aria-live="polite">
              <span className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${st.phase === "error" ? "bg-firewall-tint text-firewall" : st.phase === "done" ? "bg-verified-tint text-verified" : "bg-neel-tint text-neel"}`}>
                <span aria-hidden="true" className={`h-2 w-2 rounded-full ${st.phase === "done" ? "bg-verified" : st.phase === "error" ? "bg-firewall" : "animate-blink bg-neel"}`} />
                {running ? <ShinyText text={HEADLINE[st.phase]} color="#4338CA" shineColor="#C7C3F4" speed={2.2} shineWidth={45} /> : HEADLINE[st.phase]}
              </span>
              {st.phase !== "error" && (
                <span className="text-sm text-ink-2">
                  <CountUp to={doneCount} duration={0.6} trigger="load" /> of {AGENTS.length} agents done · <Elapsed t0={st.t0} running={running} />
                </span>
              )}
            </div>
          </div>
          {/* React Bits Stepper as a status rail: Research -> Debate -> Verdict */}
          {st.phase !== "error" && (
            <Stepper step={stage} theme="light" accentColor="#4338CA" showFooter={false} disableStepIndicators frame={false} width={460} className="stepper-rail">
              <Step title="Research"><span /></Step>
              <Step title="Debate"><span /></Step>
              <Step title="Verdict"><span /></Step>
            </Stepper>
          )}
        </section>

        {st.phase === "error" && (
          <div className="mt-6 max-w-xl rounded-2xl border border-firewall/20 bg-firewall-tint/60 p-4 text-sm text-firewall">
            {st.error}
            <div className="mt-3">
              <a href={`/s/${ticker}`} className="font-medium underline">Try again</a>
            </div>
          </div>
        )}

        {/* ---------- the stage: the 3D mark (the Chief) with the council seated around it ---------- */}
        <section aria-label="The council at work" className="relative mt-8 overflow-hidden rounded-[36px] border border-line bg-gradient-to-b from-paper to-ground">
          <div className="h-[clamp(440px,68vh,720px)]">
            <CouncilStage agents={a} counts={counts} progress={progressOf(a)} done={st.phase === "done"} still={reduce} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line bg-paper/70 px-5 py-4 sm:px-7">
            <div className="min-h-12 max-w-2xl text-sm text-ink-2" aria-live="polite">
              {st.phase === "done" ? (
                <>The verdict is in. <span className="text-ink">Every page below is built from the findings that flew into the logo.</span></>
              ) : doing.length ? (
                doing.map((d) => <div key={d}>{d}…</div>)
              ) : st.phase === "connecting" ? (
                "Convening the council…"
              ) : (
                "Handing the verified findings to the next round…"
              )}
              {st.phase === "replay" && <div className="mt-1 text-xs text-muted">Replay of today&apos;s run (paced for viewing; same briefing, same sources).</div>}
            </div>
            {st.phase === "done" && (
              <motion.button
                type="button"
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: EASE }}
                onClick={() => {
                  setTab("report");
                  reportRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
                }}
                className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-neel px-6 font-medium text-white shadow-lg transition-colors hover:bg-neel-deep"
              >
                Read the report ↓
              </motion.button>
            )}
          </div>
        </section>

        {/* ---------- report / full briefing ---------- */}
        <div ref={reportRef} className="mt-14 scroll-mt-24">
          <div role="tablist" aria-label="How to read the briefing" className="mb-8 inline-flex rounded-2xl border border-line-2 bg-paper p-1">
            {(
              [
                ["report", "Report, page by page"],
                ["full", "Full briefing"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={`min-h-11 rounded-xl px-5 text-sm font-medium transition-colors ${tab === k ? "bg-ink text-ground" : "text-ink-2 hover:text-ink"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "report" ? (
            AGENTS.some((x) => a[x.key].status === "done") || running ? (
              <ReportDeck agents={a} ticker={ticker} running={running} council={st.council} />
            ) : null
          ) : (
            <>
              <Round n="01" title="Research" note="Three analysts, reading in parallel">
                <div className="grid gap-5 md:grid-cols-3">
                  {AGENTS.filter((x) => x.round === 1).map((x) => (
                    <AnalystCard key={x.key} k={x.key} name={x.name} role={x.role} mono={x.mono} s={a[x.key]} />
                  ))}
                </div>
              </Round>
              {(a.bull_case.status !== "waiting" || a.bear_case.status !== "waiting") && (
                <Round n="02" title="Debate" note="Built only from verified findings, then each side answers the other">
                  <div className="grid gap-10 md:grid-cols-2">
                    <DebateColumn side="bull" main={a.bull_case} replies={a.bull_rebuttals} />
                    <DebateColumn side="bear" main={a.bear_case} replies={a.bear_rebuttals} />
                  </div>
                </Round>
              )}
              {(a.chief.status !== "waiting" || a.risks.status !== "waiting") && (
                <Round n="03" title="Verdict" note="Balanced, never a buy or sell call">
                  <Verdict chief={a.chief} risks={a.risks} />
                </Round>
              )}
              <div className="mt-14 grid gap-5 lg:grid-cols-2">
                <Trace agents={a} t0={st.t0} phase={st.phase} replay={st.replay} />
                {st.council ? (
                  <Firewall council={st.council} />
                ) : (
                  <section className="rounded-[28px] border border-dashed border-line-2 p-6 text-sm text-muted">
                    The firewall report appears when the briefing is complete: every statement is checked against its source before it reaches you.
                  </section>
                )}
              </div>
            </>
          )}
        </div>

        {st.phase === "done" && (
          <p className="mt-12 text-center text-sm text-muted">
            Want a fresh read? <a href={`/s/${ticker}?fresh=1`} className="font-medium text-neel underline">Run a new council</a> (takes a few minutes).
          </p>
        )}
        <p className="mt-6 text-center text-sm font-medium text-ink-2">Educational. Not investment advice.</p>
      </main>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <CouncilPage />
    </Suspense>
  );
}
