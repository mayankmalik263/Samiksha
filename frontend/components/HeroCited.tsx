"use client";

/**
 * The landing hero: "Every claim, cited", acted out. A source page sits behind a briefing card; the haldi
 * highlighter sweeps the quoted line, the quote flies into the claim's citation, and the claim is marked verified.
 * Every third claim carries a number its sources don't contain, and the firewall strikes it out.
 *
 * Everything shown is real: the two quotes are on p.25 of TCS's 2026 annual report (as cited in the TCS briefing),
 * and the blocked claim is a real catch from the Adani Enterprises briefing.
 */
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

type Claim = { stock: string; text: string; quote?: number; verdict: string };

const QUOTES = ["operating margin of 25.0%, an improvement of 70 basis points", "On a constant currency basis, revenue declined by 2.4%"];
const CLAIMS: Claim[] = [
  { stock: "TCS", text: "The operating margin was 25.0% in FY2026, a four-year high.", quote: 0, verdict: "Verified: the quote is in the source" },
  { stock: "TCS", text: "Revenue declined by 2.4% on a constant currency basis in FY2026.", quote: 1, verdict: "Verified: the quote is in the source" },
  { stock: "ADANIENT", text: "Operating income fell by nearly 20% to Rs 8,438 crore in FY2026.", verdict: "Blocked: 20% isn't in the cited findings" },
];
const STEP = 5200; // ms per claim
const EASE = [0.2, 0.7, 0.3, 1] as const;

/** The page the quotes come from: filler lines, with the two quoted sentences as real text. */
function SourcePage({ lit, dim, quoteRefs }: { lit: number | null; dim: boolean; quoteRefs: React.RefObject<(HTMLSpanElement | null)[]> }) {
  const filler = (w: string, k: string) => <span key={k} className="my-2.5 block h-[7px] rounded-full bg-line" style={{ width: w }} />;
  return (
    <div
      className="absolute top-[2%] left-[2%] w-[78%] max-w-[340px] sm:top-[6%] sm:w-[60%] -rotate-3 rounded-lg border border-line-2 bg-paper p-5 shadow-[0_24px_50px_-26px_rgb(27_24_53/0.45)] transition-opacity duration-500 sm:p-6"
      style={{ opacity: dim ? 0.4 : 1 }} // a blocked claim has no line here to point at
    >
      <p className="kicker text-muted">
        TCS · Annual report 2026 · <span className="normal-case">p.25</span>
      </p>
      {filler("92%", "a")}
      {filler("78%", "b")}
      {QUOTES.map((q, i) => (
        <span key={i}>
          <span ref={(el) => { quoteRefs.current[i] = el; }} className="relative my-2.5 block text-[0.8125rem] leading-snug text-ink">
            <motion.span
              aria-hidden="true"
              className="absolute -inset-x-1 -inset-y-0.5 rounded-sm bg-haldi/35"
              style={{ originX: 0 }}
              initial={false}
              animate={{ scaleX: lit === i ? 1 : 0 }}
              transition={{ duration: lit === i ? 0.6 : 0.3, ease: EASE }}
            />
            <span className="relative">{q}</span>
          </span>
          {filler(i ? "64%" : "86%", `c${i}`)}
          {filler(i ? "88%" : "70%", `d${i}`)}
        </span>
      ))}
      {filler("82%", "e")}
      {filler("56%", "f")}
    </div>
  );
}

export default function HeroCited() {
  const reduce = useReducedMotion() ?? false;
  const [n, setN] = useState(0); // claims shown so far; the current claim is CLAIMS[n % 3]
  const [phase, setPhase] = useState<"in" | "lit" | "fly" | "done">(reduce ? "done" : "in");
  const [fly, setFly] = useState<{ x: number; y: number; dx: number; dy: number; text: string } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  const quoteRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const c = CLAIMS[n % CLAIMS.length];

  // one claim's beat: appear -> highlight its quote -> the quote flies into the citation -> verdict
  useEffect(() => {
    if (reduce) return;
    setPhase("in");
    const t = [
      setTimeout(() => setPhase(c.quote === undefined ? "in" : "lit"), 900),
      setTimeout(() => setPhase(c.quote === undefined ? "done" : "fly"), c.quote === undefined ? 1900 : 1700),
      setTimeout(() => setN((k) => k + 1), STEP),
    ];
    return () => t.forEach(clearTimeout);
  }, [n, reduce, c.quote]);

  useLayoutEffect(() => {
    if (phase !== "fly" || c.quote === undefined || !box.current || !pill.current) return;
    const b = box.current.getBoundingClientRect();
    const q = quoteRefs.current[c.quote]!.getBoundingClientRect();
    const p = pill.current.getBoundingClientRect();
    setFly({ x: q.left - b.left, y: q.top - b.top, dx: p.left - q.left, dy: p.top - q.top, text: QUOTES[c.quote] });
  }, [phase, c.quote]);

  const blocked = c.quote === undefined;
  const lit = c.quote !== undefined && (phase === "lit" || phase === "fly") ? c.quote : null;

  return (
    <div ref={box} className="relative h-full w-full" role="img" aria-label="A claim in a Samiksha briefing linked to the exact line of its source, and a claim with an invented number blocked by the firewall">
      <SourcePage lit={lit} dim={blocked} quoteRefs={quoteRefs} />

      {/* the quote travelling into the citation */}
      <AnimatePresence>
        {fly && phase === "fly" && (
          <motion.span
            key={n}
            aria-hidden="true"
            className="pointer-events-none absolute z-30 max-w-[260px] truncate rounded-sm bg-haldi/35 px-1 text-[0.8125rem] text-ink"
            style={{ left: fly.x, top: fly.y, originX: 0, originY: 0 }}
            initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
            animate={{ x: fly.dx, y: fly.dy, scale: 0.15, opacity: 0.2 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: EASE }}
            onAnimationComplete={() => setPhase("done")}
          >
            {fly.text}
          </motion.span>
        )}
      </AnimatePresence>

      {/* the briefing card */}
      <div className="absolute right-[2%] bottom-[1%] z-20 w-[86%] max-w-[380px] sm:bottom-[8%] sm:w-[66%] rounded-[22px] border border-line bg-paper p-5 shadow-[0_30px_60px_-28px_rgb(27_24_53/0.5)] sm:p-6">
        <p className="kicker text-muted">
          Samiksha · <span className="font-mono">{c.stock}</span> briefing
        </p>
        <AnimatePresence mode="wait">
          <motion.p
            key={n}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3, ease: EASE }}
            className={`mt-3 text-[1.0625rem] leading-snug ${blocked && phase === "done" ? "text-muted line-through decoration-firewall decoration-2" : "text-ink"}`}
          >
            {c.text}{" "}
            {!blocked && (
              <motion.span
                ref={pill}
                key={`p${n}-${phase === "done"}`}
                initial={false}
                animate={phase === "done" && !reduce ? { scale: [1, 1.45, 1] } : { scale: 1 }}
                transition={{ duration: 0.4, ease: EASE }}
                className="inline-grid h-5 min-w-5 place-items-center rounded-full border border-neel/30 bg-neel-tint px-1.5 align-[0.1em] text-caption font-semibold text-neel tabular-nums"
              >
                1
              </motion.span>
            )}
          </motion.p>
        </AnimatePresence>
        <motion.p
          key={`v${n}`}
          initial={false}
          animate={{ opacity: phase === "done" ? 1 : 0, y: phase === "done" ? 0 : 4 }}
          transition={{ duration: 0.3, ease: EASE }}
          className={`mt-3 flex items-center gap-1.5 text-sm font-semibold ${blocked ? "text-firewall" : "text-verified"}`}
        >
          <span aria-hidden="true">{blocked ? "✕" : "✓"}</span>
          {c.verdict}
        </motion.p>
      </div>
    </div>
  );
}
