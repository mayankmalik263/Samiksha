"use client";

/**
 * The council's robots (direction A, "Blocks"): one character per agent, flat 2D in Neel & Haldi.
 *
 *  waiting -> asleep: eyes shut, colours muted.
 *  running -> awake and at work: a gentle bob, blinking, and each robot's own tell (keys flash on the calculator,
 *             the waveform talks, the antenna signals, the debaters gesture, the visor scans).
 *  done    -> happy eyes, one hop, a check on the head.
 *  error   -> crossed eyes, slumped.
 *
 * Loops are CSS keyframes (globals.css, `rb-*`), so prefers-reduced-motion stills them; the one-off hop is a spring.
 */
import { motion, useReducedMotion } from "motion/react";
import type { AgentKey } from "@/lib/council";

export type RobotKind = "fundamentals" | "earnings" | "news" | "bull" | "bear" | "risk";
type State = "waiting" | "running" | "done" | "error";

const INK = "#1B1835", INK2 = "#3D3955", NEEL = "#4338CA", NEEL_D = "#2F2690", HALDI = "#D97706", HALDI_D = "#B45309";
const LILAC = "#C7C3F4", PAPER = "#FFFFFF", SCREEN = "#2A2650", OK = "#15803D";

export const KIND: Partial<Record<AgentKey, RobotKind>> = {
  fundamentals: "fundamentals", earnings_call: "earnings", news: "news",
  bull_case: "bull", bull_rebuttals: "bull", bear_case: "bear", bear_rebuttals: "bear", risks: "risk",
};

const LOOK: Record<RobotKind, { body: string; dark: string; face: string; eyes: "round" | "focused" | "visor" }> = {
  fundamentals: { body: INK, dark: INK2, face: SCREEN, eyes: "round" },
  earnings: { body: INK, dark: INK2, face: SCREEN, eyes: "round" },
  news: { body: INK, dark: INK2, face: SCREEN, eyes: "round" },
  bull: { body: NEEL, dark: NEEL_D, face: NEEL_D, eyes: "focused" },
  bear: { body: HALDI, dark: HALDI_D, face: HALDI_D, eyes: "focused" },
  risk: { body: INK2, dark: INK, face: SCREEN, eyes: "visor" },
};

function Eyes({ kind, state }: { kind: RobotKind; state: State }) {
  const line = { stroke: LILAC, strokeWidth: 4, strokeLinecap: "round" as const, fill: "none" };
  if (state === "waiting") return <path d="M57 63 H71 M89 63 H103" {...line} />; // asleep
  if (state === "done") return <path d="M57 66 Q64 56 71 66 M89 66 Q96 56 103 66" {...line} />; // happy
  if (state === "error") return <path d="M58 57 L70 69 M70 57 L58 69 M90 57 L102 69 M102 57 L90 69" {...line} />;
  const e = LOOK[kind].eyes;
  if (e === "visor")
    return (
      <g>
        <rect x="46" y="54" width="68" height="16" rx="8" fill={LILAC} />
        <rect className="rb-scan" x="50" y="58" width="22" height="8" rx="4" fill={PAPER} opacity="0.85" />
      </g>
    );
  if (e === "focused")
    return (
      <g>
        <g className="rb-blink">
          <rect x="56" y="58" width="16" height="9" rx="4.5" fill={LILAC} />
          <rect x="88" y="58" width="16" height="9" rx="4.5" fill={LILAC} />
        </g>
        <path d="M56 52 L72 54 M104 52 L88 54" {...line} />
      </g>
    );
  return (
    <g className="rb-blink">
      <circle cx="64" cy="62" r="7" fill={LILAC} />
      <circle cx="96" cy="62" r="7" fill={LILAC} />
      <circle cx="66.5" cy="59.5" r="2.2" fill={PAPER} />
      <circle cx="98.5" cy="59.5" r="2.2" fill={PAPER} />
    </g>
  );
}

function Antenna({ x = 80, top = 12, tip = HALDI }: { x?: number; top?: number; tip?: string }) {
  return (
    <g>
      <rect x={x - 2.5} y={top + 6} width="5" height={28 - top - 4} rx="2.5" fill={INK2} />
      <circle className="rb-tip" cx={x} cy={top + 4} r="6" fill={tip} />
    </g>
  );
}

/** What sits behind the head (drawn first). */
function Back({ kind }: { kind: RobotKind }) {
  if (kind === "fundamentals") return <Antenna />;
  if (kind === "risk") return <Antenna tip={LILAC} />;
  if (kind === "news")
    return (
      <g>
        <path className="rb-signal" d="M98 6 C106 10 108 18 104 24" fill="none" stroke={HALDI} strokeWidth="3" strokeLinecap="round" />
        <path className="rb-signal [animation-delay:250ms]" d="M104 0 C116 8 118 22 110 30" fill="none" stroke={HALDI} strokeWidth="3" strokeLinecap="round" opacity="0.55" />
        <Antenna x={92} top={14} />
      </g>
    );
  if (kind === "bull")
    return (
      <g fill={PAPER} stroke={NEEL_D} strokeWidth="3" strokeLinejoin="round">
        <path d="M40 34 C30 30 26 18 32 8 C38 18 46 22 54 26 Z" />
        <path d="M120 34 C130 30 134 18 128 8 C122 18 114 22 106 26 Z" />
      </g>
    );
  if (kind === "bear")
    return (
      <g>
        <circle cx="40" cy="30" r="15" fill={HALDI} />
        <circle cx="40" cy="30" r="7" fill={HALDI_D} />
        <circle cx="120" cy="30" r="15" fill={HALDI} />
        <circle cx="120" cy="30" r="7" fill={HALDI_D} />
      </g>
    );
  return null;
}

/** Everything on top of the head and body: the character's props and chest. */
function Front({ kind }: { kind: RobotKind }) {
  switch (kind) {
    case "fundamentals":
      return (
        <g>
          <g fill="none" stroke={HALDI} strokeWidth="3">
            <circle cx="64" cy="62" r="11" />
            <circle cx="96" cy="62" r="11" />
            <path d="M75 62 H85" />
          </g>
          {Array.from({ length: 9 }, (_, n) => (
            <rect
              key={n}
              className="rb-key"
              style={{ animationDelay: `${[0, 5, 2, 7, 1, 6, 3, 8, 4][n] * 140}ms` }}
              x={58 + (n % 3) * 16}
              y={106 + Math.floor(n / 3) * 14}
              width="12"
              height="9"
              rx="2.5"
              fill={n === 8 ? HALDI : LILAC}
            />
          ))}
        </g>
      );
    case "earnings":
      return (
        <g>
          <g fill={NEEL}>
            <path d="M30 52 C30 10 130 10 130 52" fill="none" stroke={NEEL} strokeWidth="7" strokeLinecap="round" />
            <rect x="18" y="44" width="16" height="30" rx="8" />
            <rect x="126" y="44" width="16" height="30" rx="8" />
          </g>
          <path d="M30 72 C34 90 52 92 62 88" fill="none" stroke={NEEL} strokeWidth="4" strokeLinecap="round" />
          <circle className="rb-tip" cx="64" cy="87" r="5" fill={HALDI} />
          {[10, 22, 34, 18, 28, 12, 20].map((h, k) => (
            <rect key={k} className="rb-wave" style={{ animationDelay: `${k * 110}ms` }} x={52 + k * 8.5} y={126 - h / 2} width="5" height={h} rx="2.5" fill={k === 2 ? HALDI : LILAC} />
          ))}
        </g>
      );
    case "news":
      return (
        <g>
          <path d="M36 34 L64 8 L96 34 Z" fill={PAPER} stroke={LILAC} strokeWidth="2" />
          <path d="M48 26 H82" stroke={LILAC} strokeWidth="2" />
          <rect x="52" y="104" width="56" height="44" rx="4" fill={PAPER} />
          <rect x="57" y="109" width="46" height="7" rx="2" fill={INK} />
          {[0, 1, 2].map((k) => (
            <g key={k} className="rb-key" style={{ animationDelay: `${k * 220}ms` }} fill={LILAC}>
              <rect x="57" y={121 + k * 8} width="20" height="3" rx="1.5" />
              <rect x="82" y={121 + k * 8} width="21" height="3" rx="1.5" />
            </g>
          ))}
        </g>
      );
    case "bull":
      return <path d="M80 110 V140 M65 125 H95" stroke={PAPER} strokeWidth="9" strokeLinecap="round" />; // "for"
    case "bear":
      return <path d="M65 125 H95" stroke={PAPER} strokeWidth="9" strokeLinecap="round" />; // "against"
    case "risk":
      return (
        <g>
          <rect x="54" y="118" width="40" height="5" rx="2.5" fill={LILAC} />
          <circle className="rb-tip" cx="74" cy="132" r="6" fill={HALDI} />
        </g>
      );
  }
}

export default function Robot({ kind, state, reply = false, head = false, still = false, className = "" }: {
  kind: RobotKind; state: State; reply?: boolean; head?: boolean; still?: boolean; className?: string;
}) {
  const reduce = useReducedMotion();
  const L = LOOK[kind];
  const working = state === "running";
  const debater = kind === "bull" || kind === "bear";
  return (
    <svg
      viewBox={head ? "16 -2 128 104" : "0 -14 170 196"}
      className={`rb ${working && !still ? "rb-on" : ""} ${state === "waiting" ? "rb-asleep" : ""} ${className}`}
      role="img"
      aria-hidden="true"
    >
      {!head && <ellipse cx="80" cy="168" rx="44" ry="6" fill={INK} opacity="0.1" />}
      <motion.g
        key={state} // the hop replays when the state changes to done
        initial={false}
        animate={state === "done" && !reduce ? { y: [0, -12, 0] } : { y: 0 }}
        transition={{ duration: 0.5, ease: [0.3, 0, 0.3, 1] }}
      >
        <g className="rb-bob" style={state === "error" ? { transform: "rotate(5deg)", transformOrigin: "80px 160px" } : undefined}>
          <Back kind={kind} />
          {!head && (
            <>
              <rect x="54" y="150" width="20" height="12" rx="5" fill={L.dark} />
              <rect x="86" y="150" width="20" height="12" rx="5" fill={L.dark} />
              <rect className={debater ? "rb-arm-l" : ""} x="26" y="104" width="14" height="38" rx="7" fill={L.dark} />
              <rect className={debater ? "rb-arm-r" : ""} x="120" y="104" width="14" height="38" rx="7" fill={L.dark} />
              <rect x="38" y="96" width="84" height="60" rx="12" fill={L.body} />
              <rect x="70" y="88" width="20" height="12" fill={L.dark} />
            </>
          )}
          <rect x="28" y="28" width="104" height="68" rx="14" fill={L.body} />
          <rect x="40" y="40" width="80" height="44" rx="9" fill={L.face} />
          <Eyes kind={kind} state={state} />
          {head ? (kind === "fundamentals" || kind === "earnings" || kind === "news") && <HeadProps kind={kind} /> : <Front kind={kind} />}
          {kind === "risk" && !head && (
            <g>
              <path d="M112 100 L140 92 L156 100 V122 C156 138 144 148 134 152 C124 148 112 138 112 122 Z" fill={LILAC} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
              <path d="M124 120 L132 128 L146 112" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          )}
        </g>
        {/* replies: a speech bubble, typing while the robot answers */}
        {reply && !head && (
          <g>
            <path d="M118 2 H162 a8 8 0 0 1 8 8 V30 a8 8 0 0 1 -8 8 H138 L128 48 L130 38 H118 a8 8 0 0 1 -8 -8 V10 a8 8 0 0 1 8 -8 Z" fill={PAPER} stroke={kind === "bull" ? NEEL : HALDI} strokeWidth="3" />
            {[128, 140, 152].map((cx, k) => (
              <circle key={cx} className={working ? "rb-type" : ""} style={{ animationDelay: `${k * 160}ms` }} cx={cx} cy="20" r="4" fill={kind === "bull" ? NEEL : HALDI} />
            ))}
          </g>
        )}
        {state === "done" && (
          <g>
            <circle cx={head ? 128 : 132} cy={head ? 30 : 30} r="12" fill={OK} stroke={PAPER} strokeWidth="3" />
            <path d={`M${(head ? 128 : 132) - 5} 30 l3.5 3.5 l6.5 -7`} fill="none" stroke={PAPER} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )}
      </motion.g>
    </svg>
  );
}

/** The bits of a researcher's character that sit on the head, for the head-only avatar. */
function HeadProps({ kind }: { kind: RobotKind }) {
  if (kind === "fundamentals")
    return (
      <g fill="none" stroke={HALDI} strokeWidth="3">
        <circle cx="64" cy="62" r="11" />
        <circle cx="96" cy="62" r="11" />
        <path d="M75 62 H85" />
      </g>
    );
  if (kind === "earnings")
    return (
      <g fill={NEEL}>
        <path d="M30 52 C30 10 130 10 130 52" fill="none" stroke={NEEL} strokeWidth="7" strokeLinecap="round" />
        <rect x="18" y="44" width="16" height="30" rx="8" />
        <rect x="126" y="44" width="16" height="30" rx="8" />
      </g>
    );
  return (
    <g>
      <path d="M36 34 L64 8 L96 34 Z" fill={PAPER} stroke={LILAC} strokeWidth="2" />
      <path d="M48 26 H82" stroke={LILAC} strokeWidth="2" />
    </g>
  );
}

/** A robot head in a round tile: the agent's avatar on cards, report pages and the trace. The Chief is the logo. */
export function AgentAvatar({ k, state = "done", size = "h-11 w-11" }: { k: AgentKey; state?: State; size?: string }) {
  const kind = KIND[k];
  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-ground ring-1 ring-line ${size}`}>
      {kind ? (
        <Robot kind={kind} state={state === "waiting" ? "waiting" : "running"} head still className="h-[92%] w-[92%]" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/brand/samiksha-symbol.svg" alt="" className="h-[70%] w-[70%]" />
      )}
    </span>
  );
}
