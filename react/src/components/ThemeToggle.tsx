import { useThemeMode } from '#/lib/hooks/useThemeMode'

export default function ThemeToggle() {
  const { mode, toggle } = useThemeMode()

  const label =
    mode === 'auto'
      ? 'Theme mode: auto (system). Click to switch to light mode.'
      : `Theme mode: ${mode}. Click to switch mode.`

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="rounded-full border border-[var(--chip-border)] bg-[var(--chip-bg)] px-3 py-1.5 text-sm font-semibold text-[var(--text)] shadow-[0_8px_22px_rgba(17,24,39,0.08)] transition hover:-translate-y-0.5"
    >
      {mode === 'auto' ? 'Auto' : mode === 'dark' ? 'Dark' : 'Light'}
    </button>
  )
}
