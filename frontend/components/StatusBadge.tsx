/**
 * The one status readout, used everywhere an agent's state shows: waiting, working, done, failed. Same icon set,
 * same size as a line of small text, no pill. Times appear only for live runs (a replay's pacing isn't model time).
 */
export type Status = "waiting" | "running" | "done" | "error";

const LABEL: Record<Status, string> = { waiting: "Waiting", running: "Working", done: "Done", error: "Failed" };

export function StatusIcon({ status, dark = false, className = "h-4 w-4" }: { status: Status; dark?: boolean; className?: string }) {
  if (status === "running")
    return (
      <svg viewBox="0 0 16 16" className={`${className} animate-spin [animation-duration:900ms]`} aria-hidden="true">
        <circle cx="8" cy="8" r="6" fill="none" strokeWidth="2" className={dark ? "stroke-white/15" : "stroke-neel-tint"} />
        <path d="M8 2a6 6 0 0 1 6 6" fill="none" strokeWidth="2" strokeLinecap="round" className={dark ? "stroke-lilac" : "stroke-neel"} />
      </svg>
    );
  if (status === "done")
    return (
      <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
        <circle cx="8" cy="8" r="7" className={dark ? "fill-[#A8E3B8]" : "fill-verified"} />
        <path d="M5 8.2l2 2 4-4.2" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={dark ? "stroke-ink" : "stroke-white"} />
      </svg>
    );
  if (status === "error")
    return (
      <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
        <circle cx="8" cy="8" r="7" className="fill-firewall" />
        <path d="M5.8 5.8l4.4 4.4M10.2 5.8l-4.4 4.4" fill="none" strokeWidth="1.8" strokeLinecap="round" className="stroke-white" />
      </svg>
    );
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
      <circle cx="8" cy="8" r="6" fill="none" strokeWidth="1.6" strokeDasharray="2.4 2.2" className={dark ? "stroke-white/30" : "stroke-line-2"} />
    </svg>
  );
}

export default function StatusBadge({ status, seconds, dark = false }: { status: Status; seconds?: number; dark?: boolean }) {
  const tone = status === "waiting" ? (dark ? "text-lilac/70" : "text-muted") : dark ? "text-lilac" : status === "error" ? "text-firewall" : "text-ink-2";
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 text-sm font-medium ${tone}`} role="status">
      <StatusIcon status={status} dark={dark} />
      {LABEL[status]}
      {status === "done" && seconds !== undefined && <span className="font-mono text-caption tabular-nums opacity-70">{seconds.toFixed(1)}s</span>}
    </span>
  );
}
