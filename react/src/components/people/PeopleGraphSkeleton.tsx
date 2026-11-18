export function PeopleGraphSkeleton() {
  return (
    <div
      data-testid="people-graph-loading"
      className="relative h-full w-full overflow-hidden rounded-2xl border border-[var(--border)]"
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-[color-mix(in_oklab,var(--surface),var(--text)_2%)]"
      >
        <div className="absolute -inset-24 animate-pulse bg-gradient-to-br from-transparent via-white/20 to-transparent" />
        <div className="absolute left-[30%] top-[40%] h-2.5 w-2.5 rounded-full bg-[rgba(59,130,246,0.55)] shadow-[0_0_0_6px_rgba(59,130,246,0.12)]" />
        <div className="absolute left-[55%] top-[55%] h-2.5 w-2.5 rounded-full bg-[rgba(59,130,246,0.55)] shadow-[0_0_0_6px_rgba(59,130,246,0.12)]" />
        <div className="absolute left-[68%] top-[32%] h-2.5 w-2.5 rounded-full bg-[rgba(59,130,246,0.55)] shadow-[0_0_0_6px_rgba(59,130,246,0.12)]" />
      </div>
      <div className="absolute inset-0 grid place-items-center">
        <p className="text-sm font-semibold text-[var(--text-muted)]">
          Loading graph...
        </p>
      </div>
    </div>
  )
}
