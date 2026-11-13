import Link from "next/link";

export default function Nav({ children }: { children?: React.ReactNode }) {
  return (
    <header className="material sticky top-0 z-40 border-b border-line/70 bg-ground/85 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-x-6 px-4 py-3 sm:px-6">
        <Link href="/" aria-label="Samiksha home" className="shrink-0 rounded-md">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/samiksha-horizontal.svg" alt="Samiksha" className="h-7 w-auto sm:h-8" />
        </Link>
        <nav className="flex items-center gap-x-5 text-sm whitespace-nowrap text-ink-2">
          {children}
          <span className="hidden text-caption text-muted md:inline">Educational. Not investment advice.</span>
        </nav>
      </div>
    </header>
  );
}
