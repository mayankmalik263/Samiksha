"use client";

/**
 * The run as a waterfall (pattern adapted from 21st.dev "Agent Trace" by n1m4mz): one row per agent, a bar from
 * when it started to when it landed, the playhead at "now". It shows what parallel means: three analysts
 * overlapping, then the debate, then four agents at once.
 */
import { useEffect, useState } from "react";
import { AGENTS, type AgentKey, type AgentState, type Phase } from "@/lib/council";
import { StatusIcon } from "@/components/StatusBadge";
import { AgentAvatar } from "@/components/council/Robot";

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

const fmt = (ms: number) => (ms < 60_000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`);

export default function Trace({ agents, t0, phase, replay = false }: { agents: Record<AgentKey, AgentState>; t0: number; phase: Phase; replay?: boolean }) {
  const active = phase === "live" || phase === "replay" || phase === "connecting";
  const now = useNow(active);
  const ends = AGENTS.map((a) => agents[a.key].end ?? (agents[a.key].start ? now : 0));
  const total = Math.max(1000, (active ? now : Math.max(...ends, t0 + 1000)) - t0);

  return (
    <section aria-label="Run trace" className="rounded-[28px] border border-line bg-paper">
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3.5">
        <span className={`h-2 w-2 rounded-full ${active ? "animate-blink bg-neel" : "bg-verified"}`} aria-hidden="true" />
        <h2 className="text-sm text-ink">run trace</h2>
        <span className="text-xs text-muted">{replay ? "paced replay of today's cached run (not model timings)" : "live timings from the model"}</span>
        <span className="ml-auto font-mono text-xs tabular-nums text-ink-2">{fmt(total)}</span>
      </header>
      <ol className="px-5 py-3">
        {AGENTS.map((a) => {
          const s = agents[a.key];
          const start = s.start ? s.start - t0 : null;
          const end = s.end ? s.end - t0 : start !== null ? now - t0 : null;
          const left = start !== null ? (start / total) * 100 : 0;
          const width = start !== null && end !== null ? Math.max(0.8, ((end - start) / total) * 100) : 0;
          const color =
            s.status === "error" ? "bg-firewall" : a.key.startsWith("bull") ? "bg-neel" : a.key.startsWith("bear") ? "bg-haldi" : a.key === "chief" ? "bg-ink" : "bg-ink-2/70";
          return (
            <li key={a.key} className="flex h-8 items-center gap-3">
              <span className={`flex w-40 shrink-0 items-center gap-2 text-sm sm:w-48 ${s.status === "waiting" ? "text-muted" : "text-ink"}`}>
                <AgentAvatar k={a.key} state={s.status} size="h-6 w-6" />
                <StatusIcon status={s.status} className="h-3.5 w-3.5" />
                <span className="truncate">{a.name}</span>
              </span>
              <span className="relative h-2 flex-1 rounded-full bg-line/60">
                {start !== null && (
                  <span
                    className={`absolute inset-y-0 rounded-full ${color} ${s.status === "running" ? "animate-blink" : ""}`}
                    style={{ left: `${left}%`, width: `${width}%`, transition: "width 200ms linear" }}
                  />
                )}
              </span>
              <span className="w-14 shrink-0 text-right font-mono text-caption tabular-nums text-muted">
                {s.status === "done" && end !== null && start !== null ? fmt(end - start) : s.status === "running" ? "…" : s.status === "error" ? "failed" : ""}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
