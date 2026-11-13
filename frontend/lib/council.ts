"use client";

import { useEffect, useRef, useState } from "react";

export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const DEMO_STOCKS: Record<string, string> = {
  RELIANCE: "Reliance Industries",
  TCS: "Tata Consultancy Services",
  HDFCBANK: "HDFC Bank",
  INFY: "Infosys",
  ITC: "ITC",
  ADANIENT: "Adani Enterprises",
};

/* ---------- the briefing's shape (backend/app/agents.py, after the guardrail firewall) ---------- */

export type Evidence = { claim?: string; quote: string; ref: string; source: string; url: string; verified: boolean; issue?: string };
export type Source = { source: string; url: string; quote: string; finding: string };
export type Argument = { point: string; refs: string[]; answers: string; sources: Source[]; verified: boolean };
export type Fundamentals = { company: string; points: Evidence[]; red_flags: Evidence[]; not_found?: string[] };
export type EarningsCall = { company: string; guidance: Evidence[]; highlights: Evidence[]; concerns: Evidence[]; tone: Evidence | null };
export type News = { company: string; events: Evidence[]; overall: "positive" | "negative" | "mixed" | "neutral" | "quiet" };
export type Chief = { bottom_line: string; what_to_watch: string[] };
export type Blocked = { where: string; text: string; reason: string };
export type Council = {
  fundamentals: Fundamentals | { error: string };
  earnings_call: EarningsCall | { error: string };
  news: News | { error: string };
  briefing:
    | {
        bottom_line: string;
        bull_case: Argument[];
        bear_case: Argument[];
        bull_rebuttals: Argument[];
        bear_rebuttals: Argument[];
        risks: Argument[];
        what_to_watch: string[];
        errors?: Record<string, string>;
      }
    | { error: string };
  guardrail: { passed: number; blocked: Blocked[] };
};

/* ---------- the agents, in the order the council runs them ---------- */

export type AgentKey =
  | "fundamentals" | "earnings_call" | "news"
  | "bull_case" | "bear_case"
  | "bull_rebuttals" | "bear_rebuttals" | "risks" | "chief";

export const AGENTS: { key: AgentKey; name: string; role: string; round: 1 | 2 | 3; mono: string }[] = [
  { key: "fundamentals", name: "Fundamentals", role: "Annual report and financials", round: 1, mono: "F" },
  { key: "earnings_call", name: "Earnings call", role: "Latest concall transcript", round: 1, mono: "E" },
  { key: "news", name: "News", role: "The last 30 days", round: 1, mono: "N" },
  { key: "bull_case", name: "The Bull", role: "The strongest case for", round: 2, mono: "B" },
  { key: "bear_case", name: "The Bear", role: "The strongest case against", round: 2, mono: "B" },
  { key: "bull_rebuttals", name: "Bull replies", role: "Answers the Bear", round: 3, mono: "B" },
  { key: "bear_rebuttals", name: "Bear replies", role: "Answers the Bull", round: 3, mono: "B" },
  { key: "risks", name: "Risk", role: "Where each side could be wrong", round: 3, mono: "R" },
  { key: "chief", name: "Chief", role: "The balanced bottom line", round: 3, mono: "C" },
];

export type AgentState = { status: "waiting" | "running" | "done" | "error"; start?: number; end?: number; data?: unknown; error?: string; simulated?: boolean };
export type Phase = "connecting" | "live" | "replay" | "done" | "error";
export type CouncilState = {
  phase: Phase;
  agents: Record<AgentKey, AgentState>;
  council?: Council;
  error?: string;
  t0: number; // ms timestamp the run (or replay) started, for the trace
  replay?: boolean; // the timings are a paced replay of a cached run, not real model timings
};

const fresh = (): Record<AgentKey, AgentState> =>
  Object.fromEntries(AGENTS.map((a) => [a.key, { status: "waiting" }])) as Record<AgentKey, AgentState>;

/** Pull each agent's section out of a finished council (for replaying a cached briefing). */
export function sectionOf(c: Council, key: AgentKey): unknown {
  const b = c.briefing as Record<string, unknown>;
  if (key === "fundamentals" || key === "earnings_call" || key === "news") return c[key];
  if (key === "chief") return { bottom_line: b.bottom_line, what_to_watch: b.what_to_watch };
  return b[key];
}

// Replay pacing: honest about being a replay (the UI says so), slow enough for the 3D stage to show each agent.
const REPLAY: Record<AgentKey, [number, number]> = {
  fundamentals: [0, 4600], earnings_call: [0, 3800], news: [0, 3000],
  bull_case: [5000, 8400], bear_case: [5000, 9200],
  bull_rebuttals: [9600, 12600], bear_rebuttals: [9600, 13000], risks: [9600, 13600], chief: [9600, 14800],
};

/**
 * Stream a council run from the backend (GET /analyze/stream, server-sent events). Every agent's output arrives
 * already firewalled. A briefing cached earlier today replays with simulated timing and phase "replay".
 */
export function useCouncil(ticker: string, rerun = false): CouncilState {
  const [state, setState] = useState<CouncilState>(() => ({ phase: "connecting", agents: fresh(), t0: Date.now() }));
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!ticker) return; // unknown ticker: the page shows its own message
    setState({ phase: "connecting", agents: fresh(), t0: Date.now() });
    const url = `${API}/analyze/stream?ticker=${encodeURIComponent(ticker)}${rerun ? "&fresh=true" : ""}`;
    const es = new EventSource(url);
    let replay = false;
    let finished = false;

    const patch = (key: AgentKey, s: Partial<AgentState>) =>
      setState((prev) => ({ ...prev, agents: { ...prev.agents, [key]: { ...prev.agents[key], ...s } } }));

    es.onmessage = (msg) => {
      const e = JSON.parse(msg.data);
      if (e.type === "start") setState((p) => ({ ...p, phase: "live", t0: Date.now() }));
      else if (e.type === "cached") replay = true;
      else if (e.type === "agent") {
        const now = Date.now();
        if (e.status === "running") patch(e.agent, { status: "running", start: now });
        else if (e.status === "done") patch(e.agent, { status: "done", end: now, data: e.data });
        else patch(e.agent, { status: "error", end: now, error: e.error });
      } else if (e.type === "done") {
        finished = true;
        es.close();
        const council: Council = e.council;
        if (!replay) {
          setState((p) => ({ ...p, phase: "done", council }));
          return;
        }
        const t0 = Date.now();
        setState({ phase: "replay", agents: fresh(), t0, replay: true });
        for (const a of AGENTS) {
          const [s, f] = REPLAY[a.key];
          timers.current.push(setTimeout(() => patch(a.key, { status: "running", start: t0 + s, simulated: true }), s));
          timers.current.push(setTimeout(() => patch(a.key, { status: "done", end: t0 + f, data: sectionOf(council, a.key), simulated: true }), f));
        }
        timers.current.push(setTimeout(() => setState((p) => ({ ...p, phase: "done", council })), 15200));
      } else if (e.type === "error") {
        finished = true;
        es.close();
        setState((p) => ({ ...p, phase: "error", error: e.detail }));
      }
    };
    es.onerror = () => {
      if (finished) return;
      es.close();
      setState((p) => ({ ...p, phase: "error", error: `Can't reach the Samiksha backend at ${API}. Is it running? (uvicorn app.main:app)` }));
    };
    return () => {
      es.close();
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [ticker, rerun]);

  return state;
}

/** Progress for the 3D mark's three lines. */
export function progressOf(agents: Record<AgentKey, AgentState>) {
  const frac = (round: number) => {
    const xs = AGENTS.filter((a) => a.round === round);
    const score = xs.reduce((n, a) => n + (agents[a.key].status === "done" || agents[a.key].status === "error" ? 1 : agents[a.key].status === "running" ? 0.15 : 0), 0);
    return score / xs.length;
  };
  return { research: frac(1), debate: frac(2), verdict: frac(3) };
}
