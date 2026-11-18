import { onSettled } from 'solid-js'
import { initThemeFromStorage, mode, toggleTheme } from '../lib/theme'

export default function ThemeToggle() {
  // onSettled replaces onMount; the returned function is the cleanup.
  onSettled(() => initThemeFromStorage())

  const label = () =>
    mode() === 'auto'
      ? 'Theme mode: auto (system). Click to switch to light mode.'
      : `Theme mode: ${mode()}. Click to switch mode.`

  return (
    <button
      type="button"
      data-testid="theme-toggle"
      onClick={toggleTheme}
      aria-label={label()}
      title={label()}
      class="rounded-full border border-[var(--chip-border)] bg-[var(--chip-bg)] px-3 py-1.5 text-sm font-semibold text-[var(--text)] shadow-[0_8px_22px_rgba(17,24,39,0.08)] transition hover:-translate-y-0.5"
    >
      {mode() === 'auto' ? 'Auto' : mode() === 'dark' ? 'Dark' : 'Light'}
    </button>
  )
}
