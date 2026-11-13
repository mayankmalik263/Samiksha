"use client";

/**
 * A citation pill that opens a source card growing out of the pill itself (pattern adapted from 21st.dev
 * "AI Citation" by educalvolpz): hover or focus opens it, Escape closes it, and there's a short grace period
 * so the pointer can cross from pill to card. The card shows the exact quote the claim rests on: Samiksha's promise.
 */
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";

export type CiteItem = { source: string; url: string; quote: string; finding?: string };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "annual-report-2026 p.25" -> "Annual report 2026 · p.25"; "news 2026-10-16" -> "News · 16 Oct 2026". */
export function prettySource(s: string): string {
  const news = s.match(/^news (\d{4})-(\d{2})-(\d{2})/);
  if (news) return `News · ${+news[3]} ${MONTHS[+news[2] - 1]} ${news[1]}`;
  if (s.startsWith("yfinance-")) return `Financials · ${s.slice(9).replace(/-/g, " ")}`;
  const [doc, page] = s.split(" ");
  const name = doc.replace(/-/g, " ").replace(/\b(oct|nov|dec|jan|feb|mar|apr|may|jun|jul|aug|sep)\b/i, (m) => m[0].toUpperCase() + m.slice(1));
  return `${name[0].toUpperCase()}${name.slice(1)}${page ? ` · ${page}` : ""}`;
}

export default function Citation({ n, item, tone = "neel" }: { n: number | string; item: CiteItem; tone?: "neel" | "haldi" }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [below, setBelow] = useState(false); // flip under the pill when there's no room above (sticky header)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pillRef = useRef<HTMLAnchorElement>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const touch = useRef(false); // on touch there's no hover: the first tap shows the quote, the card holds the link
  const id = useId();

  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    const top = pillRef.current?.getBoundingClientRect().top ?? 999;
    setBelow(top < 300); // ~card height + the 64px header
    setOpen(true);
  };
  const hide = () => {
    timer.current = setTimeout(() => setOpen(false), 140);
  };
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => !wrapRef.current?.contains(e.target as Node) && setOpen(false); // tap elsewhere closes
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const pill =
    tone === "haldi"
      ? "border-haldi/40 bg-haldi-tint text-haldi-text hover:border-haldi"
      : "border-neel/30 bg-neel-tint text-neel hover:border-neel";

  return (
    <span ref={wrapRef} className="relative inline-block align-[0.15em]" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      <a
        ref={pillRef}
        onPointerDown={(e) => (touch.current = e.pointerType !== "mouse")}
        onClick={(e) => {
          if (touch.current && !open) {
            e.preventDefault();
            show();
          }
        }}
        href={item.url || undefined}
        target="_blank"
        rel="noopener noreferrer"
        aria-describedby={open ? id : undefined}
        aria-label={`Source ${n}: ${prettySource(item.source)}`}
        className={`relative mx-0.5 inline-flex h-5 min-w-5 items-center before:absolute before:-inset-3 before:content-[''] justify-center rounded-full border px-1.5 tabular-nums text-caption leading-none font-medium no-underline transition-colors ${pill}`}
      >
        {n}
      </a>
      <AnimatePresence>
        {open && (
          <motion.span
            id={id}
            role="dialog"
            aria-label="Source quote"
            initial={reduce ? { opacity: 1 } : { opacity: 0, scale: 0.94, y: below ? -6 : 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.96, y: below ? -4 : 4 }}
            transition={reduce ? { duration: 0 } : { type: "spring", bounce: 0.1, duration: 0.28 }}
            style={{ transformOrigin: below ? "top center" : "bottom center", translateX: "-50%" }}
            className={`absolute left-1/2 z-50 ${below ? "top-full mt-2" : "bottom-full mb-2"} block w-[min(320px,80vw)] rounded-2xl border border-line bg-paper p-4 text-left shadow-[0_18px_50px_-12px_rgb(27_24_53/0.35)]`}
          >
            <span className="flex items-center gap-2 text-caption text-muted">
              <svg aria-hidden="true" width="12" height="12" viewBox="0 0 256 256">
                <path fill="#1B1835" d="M32 36 H60 V220 H32 Z M224 36 H196 V220 H224 Z" />
                <path fill="#4338CA" d="M60 36 H92 L76 60 H60 Z M60 196 H76 L92 220 H60 Z M196 36 H164 L180 60 H196 Z M196 196 H180 L164 220 H196 Z" />
                <rect fill="#D97706" x="88" y="104" width="80" height="48" rx="24" />
              </svg>
              <span className="truncate">{prettySource(item.source)}</span>
            </span>
            <span className="mt-2 block font-display text-base leading-snug text-ink">
              “<span className="highlight">{item.quote}</span>”
            </span>
            {item.finding && <span className="mt-2 block text-sm leading-relaxed text-ink-2">{item.finding}</span>}
            {item.url && (
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-neel underline-offset-2 hover:underline">
                Open the source page ↗
              </a>
            )}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
