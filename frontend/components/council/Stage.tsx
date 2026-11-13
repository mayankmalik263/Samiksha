"use client";

/**
 * The live council stage, in 2D: the Dossier in the middle (it IS the Chief), the eight robots seated
 * around it, each linked to the mark.
 *
 *  waiting -> the robot sleeps, its link faint.
 *  running -> the robot works (its own animation), its link flows, and source pages fly from it into the mark.
 *  done    -> it hops, and a burst of haldi quote lines (one per verified finding) lands on the mark's quote line.
 *
 * The centre is the Dossier (components/council/Dossier.tsx): the logo as a binder, taking in a page per delivery.
 * Wide screens seat the council on an oval table; phones get three tidy rows.
 */
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Dossier from "@/components/council/Dossier";
import Robot, { KIND } from "@/components/council/Robot";
import { StatusIcon } from "@/components/StatusBadge";
import type { AgentKey, AgentState } from "@/lib/council";

type SeatKey = Exclude<AgentKey, "chief">;

const SEATS: { key: SeatKey; name: string; angle: number; narrow: [number, number]; reply?: boolean; tone: string }[] = [
  { key: "fundamentals", name: "Fundamentals", angle: 130, narrow: [0.17, 0.14], tone: "#3D3955" },
  { key: "earnings_call", name: "Earnings call", angle: 90, narrow: [0.5, 0.14], tone: "#3D3955" },
  { key: "news", name: "News", angle: 50, narrow: [0.83, 0.14], tone: "#3D3955" },
  { key: "bull_case", name: "The Bull", angle: 180, narrow: [0.15, 0.48], tone: "#4338CA" },
  { key: "bear_case", name: "The Bear", angle: 0, narrow: [0.85, 0.48], tone: "#D97706" },
  { key: "bull_rebuttals", name: "Bull replies", angle: 226, narrow: [0.17, 0.82], reply: true, tone: "#4338CA" },
  { key: "bear_rebuttals", name: "Bear replies", angle: 314, narrow: [0.83, 0.82], reply: true, tone: "#D97706" },
  { key: "risks", name: "Risk", angle: 270, narrow: [0.5, 0.82], tone: "#3D3955" },
];

const SPRING = { type: "spring", bounce: 0, duration: 0.6 } as const;

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

/** Remembers the moment each agent finished during this visit, so its burst fires once, on the transition. */
function useBursts(agents: Record<AgentKey, AgentState>) {
  const prev = useRef<Partial<Record<AgentKey, string>>>({});
  const [at, setAt] = useState<Partial<Record<AgentKey, number>>>({});
  useEffect(() => {
    const fired: Partial<Record<AgentKey, number>> = {};
    for (const { key } of SEATS) {
      const was = prev.current[key];
      if (was && was !== "done" && agents[key].status === "done") fired[key] = Date.now();
      prev.current[key] = agents[key].status;
    }
    if (Object.keys(fired).length) setAt((a) => ({ ...a, ...fired }));
  }, [agents]);
  return at;
}

export default function Stage({ agents, counts, done }: {
  agents: Record<AgentKey, AgentState>; counts: Partial<Record<AgentKey, number>>; done: boolean;
}) {
  const reduce = useReducedMotion() ?? false;
  const [box, { w, h }] = useSize<HTMLDivElement>();
  const bursts = useBursts(agents);
  const wide = w >= 640;
  const robot = wide ? Math.min(118, w * 0.095) : Math.min(76, w * 0.2);
  const logo = wide ? Math.min(190, h * 0.3) : Math.min(120, w * 0.32);
  const cx = w / 2;
  const cy = wide ? h * 0.48 : h * 0.48;
  const rx = Math.min(w * 0.37, 470);
  const ry = h * 0.34;
  const at = (s: (typeof SEATS)[number]) =>
    wide
      ? { x: cx + Math.cos((s.angle * Math.PI) / 180) * rx, y: cy - Math.sin((s.angle * Math.PI) / 180) * ry }
      : { x: s.narrow[0] * w, y: s.narrow[1] * h };

  // the Dossier: one page per agent that has delivered; the latest delivery's time keys its catch animation
  const delivered = SEATS.filter((s) => agents[s.key].status === "done").length;
  const last = Math.max(0, ...Object.values(bursts).map(Number)) || undefined;
  const working = SEATS.some((s) => agents[s.key].status !== "waiting");

  return (
    <div ref={box} className="relative h-full w-full overflow-hidden">
      {w > 0 && (
        <>
          {/* the table and the links */}
          <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
            {wide && <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke="#1B1835" strokeOpacity="0.1" strokeDasharray="4 7" />}
            {SEATS.map((s) => {
              const p = at(s);
              const st = agents[s.key].status;
              const k = 1 - (logo * 0.55) / Math.hypot(p.x - cx, p.y - cy); // stop at the mark's edge
              return (
                <line
                  key={s.key}
                  x1={p.x}
                  y1={p.y}
                  x2={p.x + (cx - p.x) * k}
                  y2={p.y + (cy - p.y) * k}
                  stroke={s.tone}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray="5 6"
                  strokeOpacity={st === "waiting" ? 0.12 : st === "running" ? 0.7 : 0.3}
                  style={{ transition: "stroke-opacity 400ms ease", animation: st === "running" && !reduce ? "rb-flow 0.8s linear infinite" : undefined }}
                />
              );
            })}
          </svg>

          {/* pages flying in from every working robot */}
          {SEATS.map((s) => {
            if (agents[s.key].status !== "running" || reduce) return null;
            const p = at(s);
            return [0, 1, 2].map((i) => (
              <span
                key={`${s.key}-${i}`}
                aria-hidden="true"
                className="pointer-events-none absolute z-10 block h-[22px] w-[17px] rounded-[3px] border border-line-2 bg-paper shadow-sm"
                style={{
                  left: p.x,
                  top: p.y,
                  ["--dx" as string]: `${cx - p.x}px`,
                  ["--dy" as string]: `${cy - p.y}px`,
                  animation: `rb-fly 1.6s cubic-bezier(0.45, 0, 0.25, 1) ${i * 0.53}s infinite both`,
                  backgroundImage: "repeating-linear-gradient(to bottom, transparent 0 4px, rgb(199 195 244) 4px 5px)",
                  backgroundSize: "70% 100%",
                  backgroundPosition: "center 3px",
                  backgroundRepeat: "no-repeat",
                }}
              />
            ));
          })}

          {/* verified findings landing on the quote line, once, when an agent finishes */}
          {SEATS.map((s) => {
            const t = bursts[s.key];
            if (!t || reduce) return null;
            const p = at(s);
            return Array.from({ length: Math.min(6, Math.max(1, counts[s.key] ?? 1)) }, (_, i) => (
              <span
                key={`${s.key}-${t}-${i}`}
                aria-hidden="true"
                className="pointer-events-none absolute z-20 block h-[7px] w-[26px] rounded-full bg-haldi shadow-[0_0_12px_rgb(217_119_6/0.6)]"
                style={{ left: p.x, top: p.y, ["--dx" as string]: `${cx - p.x}px`, ["--dy" as string]: `${cy - p.y}px`, animation: `rb-spark 1.1s cubic-bezier(0.2, 0.7, 0.3, 1) ${i * 0.12}s both` }}
              />
            ));
          })}

          {/* the mark */}
          <div className="absolute z-0 -translate-x-1/2 -translate-y-1/2" style={{ left: cx, top: cy }}>
            <Dossier size={logo} pages={delivered} last={last} working={working} done={done} />
          </div>

          {/* the robots and their name tags */}
          <ol aria-label="Council seats">
            {SEATS.map((s) => {
              const p = at(s);
              const st = agents[s.key];
              const n = counts[s.key] ?? 0;
              return (
                <li key={s.key} className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={{ left: p.x, top: p.y }}>
                  <div style={{ width: robot, height: (robot * 196) / 170 }}>
                    <Robot kind={KIND[s.key]!} state={st.status} reply={s.reply} still={reduce} className="block h-full w-full" />
                  </div>
                  <span className="sr-only">{s.name}: {st.status}</span>
                  <span
                    aria-hidden="true"
                    className={`mt-1 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-paper/95 px-2.5 py-1 font-medium text-ink shadow-sm ${wide ? "text-caption" : "text-[0.6875rem]"}`}
                  >
                    <StatusIcon status={st.status} className="h-3 w-3" />
                    {s.name}
                    {st.status === "done" && n > 0 && <span className="text-haldi-text tabular-nums">· {n}</span>}
                  </span>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}
