export function MapSkeleton({ label = 'Loading map...' }: { label?: string }) {
  return (
    <div data-testid="map-loading" className="relative h-full w-full overflow-hidden">
      <div
        data-testid="map-skeleton"
        aria-hidden
        className="absolute inset-0 bg-[color-mix(in_oklab,var(--surface),var(--text)_2%)]"
      >
        {/* subtle “tile grid” */}
        <div
          className="absolute inset-0 opacity-60 [background-image:linear-gradient(to_right,color-mix(in_oklab,var(--surface),var(--text)_10%)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklab,var(--surface),var(--text)_10%)_1px,transparent_1px)] [background-size:48px_48px]"
        />
        {/* shimmer sweep */}
        <div className="absolute -inset-24 animate-pulse bg-gradient-to-br from-transparent via-white/20 to-transparent" />

        {/* fake “controls” */}
        <div className="absolute left-4 top-4 h-10 w-40 rounded-full border border-[var(--border)] bg-[var(--surface)] shadow-sm" />
        <div className="absolute right-4 top-4 h-10 w-10 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm" />

        {/* fake markers */}
        <div className="absolute left-[22%] top-[36%] h-3 w-3 rounded-full bg-[rgba(59,130,246,0.55)] shadow-[0_0_0_6px_rgba(59,130,246,0.12)]" />
        <div className="absolute left-[55%] top-[48%] h-3 w-3 rounded-full bg-[rgba(59,130,246,0.55)] shadow-[0_0_0_6px_rgba(59,130,246,0.12)]" />
        <div className="absolute left-[71%] top-[28%] h-3 w-3 rounded-full bg-[rgba(59,130,246,0.55)] shadow-[0_0_0_6px_rgba(59,130,246,0.12)]" />
      </div>

      <div className="absolute inset-0 grid place-items-center">
        <p className="text-sm font-semibold text-[var(--text-muted)]">{label}</p>
      </div>
    </div>
  )
}

