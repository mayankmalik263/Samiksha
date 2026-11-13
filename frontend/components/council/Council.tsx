"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Citation from "@/components/Citation";
import EvidenceStrength from "@/components/Evidence";
import AnimatedList from "@/components/reactbits/AnimatedList";
import BorderGlow from "@/components/reactbits/BorderGlow";
import CountUp from "@/components/reactbits/CountUp";
import LatticeLoader from "@/components/reactbits/LatticeLoader";

/** BorderGlow tuned to the brand: a Neel-to-Haldi edge light on white paper cards. */
export const GLOW = {
  backgroundColor: "#FFFFFF",
  glowColor: "243 58 62",
  colors: ["#4338CA", "#D97706", "#C7C3F4"],
  glowIntensity: 0.9,
  edgeSensitivity: 26,
  glowRadius: 32,
  coneSpread: 22,
  fillOpacity: 0.35,
};
import type { AgentKey, AgentState, Argument, Chief, Council as CouncilT, EarningsCall, Evidence, Fundamentals, News } from "@/lib/council";

const EASE = [0.16, 1, 0.3, 1] as const;

/* ---------- small pieces ---------- */

export function Typing({ tone = "ink" }: { tone?: "ink" | "neel" | "haldi" }) {
  const c = tone === "neel" ? "bg-neel" : tone === "haldi" ? "bg-haldi" : "bg-ink-2";
  return (
    <span className="inline-flex items-center gap-1" aria-label="writing">
      {[0, 1, 2].map((i) => (
        <span key={i} className={`h-1.5 w-1.5 animate-blink rounded-full ${c}`} style={{ animationDelay: `${i * 0.18}s` }} />
      ))}
    </span>
  );
}

/** React Bits LatticeLoader: a lattice wave + live stopwatch while the agent works, then a check (or cross)
 *  with the frozen time. Replays never show a stopwatch: their pacing isn't model time. */
function StatusChip({ s, seconds, tone = "neel" }: { s: AgentState; seconds?: number; tone?: "neel" | "haldi" | "light" }) {
  if (s.status === "waiting") return <span className="rounded-full border border-line px-2.5 py-1 font-mono text-[11px] text-muted">waiting</span>;
  const ink = tone === "light" ? "#C7C3F4" : tone === "haldi" ? "#B45309" : "#4338CA";
  return (
    <span className={`rounded-full px-2.5 py-1 ${tone === "light" ? "bg-white/10" : s.status === "done" ? "bg-verified-tint" : s.status === "error" ? "bg-firewall-tint" : tone === "haldi" ? "bg-haldi-tint" : "bg-neel-tint"}`}>
      <LatticeLoader
        status={s.status === "running" ? "working" : s.status}
        label="Working"
        doneLabel={seconds !== undefined ? "Done in" : "Done"}
        errorLabel="Failed"
        showTimer={!s.simulated}
        elapsed={s.status === "done" && seconds !== undefined ? seconds : undefined}
        color={s.status === "done" ? (tone === "light" ? "#A8E3B8" : "#15803D") : s.status === "error" ? "#92400E" : ink}
        doneColor={tone === "light" ? "#A8E3B8" : "#15803D"}
        errorColor="#92400E"
        pattern="orbit"
        cellSize={4}
        gap={2}
        fontSize={12}
        idleOpacity={0.2}
      />
    </span>
  );
}

function Avatar({ mono, tone }: { mono: string; tone: "ink" | "neel" | "haldi" | "line" }) {
  const c = { ink: "bg-ink text-ground", neel: "bg-neel text-white", haldi: "bg-haldi text-ink", line: "bg-line text-ink-2" }[tone];
  return <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full font-display text-lg font-semibold ${c}`}>{mono}</span>;
}

const secs = (s: AgentState) => (s.start && s.end && !s.simulated ? (s.end - s.start) / 1000 : undefined); // never show replay pacing as model time
const evidenceItem = (e: Evidence) => ({ source: e.source, url: e.url, quote: e.quote });

/* ---------- round 1: analyst cards ---------- */

function findingsOf(key: AgentKey, data: unknown): { claim: string; e: Evidence; flag?: boolean }[] {
  if (!data || typeof data !== "object" || "error" in (data as object)) return [];
  if (key === "fundamentals") {
    const d = data as Fundamentals;
    return [...d.red_flags.map((e) => ({ claim: e.claim ?? "", e, flag: true })), ...d.points.map((e) => ({ claim: e.claim ?? "", e }))];
  }
  if (key === "earnings_call") {
    const d = data as EarningsCall;
    return [...d.highlights, ...d.guidance, ...d.concerns].map((e) => ({ claim: e.claim ?? "", e }));
  }
  const d = data as News;
  return d.events.map((e) => ({ claim: e.claim ?? "", e }));
}

export function AnalystCard({ k, name, role, mono, s }: { k: AgentKey; name: string; role: string; mono: string; s: AgentState }) {
  const reduce = useReducedMotion();
  const items = findingsOf(k, s.data).slice(0, 4);
  const overall = k === "news" && s.data && typeof s.data === "object" && "overall" in (s.data as object) ? (s.data as News).overall : null;
  const tone = k === "earnings_call" && s.data && typeof s.data === "object" && "tone" in (s.data as object) ? (s.data as EarningsCall).tone : null;
  return (
    <BorderGlow {...GLOW} borderRadius={28} className={`glow-open h-full ${s.status === "running" ? "ring-4 ring-neel/10" : ""}`}>
    <motion.article layout={!reduce} className="flex h-full flex-col p-5">
      <header className="flex items-center gap-3">
        <Avatar mono={mono} tone={s.status === "waiting" ? "line" : "ink"} />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-semibold leading-tight">{name}</h3>
          <p className="truncate text-sm text-muted">{role}</p>
        </div>
        <StatusChip s={s} seconds={secs(s)} />
      </header>
      <div className="mt-4 flex-1">
        {s.status === "done" && items.length > 0 && (
          <ul className="flex flex-col gap-3">
            {items.map((f, i) => (
              <motion.li
                key={i}
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: i * 0.08, ease: EASE }}
                className="text-[15px] leading-snug text-ink"
              >
                {f.flag && <span className="mr-1.5 rounded bg-firewall-tint px-1.5 py-0.5 font-mono text-[10px] text-firewall uppercase">red flag</span>}
                {f.claim}
                <Citation n={i + 1} item={evidenceItem(f.e)} />
              </motion.li>
            ))}
          </ul>
        )}
        {s.status === "done" && items.length === 0 && (
          <p className="text-sm text-muted">
            {k === "earnings_call" && (s.data as EarningsCall | undefined)?.unavailable
              ? `${(s.data as EarningsCall).unavailable} The rest of the council works from the annual report, financials and news.`
              : "Nothing verifiable in the sources for this round."}
          </p>
        )}
        {s.status === "running" && (
          <div className="flex flex-col gap-2.5" aria-hidden="true">
            {[88, 72, 80].map((w, i) => (
              <span key={i} className="h-3 animate-blink rounded-full bg-line" style={{ width: `${w}%`, animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
        )}
        {s.status === "error" && <p className="text-sm text-firewall">This analyst failed ({s.error}). The council continues without it.</p>}
      </div>
      {(overall || tone) && s.status === "done" && (
        <footer className="mt-4 border-t border-line pt-3 text-sm text-ink-2">
          {overall && (
            <>
              News flow: <span className="font-medium text-ink">{overall}</span>
            </>
          )}
          {tone && (
            <>
              Management tone: <span className="font-medium text-ink">{tone.claim}</span>
              <Citation n="T" item={evidenceItem(tone)} />
            </>
          )}
        </footer>
      )}
    </motion.article>
    </BorderGlow>
  );
}

/* ---------- round 2 + 3: the debate ---------- */

function Bubble({ a, side, idx, reply }: { a: Argument; side: "bull" | "bear"; idx: number; reply?: boolean }) {
  const reduce = useReducedMotion();
  const bull = side === "bull";
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, delay: idx * 0.09, ease: EASE }}
      className={`${reply ? "ml-6 border-l-2 pl-4 " + (bull ? "border-neel/30" : "border-haldi/40") : ""}`}
    >
      <div
        className={`rounded-3xl px-5 py-4 text-[15px] leading-relaxed ${
          reply ? "bg-paper text-ink-2" : bull ? "rounded-tl-md bg-neel-tint text-ink" : "rounded-tr-md bg-haldi-tint text-ink"
        }`}
      >
        {reply && a.answers && (
          <span className="mb-1 block font-mono text-[11px] text-muted">
            answers {bull ? "the Bear's" : "the Bull's"} point {a.answers}
          </span>
        )}
        {!reply && <span className={`mr-2 font-mono text-[11px] ${bull ? "text-neel" : "text-haldi-text"}`}>A{idx + 1}</span>}
        {a.point}
        {a.sources.map((s, i) => (
          <Citation key={i} n={i + 1} item={s} tone={bull ? "neel" : "haldi"} />
        ))}
        <EvidenceStrength sources={a.sources} />
      </div>
    </motion.div>
  );
}

export function DebateColumn({ side, main, replies }: { side: "bull" | "bear"; main: AgentState; replies: AgentState }) {
  const bull = side === "bull";
  const args = (Array.isArray(main.data) ? main.data : []) as Argument[];
  const reps = (Array.isArray(replies.data) ? replies.data : []) as Argument[];
  return (
    <section aria-label={bull ? "The case for" : "The case against"} className="flex flex-col gap-3">
      <header className={`flex items-center gap-3 ${bull ? "" : "md:flex-row-reverse md:text-right"}`}>
        <Avatar mono="B" tone={main.status === "waiting" ? "line" : bull ? "neel" : "haldi"} />
        <div className="flex-1">
          <h3 className={`font-display text-2xl font-semibold ${bull ? "text-neel" : "text-haldi-text"}`}>{bull ? "The Bull" : "The Bear"}</h3>
          <p className="text-sm text-muted">{bull ? "The strongest case for" : "The strongest case against"}</p>
        </div>
        <StatusChip s={main} seconds={secs(main)} tone={bull ? "neel" : "haldi"} />
      </header>
      {main.status === "running" && (
        <div className={`w-fit rounded-3xl px-5 py-4 ${bull ? "bg-neel-tint" : "bg-haldi-tint md:self-end"}`}>
          <Typing tone={bull ? "neel" : "haldi"} />
        </div>
      )}
      {main.status === "error" && <p className="text-sm text-firewall">The {bull ? "Bull" : "Bear"} failed ({main.error}); the rest of the briefing still stands.</p>}
      {args.map((a, i) => (
        <Bubble key={i} a={a} side={side} idx={i} />
      ))}
      {replies.status === "running" && (
        <div className="ml-6 w-fit rounded-3xl bg-paper px-5 py-4">
          <Typing tone={bull ? "neel" : "haldi"} />
        </div>
      )}
      {reps.map((a, i) => (
        <Bubble key={`r${i}`} a={a} side={side} idx={i} reply />
      ))}
    </section>
  );
}

/* ---------- the verdict ---------- */

export function Verdict({ chief, risks }: { chief: AgentState; risks: AgentState }) {
  const reduce = useReducedMotion();
  const c = chief.data as Chief | undefined;
  const rs = (Array.isArray(risks.data) ? risks.data : []) as Argument[];
  return (
    <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
      <section aria-label="Bottom line" className="relative overflow-hidden rounded-[32px] bg-ink p-7 text-ground sm:p-10">
        <div className="flex items-center gap-3">
          <Avatar mono="C" tone={chief.status === "waiting" ? "line" : "haldi"} />
          <div className="flex-1">
            <h3 className="font-display text-xl font-semibold">The bottom line</h3>
            <p className="text-sm text-lilac">From the Chief, weighing both sides</p>
          </div>
          <StatusChip s={chief} seconds={secs(chief)} tone="light" />
        </div>
        <AnimatePresence mode="wait">
          {c?.bottom_line ? (
            <motion.p
              key="bl"
              initial={reduce ? false : { opacity: 0, y: 18, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 1.1, ease: EASE }}
              className="mt-7 font-display text-[clamp(1.35rem,2.4vw,2rem)] leading-[1.3] font-medium tracking-[-0.01em]"
            >
              {c.bottom_line}
            </motion.p>
          ) : (
            <div key="wait" className="mt-8 flex flex-col gap-3" aria-hidden="true">
              {[92, 84, 60].map((w, i) => (
                <span key={i} className="h-4 animate-blink rounded-full bg-white/10" style={{ width: `${w}%`, animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          )}
        </AnimatePresence>
        {c && c.what_to_watch?.length > 0 && (
          <div className="mt-8 border-t border-white/10 pt-6">
            <h4 className="font-mono text-xs text-haldi">What to watch</h4>
            {/* React Bits AnimatedList: rows pop in one by one; arrow keys move through them. */}
            <AnimatedList
              items={c.what_to_watch.map((w, i) => ({ id: i, title: w, icon: <span className="h-1.5 w-4 rounded-full bg-haldi" /> }))}
              theme="dark"
              frame={false}
              accentColor="#D97706"
              animation="slide"
              showGradients={false}
              displayScrollbar={false}
              width="100%"
              maxHeight="none"
              radius={16}
              className="al-wrap mt-3 -mx-1.5"
            />
          </div>
        )}
      </section>
      <section aria-label="Risks" className="rounded-[32px] border border-line bg-paper p-7">
        <header className="flex items-center gap-3">
          <Avatar mono="R" tone={risks.status === "waiting" ? "line" : "ink"} />
          <div className="flex-1">
            <h3 className="font-display text-xl font-semibold">Where each side could be wrong</h3>
            <p className="text-sm text-muted">The Risk analyst</p>
          </div>
        </header>
        {risks.status === "running" && <div className="mt-5"><Typing /></div>}
        <ul className="mt-5 flex flex-col gap-4">
          {rs.map((a, i) => (
            <motion.li
              key={i}
              initial={reduce ? false : { opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: i * 0.1, ease: EASE }}
              className="text-[15px] leading-relaxed text-ink"
            >
              {a.point}
              {a.sources.map((s, j) => (
                <Citation key={j} n={j + 1} item={s} />
              ))}
              <EvidenceStrength sources={a.sources} />
            </motion.li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/* ---------- the firewall log ---------- */

export function Firewall({ council }: { council: CouncilT }) {
  const g = council.guardrail;
  return (
    <section aria-label="Firewall" className="rounded-[28px] border border-firewall/20 bg-firewall-tint/60 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2">
          <path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
        <h2 className="font-display text-xl font-semibold text-firewall">
          The firewall passed <CountUp to={g.passed} duration={1.4} easing="expo" /> statements and kept{" "}
          <CountUp to={g.blocked.length} duration={1.4} easing="expo" /> out
        </h2>
      </div>
      {g.blocked.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-3">
          {g.blocked.map((b, i) => (
            <li key={i} className="rounded-2xl bg-paper/80 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px]">
                <span className="text-muted">{b.where.replace(/^\./, "").replace(/\./g, " › ").replace(/_/g, " ")}</span>
                <span className="text-firewall">{b.reason}</span>
              </div>
              <p className="mt-1.5 text-[15px] text-ink-2 line-through decoration-haldi decoration-2">{b.text}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-ink-2">Nothing needed blocking this time: every claim matched its source.</p>
      )}
    </section>
  );
}
