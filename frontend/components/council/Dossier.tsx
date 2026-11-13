"use client";

/**
 * The Dossier: the centre of the council stage. The logo's brackets are the covers of a binder, and the briefing is
 * the stack of pages between them.
 *
 *  agents working  -> the covers breathe; the stack holds one page per agent that has delivered.
 *  an agent hands in its findings -> the covers open a little, a page with its haldi quote line slides into the
 *                    stack (as the quote lines land), and the covers close on it.
 *  the verdict     -> the covers press shut and a haldi seal is stamped on.
 *
 * The breathing is CSS (globals.css `rb-breathe-*`), so reduced motion stills it; the one-off beats are keyed per delivery.
 */
import { motion, useReducedMotion } from "motion/react";

const INK = "#1B1835", NEEL = "#4338CA", HALDI = "#D97706";
const LAND = 0.8; // seconds: when the quote lines reach the dossier (Stage's rb-spark timing)
const EASE = [0.2, 0.7, 0.3, 1] as const;

function Page({ i, top, fresh, reduce }: { i: number; top: boolean; fresh: boolean; reduce: boolean }) {
  const y = 78 - i * 3; // the stack rises as pages arrive
  return (
    <motion.g
      initial={fresh && !reduce ? { y: -90, opacity: 0 } : false}
      animate={{ y: 0, opacity: top ? 1 : 0.55 }}
      transition={{ duration: 0.45, ease: EASE, delay: fresh ? LAND : 0, opacity: { duration: 0.3 } }}
    >
      <rect x="80" y={y} width="96" height="120" rx="6" fill="#FFFFFF" stroke="#D6D2C6" strokeWidth="2" />
      {[0, 1, 2, 3].map((k) => (
        <rect key={k} x="92" y={y + 16 + k * 14} width={k === 1 ? 52 : 70 - k * 8} height="6" rx="3" fill={k === 1 ? HALDI : "#E7E4DA"} />
      ))}
    </motion.g>
  );
}

export default function Dossier({ size, pages, last, working, done }: {
  size: number;
  pages: number; // agents that have delivered: one page each
  last?: number; // id of the latest delivery (changes on each catch)
  working: boolean;
  done: boolean;
}) {
  const reduce = useReducedMotion() ?? false;
  const open = (side: -1 | 1) =>
    last && !reduce
      ? { x: [0, side * 14, side * 14, done ? side * -4 : 0, 0] }
      : { x: 0 };
  return (
    <svg
      viewBox="0 0 256 256"
      width={size}
      height={size}
      className={`rb ${working && !done ? "rb-on" : ""}`}
      style={{ overflow: "visible", filter: "drop-shadow(0 12px 24px rgb(27 24 53 / 0.12))" }}
      aria-hidden="true"
    >
      {/* the stack */}
      {Array.from({ length: Math.min(8, pages) }, (_, i) => (
        <Page key={i} i={i} top={i === Math.min(8, pages) - 1} fresh={i === pages - 1 && !!last} reduce={reduce} />
      ))}

      {/* the covers: open for each page, close on it */}
      {([-1, 1] as const).map((side) => (
        <motion.g
          key={`${side}-${last ?? 0}`}
          initial={false}
          animate={open(side)}
          transition={{ duration: 0.9, delay: LAND - 0.35, times: [0, 0.3, 0.55, 0.8, 1], ease: "easeInOut" }}
        >
          <g className={side < 0 ? "rb-breathe-l" : "rb-breathe-r"}>
            {side < 0 ? (
              <>
                <path fill={INK} d="M32 36 H60 V220 H32 Z" />
                <path fill={NEEL} d="M60 36 H92 L76 60 H60 Z M60 196 H76 L92 220 H60 Z" />
              </>
            ) : (
              <>
                <path fill={INK} d="M224 36 H196 V220 H224 Z" />
                <path fill={NEEL} d="M196 36 H164 L180 60 H196 Z M196 196 H180 L164 220 H196 Z" />
              </>
            )}
          </g>
        </motion.g>
      ))}

      {/* the seal, pressed on when the verdict is in */}
      {done && (
        <motion.g
          initial={reduce ? false : { scale: 1.9, rotate: -20, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", bounce: 0.35, duration: 0.55, delay: 0.2 }}
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        >
          <circle cx="128" cy="128" r="30" fill={HALDI} />
          <circle cx="128" cy="128" r="24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeDasharray="3 3" />
          <path d="M116 128 l8 8 l16 -16" fill="none" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        </motion.g>
      )}
    </svg>
  );
}
