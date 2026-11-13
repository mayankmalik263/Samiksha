"use client";

/**
 * The shareable briefing: one clean sheet, made to be screenshotted for a post or saved as a PDF (print).
 * Same content as the live report, with every claim numbered against a source list at the bottom.
 */
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { prettySource } from "@/components/Citation";
import EvidenceStrength, { evidenceSummary } from "@/components/Evidence";
import { API, DEMO_STOCKS, type Argument, type Council } from "@/lib/council";

type Brief = Extract<Council["briefing"], { bottom_line: string }>;


export default function SharePage() {
  const { ticker: raw } = useParams<{ ticker: string }>();
  const ticker = decodeURIComponent(raw).toUpperCase();
  const [council, setCouncil] = useState<Council | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!(ticker in DEMO_STOCKS)) return setError(`"${ticker}" isn't in the demo yet.`);
    fetch(`${API}/analyze`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticker }) })
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error((await r.json()).detail ?? r.statusText))))
      .then((j) => setCouncil(j.council))
      .catch((e) => setError(`Couldn't load the briefing: ${e.message}`));
  }, [ticker]);

  const b = council && "bottom_line" in council.briefing ? (council.briefing as Brief) : null;

  // number every distinct source once, in order of first use
  const { notes, numberOf } = useMemo(() => {
    const notes: { source: string; url: string; quote: string }[] = [];
    const index = new Map<string, number>();
    const numberOf = (s: { source: string; url: string; quote: string }) => {
      const k = `${s.source}|${s.quote}`;
      if (!index.has(k)) {
        notes.push(s);
        index.set(k, notes.length);
      }
      return index.get(k)!;
    };
    if (b) [...b.bull_case, ...b.bear_case, ...b.risks].forEach((a) => a.sources.forEach(numberOf));
    return { notes, numberOf };
  }, [b]);

  const ev = b ? evidenceSummary([...b.bull_case, ...b.bear_case, ...b.risks]) : null;

  const list = (args: Argument[], tone: "neel" | "haldi" | "ink") => (
    <ol className="flex flex-col gap-3">
      {args.map((a, i) => (
        <li key={i} className="text-[15px] leading-relaxed text-ink">
          {a.point}{" "}
          <sup className={`font-mono text-[10px] ${tone === "neel" ? "text-neel" : tone === "haldi" ? "text-haldi-text" : "text-muted"}`}>
            [{a.sources.map(numberOf).join(",")}]
          </sup>
          <EvidenceStrength sources={a.sources} />
        </li>
      ))}
    </ol>
  );

  return (
    <div className="min-h-svh bg-ground py-8 print:bg-white print:py-0">
      {/* toolbar: never printed */}
      <div className="no-print mx-auto mb-6 flex max-w-[880px] flex-wrap items-center justify-between gap-3 px-4">
        <Link href={`/s/${ticker}`} className="rounded-md text-sm text-ink-2 hover:text-ink">← Back to the full report</Link>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(location.href).then(() => setCopied(true))}
            className="min-h-11 rounded-xl border border-line-2 bg-paper px-4 text-sm font-medium text-ink"
          >
            {copied ? "Link copied" : "Copy link"}
          </button>
          <button type="button" onClick={() => window.print()} className="min-h-11 rounded-xl bg-neel px-4 text-sm font-medium text-white">
            Save as PDF
          </button>
        </div>
      </div>

      <article className="mx-auto max-w-[880px] bg-paper px-8 py-10 shadow-[0_30px_80px_-40px_rgb(27_24_53/0.45)] sm:px-14 sm:py-14 print:max-w-none print:shadow-none">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/samiksha-horizontal.svg" alt="Samiksha" className="h-8 w-auto" />
          <span className="font-mono text-xs text-muted">
            Research briefing · NSE: {ticker}
            {council?.as_of && ` · ${new Date(council.as_of).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`}
          </span>
        </header>

        {error && <p className="mt-10 text-firewall">{error}</p>}
        {!error && !b && <p className="mt-10 text-muted">Loading the briefing… (if it wasn&apos;t written today, the council runs first, which takes a few minutes)</p>}

        {b && council && (
          <>
            <h1 className="mt-8 font-display text-[clamp(2.2rem,5vw,3.4rem)] leading-[1] font-semibold tracking-[-0.035em]">{DEMO_STOCKS[ticker]}</h1>
            <p className="mt-6 font-display text-[clamp(1.2rem,2.2vw,1.55rem)] leading-snug font-medium text-ink">{b.bottom_line}</p>

            <div className="mt-6 flex flex-wrap gap-2 font-mono text-[11px]">
              <span className="rounded-full bg-verified-tint px-3 py-1 text-verified">{council.guardrail.passed} statements verified against their sources</span>
              <span className="rounded-full bg-firewall-tint px-3 py-1 text-firewall">{council.guardrail.blocked.length} kept out by the firewall</span>
              {ev && <span className="rounded-full bg-neel-tint px-3 py-1 text-neel">{ev.corroborated} of {ev.total} arguments corroborated across documents</span>}
            </div>

            <div className="mt-10 grid gap-10 md:grid-cols-2 print:grid-cols-2">
              <section>
                <h2 className="mb-3 font-display text-xl font-semibold text-neel">The case for</h2>
                {list(b.bull_case, "neel")}
              </section>
              <section>
                <h2 className="mb-3 font-display text-xl font-semibold text-haldi-text">The case against</h2>
                {list(b.bear_case, "haldi")}
              </section>
            </div>

            <section className="mt-10 border-t border-line pt-8">
              <h2 className="mb-3 font-display text-xl font-semibold">Where each side could be wrong</h2>
              {list(b.risks, "ink")}
            </section>

            {b.what_to_watch.length > 0 && (
              <section className="mt-10 rounded-2xl bg-ink p-6 text-ground print:break-inside-avoid">
                <h2 className="font-mono text-xs tracking-wide text-haldi uppercase">What to watch</h2>
                <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
                  {b.what_to_watch.map((w, i) => (
                    <li key={i} className="flex gap-3 text-[15px] leading-snug">
                      <span aria-hidden="true" className="mt-2 h-1.5 w-4 shrink-0 rounded-full bg-haldi" />
                      {w}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="mt-10 print:break-inside-avoid">
              <h2 className="font-mono text-xs tracking-wide text-muted uppercase">Sources</h2>
              <ol className="mt-3 flex flex-col gap-1.5 text-[12.5px] text-ink-2">
                {notes.map((n, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="w-6 shrink-0 font-mono text-muted">[{i + 1}]</span>
                    <span>
                      <a href={n.url} target="_blank" rel="noopener noreferrer" className="font-medium text-neel underline-offset-2 hover:underline">
                        {prettySource(n.source)}
                      </a>{" "}
                      <span className="text-muted">“{n.quote}”</span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>

            <footer className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-5 text-xs text-muted">
              <span><strong className="text-ink">Educational. Not investment advice.</strong> No buy, sell or hold call is made.</span>
              <span className="font-mono">samiksha · every claim, cited</span>
            </footer>
          </>
        )}
      </article>
    </div>
  );
}
