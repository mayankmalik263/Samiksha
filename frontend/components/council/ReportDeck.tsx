"use client";

/**
 * The briefing as a stack of research pages, one per agent, turned like paper: each page swings over on its left
 * edge (the spine) in 3D. Arrow keys, swipe, the buttons or the page tabs move through it. Pages appear as agents
 * finish; while the council is still working, a "being written" page waits at the end. The last page is the verdict.
 */
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, type PanInfo } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import Citation from "@/components/Citation";
import EvidenceStrength, { evidenceSummary } from "@/components/Evidence";
import CountUp from "@/components/reactbits/CountUp";
import { StatusIcon } from "@/components/StatusBadge";
import type { AgentKey, AgentState, Argument, Chief, Council, EarningsCall, Evidence, Fundamentals, News } from "@/lib/council";

type Section = { heading: string; items: { text: string; cite?: { source: string; url: string; quote: string; finding?: string }[]; flag?: string; answers?: string; strength?: boolean }[] };
type Page = { key: string; kicker: string; title: string; sub: string; tone: "ink" | "neel" | "haldi" | "verdict"; sections: Section[]; lead?: string; watch?: string[]; evidence?: ReturnType<typeof evidenceSummary> };

const ev = (e: Evidence) => ({ text: e.claim ?? "", cite: [{ source: e.source, url: e.url, quote: e.quote }] });
const arg = (a: Argument) => ({ text: a.point, cite: a.sources, answers: a.answers || undefined, strength: true });
const ok = (d: unknown) => !!d && typeof d === "object" && !("error" in (d as object));

function buildPages(agents: Record<AgentKey, AgentState>, ticker: string): Page[] {
  const pages: Page[] = [];
  const d = (k: AgentKey) => (agents[k].status === "done" ? agents[k].data : undefined);

  const f = d("fundamentals") as Fundamentals | undefined;
  if (ok(f))
    pages.push({
      key: "fundamentals", kicker: "Research", title: "Fundamentals", sub: `${ticker} · annual report and five years of financials`, tone: "ink",
      sections: [
        ...(f!.red_flags.length ? [{ heading: "Red flags", items: f!.red_flags.map((e) => ({ ...ev(e), flag: "red flag" })) }] : []),
        { heading: "What the numbers say", items: f!.points.map(ev) },
        ...(f!.not_found?.length ? [{ heading: "Looked for, not found in the sources", items: f!.not_found.map((t) => ({ text: t })) }] : []),
      ],
    });
  const e = d("earnings_call") as EarningsCall | undefined;
  if (ok(e))
    pages.push({
      key: "earnings_call", kicker: "Research", title: "Earnings call", sub: "What management said on the latest call", tone: "ink",
      lead: e!.unavailable ? `${e!.unavailable} The other agents work from the annual report, financials and news.` : e!.tone?.claim ? `Tone: ${e!.tone.claim}` : undefined,
      sections: [
        { heading: "Highlights", items: e!.highlights.map(ev) },
        { heading: "Guidance", items: e!.guidance.map(ev) },
        { heading: "Concerns raised", items: e!.concerns.map(ev) },
      ].filter((s) => s.items.length),
    });
  const n = d("news") as News | undefined;
  if (ok(n))
    pages.push({
      key: "news", kicker: "Research", title: "News", sub: "The last 30 days of headlines", tone: "ink",
      lead: `Overall news flow: ${n!.overall}`,
      sections: [{ heading: "What happened", items: n!.events.map(ev) }],
    });
  const bull = d("bull_case") as Argument[] | undefined;
  if (Array.isArray(bull))
    pages.push({
      key: "bull", kicker: "Debate", title: "The case for", sub: "Argued by the Bull, from verified findings only", tone: "neel",
      sections: [
        { heading: "Arguments", items: bull.map(arg) },
        ...(Array.isArray(d("bull_rebuttals")) ? [{ heading: "The Bull answers the Bear", items: (d("bull_rebuttals") as Argument[]).map(arg) }] : []),
      ],
    });
  const bear = d("bear_case") as Argument[] | undefined;
  if (Array.isArray(bear))
    pages.push({
      key: "bear", kicker: "Debate", title: "The case against", sub: "Argued by the Bear, from verified findings only", tone: "haldi",
      sections: [
        { heading: "Arguments", items: bear.map(arg) },
        ...(Array.isArray(d("bear_rebuttals")) ? [{ heading: "The Bear answers the Bull", items: (d("bear_rebuttals") as Argument[]).map(arg) }] : []),
      ],
    });
  const risks = d("risks") as Argument[] | undefined;
  if (Array.isArray(risks))
    pages.push({ key: "risks", kicker: "Stress test", title: "Where each side could be wrong", sub: "The Risk analyst", tone: "ink", sections: [{ heading: "Risks", items: risks.map(arg) }] });
  const chief = d("chief") as Chief | undefined;
  if (chief?.bottom_line)
    pages.push({
      key: "verdict", kicker: "Verdict", title: "The bottom line", sub: "From the Chief, weighing both sides. Never a buy or sell call.", tone: "verdict",
      lead: chief.bottom_line, watch: chief.what_to_watch, sections: [],
      evidence: evidenceSummary([bull, bear, risks].flatMap((x) => (Array.isArray(x) ? x : []))),
    });
  return pages;
}

const TONE = {
  ink: { kicker: "text-muted", rule: "bg-ink", pill: "neel" as const },
  neel: { kicker: "text-neel", rule: "bg-neel", pill: "neel" as const },
  haldi: { kicker: "text-haldi-text", rule: "bg-haldi", pill: "haldi" as const },
  verdict: { kicker: "text-haldi", rule: "bg-haldi", pill: "neel" as const },
};

function Sheet({ page, index, total, council }: { page: Page; index: number; total: number; council?: Council }) {
  const t = TONE[page.tone];
  const dark = page.tone === "verdict";
  return (
    <article
      className={`relative min-h-[560px] rounded-r-[22px] rounded-l-md p-7 shadow-[0_30px_70px_-30px_rgb(27_24_53/0.45)] sm:p-11 ${dark ? "bg-ink text-ground" : "bg-paper text-ink"}`}
      style={{ backfaceVisibility: "hidden" }}
    >
      {/* the spine shadow on the left edge */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-8 rounded-l-md bg-gradient-to-r from-ink/10 to-transparent" />
      <header className="flex items-baseline justify-between gap-4">
        <span className={`kicker uppercase ${t.kicker}`}>{page.kicker}</span>
        <span className={`text-sm tabular-nums ${dark ? "text-lilac" : "text-muted"}`}>
          Page {index + 1} of {total}
        </span>
      </header>
      <h3 className="mt-4 font-display text-[clamp(2rem,4vw,3.2rem)] leading-[1] font-semibold tracking-[-0.022em]">{page.title}</h3>
      <p className={`mt-2 text-sm ${dark ? "text-lilac" : "text-muted"}`}>{page.sub}</p>
      <span aria-hidden="true" className={`mt-6 block h-1.5 w-16 rounded-full ${t.rule}`} />

      {page.lead && (
        <p className={`mt-6 font-display leading-snug ${dark ? "text-[clamp(1.2rem,1.9vw,1.5rem)] leading-[1.45] font-medium" : "text-lg text-ink-2"}`}>{page.lead}</p>
      )}

      {page.sections.map((s) => (
        <section key={s.heading} className="mt-7">
          <h4 className={`kicker ${dark ? "text-lilac" : "text-muted"}`}>{s.heading}</h4>
          <ol className="mt-3 flex flex-col gap-3.5">
            {s.items.map((it, i) => (
              <li key={i} className="flex gap-3 text-lg leading-relaxed">
                <span className={`mt-1.5 w-5 shrink-0 font-mono text-caption tabular-nums ${dark ? "text-lilac" : "text-muted"}`}>{String(i + 1).padStart(2, "0")}</span>
                <span>
                  {it.flag && <span className="mr-1.5 rounded bg-firewall-tint px-1.5 py-0.5 kicker text-firewall">{it.flag}</span>}
                  {it.answers && <span className="mr-1.5 text-caption text-muted">re {it.answers}</span>}
                  {it.text}
                  {it.cite?.map((c, j) => <Citation key={j} n={j + 1} item={c} tone={t.pill} />)}
                  {it.strength && it.cite && <EvidenceStrength sources={it.cite} dark={dark} />}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ))}

      {page.watch && page.watch.length > 0 && (
        <section className="mt-9 border-t border-white/10 pt-6">
          <h4 className="kicker text-haldi">What to watch</h4>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {page.watch.map((w, i) => (
              <li key={i} className="flex gap-3 text-base leading-snug text-ground/90">
                <span aria-hidden="true" className="mt-2 h-1.5 w-4 shrink-0 rounded-full bg-haldi" />
                {w}
              </li>
            ))}
          </ul>
        </section>
      )}
      {page.evidence && page.evidence.total > 0 && (
        <p className="mt-9 text-sm text-lilac">
          Evidence behind the debate: <span className="font-semibold text-ground">{page.evidence.corroborated}</span> of {page.evidence.total} arguments are
          corroborated across different kinds of document, <span className="font-semibold text-ground">{page.evidence.supported}</span> more have several
          citations. This rates the sourcing, not the stock.
        </p>
      )}
      {dark && council && (
        <p className="mt-9 rounded-2xl bg-white/5 p-4 text-sm text-lilac">
          The firewall checked every statement against its source: <span className="font-semibold text-ground"><CountUp to={council.guardrail.passed} duration={1.2} /></span> passed,{" "}
          <span className="font-semibold text-haldi"><CountUp to={council.guardrail.blocked.length} duration={1.2} /></span> were kept out. Educational. Not investment advice.
        </p>
      )}
    </article>
  );
}

function Writing({ index, total, next }: { index: number; total: number; next: string }) {
  return (
    <article className="relative grid min-h-[560px] place-items-center rounded-r-[22px] rounded-l-md border border-dashed border-line-2 bg-paper/70 p-10 text-center">
      <div>
        <p className="text-sm text-muted tabular-nums">Page {index + 1} of {total}+</p>
        <p className="mt-6 inline-flex items-center gap-2 text-lg font-medium text-neel">
          <StatusIcon status="running" className="h-5 w-5" />
          {next} is writing
        </p>
        <p className="mx-auto mt-4 max-w-sm text-sm text-muted">This page fills in the moment the agent finishes. Its findings go into the dossier above.</p>
      </div>
    </article>
  );
}

// Momentum projection (Apple): where a flick would come to rest, so a quick short swipe still turns the page.
const project = (v: number, d = 0.998) => ((v / 1000) * d) / (1 - d);
const SPRING = { type: "spring", bounce: 0, duration: 0.45 } as const;

/**
 * One sheet that turns under the finger. Dragging left lifts it on its spine 1:1 (rotateY follows the drag); release
 * decides from the projected rest point, not the release point, and the turn carries on from where the finger left it
 * (the exit animates the same motion value, so it starts at the on-screen angle and velocity). Dragging right asks for
 * the previous page with a rubber-band pull.
 */
function Turnable({ children, dir, onNext, onPrev, canNext, canPrev, reduce }: {
  children: React.ReactNode; dir: number; onNext: () => void; onPrev: () => void; canNext: boolean; canPrev: boolean; reduce: boolean;
}) {
  const rotateY = useMotionValue(dir < 0 && !reduce ? -105 : 0);
  const x = useMotionValue(0);
  const width = useRef(800);
  const el = useRef<HTMLDivElement>(null);
  const onPanStart = () => {
    width.current = el.current?.offsetWidth || 800;
  };
  const onPan = (_: PointerEvent, i: PanInfo) => {
    if (reduce) return;
    if (i.offset.x < 0 && canNext) rotateY.set(Math.max(-105, (i.offset.x / width.current) * 140));
    else if (i.offset.x > 0 && canPrev) x.set((i.offset.x * 0.55 * 300) / (300 + 0.55 * i.offset.x)); // rubber band
  };
  const onPanEnd = (_: PointerEvent, i: PanInfo) => {
    const rest = i.offset.x + project(i.velocity.x);
    animate(x, 0, SPRING);
    if (rest < -width.current * 0.35 && canNext) return onNext();
    if (rest > width.current * 0.25 && canPrev) return onPrev();
    animate(rotateY, 0, SPRING);
  };
  return (
    <motion.div
      ref={el}
      initial={reduce ? { opacity: 0 } : false}
      animate={{ rotateY: 0, opacity: 1, zIndex: 1, transition: reduce ? { duration: 0.2 } : SPRING }}
      exit={
        reduce
          ? { opacity: 0, transition: { duration: 0.15 } }
          : dir > 0
            ? { rotateY: -105, zIndex: 2, transition: SPRING }
            : { opacity: 0, zIndex: 0, transition: { duration: 0.3, delay: 0.25 } }
      }
      onPanStart={onPanStart}
      onPan={onPan}
      onPanEnd={onPanEnd}
      className="[grid-area:1/1] cursor-grab touch-pan-y active:cursor-grabbing"
      style={{ rotateY, x, transformOrigin: "left center", transformStyle: "preserve-3d" }}
      aria-live="polite"
    >
      {children}
    </motion.div>
  );
}

export default function ReportDeck({ agents, ticker, running, council }: { agents: Record<AgentKey, AgentState>; ticker: string; running: boolean; council?: Council }) {
  const reduce = useReducedMotion() ?? false;
  const pages = useMemo(() => buildPages(agents, ticker), [agents, ticker]);
  const pending = running ? ["fundamentals", "earnings_call", "news", "bull_case", "bear_case", "risks", "chief"].find((k) => agents[k as AgentKey].status !== "done") : undefined;
  const names: Record<string, string> = { fundamentals: "Fundamentals", earnings_call: "Earnings call", news: "News", bull_case: "The Bull", bear_case: "The Bear", risks: "Risk", chief: "The Chief" };
  const total = pages.length + (pending ? 1 : 0);
  const [[i, dir], setPage] = useState<[number, number]>([0, 1]);
  const seen = useRef(0);
  const box = useRef<HTMLDivElement>(null);
  const at = Math.min(i, Math.max(0, total - 1));
  const fresh = running && pages.length > seen.current && at < pages.length - 1; // a page landed while you were reading

  const go = (to: number) => {
    const next = Math.max(0, Math.min(total - 1, to));
    if (next === at) return;
    setPage([next, next > at ? 1 : -1]);
    if (next >= pages.length - 1) seen.current = pages.length;
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (tag === "input" || tag === "textarea" || !box.current) return;
      const r = box.current.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return; // only while the deck is on screen
      if (e.key === "ArrowRight") go(at + 1);
      if (e.key === "ArrowLeft") go(at - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (total === 0) return null;

  return (
    <section ref={box} aria-label="The report, page by page" aria-roledescription="carousel" className="mx-auto max-w-3xl">
      {/* page tabs */}
      <nav className="mb-5 flex flex-wrap gap-2" aria-label="Pages">
        {pages.map((p, k) => (
          <button
            key={p.key}
            type="button"
            onClick={() => go(k)}
            aria-current={k === at ? "page" : undefined}
            className={`press min-h-11 rounded-full border px-4 text-sm ${k === at ? "border-ink bg-ink text-ground" : "border-line-2 bg-paper text-ink-2 hover:border-neel/50 hover:text-ink"}`}
          >
            {p.title}
          </button>
        ))}
        {pending && (
          <button type="button" onClick={() => go(pages.length)} className="press inline-flex min-h-11 items-center gap-2 rounded-full border border-dashed border-line-2 px-4 text-sm text-muted">
            <StatusIcon status="running" className="h-3.5 w-3.5" />
            {names[pending]} is writing
          </button>
        )}
      </nav>

      {/* the stack: two sheets peeking out behind give it thickness */}
      <div className="relative" style={{ perspective: "2200px" }}>
        <span aria-hidden="true" className="absolute inset-0 translate-x-3 translate-y-3 rounded-r-[22px] rounded-l-md bg-line/70" />
        <span aria-hidden="true" className="absolute inset-0 translate-x-1.5 translate-y-1.5 rounded-r-[22px] rounded-l-md bg-line-2/60" />
        <div className="relative grid">
          <AnimatePresence initial={false}>
            <Turnable
              key={at < pages.length ? pages[at].key : "writing"}
              dir={dir}
              reduce={reduce}
              canNext={at < total - 1}
              canPrev={at > 0}
              onNext={() => go(at + 1)}
              onPrev={() => go(at - 1)}
            >
              {at < pages.length ? (
                <Sheet page={pages[at]} index={at} total={total} council={council} />
              ) : (
                <Writing index={at} total={total} next={names[pending ?? "chief"]} />
              )}
            </Turnable>
          </AnimatePresence>
        </div>
      </div>

      {/* controls */}
      <div className="mt-6 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => go(at - 1)}
          disabled={at === 0}
          title="Previous page (←)"
          className="press inline-flex min-h-12 items-center gap-2 rounded-2xl border border-line-2 bg-paper px-5 font-medium text-ink hover:border-neel/50 disabled:opacity-40"
        >
          ← Previous
        </button>
        <span className="text-sm text-muted tabular-nums">
          {at + 1} of {total}
        </span>
        <button
          type="button"
          onClick={() => go(at + 1)}
          disabled={at >= total - 1}
          title="Next page (→), or swipe the page"
          className={`press relative inline-flex min-h-12 items-center gap-2 rounded-2xl bg-neel px-5 font-medium text-white hover:bg-neel-deep disabled:opacity-40 ${fresh ? "ring-4 ring-haldi/40" : ""}`}
        >
          {fresh ? "New page →" : "Next page →"}
        </button>
      </div>
    </section>
  );
}
