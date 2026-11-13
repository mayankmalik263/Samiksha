"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Citation from "@/components/Citation";
import EvidenceStrength from "@/components/Evidence";
import CountUp from "@/components/reactbits/CountUp";
import StatusBadge from "@/components/StatusBadge";
import { AgentAvatar } from "@/components/council/Robot";

import type { AgentKey, AgentState, Argument, Chief, Council as CouncilT, EarningsCall, Evidence, Fundamentals, News } from "@/lib/council";

const SPRING = { type: "spring", bounce: 0, duration: 0.4 } as const; // critically damped, Apple's default

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

function StatusChip({ s, seconds, tone }: { s: AgentState; seconds?: number; tone?: "neel" | "haldi" | "light" }) {
  return <StatusBadge status={s.status} seconds={seconds} dark={tone === "light"} />;
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
    <motion.article layout={!reduce} className={`flex h-full flex-col rounded-[28px] border bg-paper p-5 transition-colors ${s.status === "running" ? "border-neel/40" : "border-line"}`}>
      <header className="flex items-center gap-3">
        <AgentAvatar k={k} state={s.status} />
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
                transition={{ ...SPRING, delay: i * 0.08 }}
                className="text-base leading-snug text-ink"
              >
                {f.flag && <span className="mr-1.5 rounded bg-firewall-tint px-1.5 py-0.5 kicker text-firewall">red flag</span>}
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
      transition={{ ...SPRING, delay: idx * 0.09 }}
      className={`${reply ? "ml-6 border-l-2 pl-4 " + (bull ? "border-neel/30" : "border-haldi/40") : ""}`}
    >
      <div
        className={`rounded-3xl px-5 py-4 text-base leading-relaxed ${
          reply ? "bg-paper text-ink-2" : bull ? "rounded-tl-md bg-neel-tint text-ink" : "rounded-tr-md bg-haldi-tint text-ink"
        }`}
      >
        {reply && a.answers && (
          <span className="mb-1 block text-caption text-muted">
            answers {bull ? "the Bear's" : "the Bull's"} point {a.answers}
          </span>
        )}
        {!reply && <span className={`mr-2 text-caption ${bull ? "text-neel" : "text-haldi-text"}`}>A{idx + 1}</span>}
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
        <AgentAvatar k={bull ? "bull_case" : "bear_case"} state={main.status} />
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
    <div className="grid items-start gap-5 lg:grid-cols-[1.35fr_1fr]">
      <section aria-label="Bottom line" className="relative overflow-hidden rounded-[32px] bg-ink p-7 text-ground sm:p-10">
        <div className="flex items-center gap-3">
          <AgentAvatar k="chief" state={chief.status} />
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
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={SPRING}
              className="mt-7 font-display text-[clamp(1.2rem,1.9vw,1.55rem)] leading-[1.45] font-medium tracking-[-0.011em]"
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
            <h4 className="kicker text-haldi">What to watch</h4>
            <ul className="mt-3 flex flex-col gap-3">
              {c.what_to_watch.map((w, i) => (
                <li key={i} className="flex gap-3 text-base leading-snug text-ground/90">
                  <span aria-hidden="true" className="mt-2 h-1.5 w-4 shrink-0 rounded-full bg-haldi" />
                  {w}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
      <section aria-label="Risks" className="rounded-[32px] border border-line bg-paper p-7">
        <header className="flex items-center gap-3">
          <AgentAvatar k="risks" state={risks.status} />
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
              transition={{ ...SPRING, delay: i * 0.1 }}
              className="text-base leading-relaxed text-ink"
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
              <div className="flex flex-wrap items-center justify-between gap-2 text-caption">
                <span className="text-muted">{b.where.replace(/^\./, "").replace(/\./g, " › ").replace(/_/g, " ")}</span>
                <span className="text-firewall">{b.reason}</span>
              </div>
              <p className="mt-1.5 text-base text-ink-2 line-through decoration-haldi decoration-2">{b.text}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-ink-2">Nothing needed blocking this time: every claim matched its source.</p>
      )}
    </section>
  );
}
