/**
 * Evidence strength: how well-sourced a claim is. It is about the claim's evidence, never about the stock
 * (SEBI-safe: no rating, no conviction score). Three levels:
 *   corroborated  - cited from 2+ different kinds of document (e.g. annual report AND concall)
 *   supported     - 2+ citations, same kind of document
 *   single source - one citation (still verified: the quote is in the source)
 */
import type { Source } from "@/lib/council";

const KIND: [RegExp, string][] = [
  [/^annual-report/, "annual report"],
  [/^concall/, "earnings call"],
  [/^yfinance/, "financials"],
  [/^news/, "news"],
];
export const kindOf = (source: string) => KIND.find(([re]) => re.test(source))?.[1] ?? "filing";

export type Strength = { level: 0 | 1 | 2; label: string; detail: string };

export function strengthOf(sources: Pick<Source, "source">[]): Strength {
  const kinds = [...new Set(sources.map((s) => kindOf(s.source)))];
  const docs = new Set(sources.map((s) => s.source)).size;
  if (kinds.length >= 2) return { level: 2, label: "Corroborated", detail: `${docs} citations across ${kinds.join(" + ")}` };
  if (sources.length >= 2) return { level: 1, label: "Supported", detail: `${sources.length} citations from the ${kinds[0]}` };
  return { level: 0, label: "Single source", detail: `1 citation from the ${kinds[0] ?? "source"}` };
}

export default function EvidenceStrength({ sources, dark = false }: { sources: Pick<Source, "source">[]; dark?: boolean }) {
  if (!sources?.length) return null;
  const s = strengthOf(sources);
  return (
    <span
      className={`ml-1.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 align-[0.1em] font-mono text-[10.5px] ${dark ? "bg-white/10 text-lilac" : "bg-ground text-muted ring-1 ring-line"}`}
      title={`Evidence: ${s.detail}. How well-sourced this claim is, not a rating of the stock.`}
    >
      <span aria-hidden="true" className="inline-flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className={`h-1.5 w-1.5 rounded-full ${i <= s.level ? (dark ? "bg-haldi" : "bg-neel") : dark ? "bg-white/20" : "bg-line-2"}`} />
        ))}
      </span>
      {s.label}
      <span className="sr-only">: {s.detail}. This rates the evidence, not the stock.</span>
    </span>
  );
}

/** One line for a whole briefing: how many arguments are corroborated across document kinds. */
export function evidenceSummary(args: { sources: Pick<Source, "source">[] }[]) {
  const levels = args.map((a) => strengthOf(a.sources).level);
  return { total: levels.length, corroborated: levels.filter((l) => l === 2).length, supported: levels.filter((l) => l === 1).length };
}
