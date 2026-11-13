import Link from "next/link";

export default function Nav({ children }: { children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-ground/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" aria-label="Samiksha home" className="rounded-md">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/samiksha-horizontal.svg" alt="Samiksha" className="h-7 w-auto sm:h-8" />
        </Link>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-ink-2">
          {children}
          <span className="rounded-full border border-line-2 bg-paper px-3 py-1 text-xs font-medium text-muted">
            Educational. Not investment advice.
          </span>
        </nav>
      </div>
    </header>
  );
}
