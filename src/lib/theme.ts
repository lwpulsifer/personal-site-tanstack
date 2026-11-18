import { createSignal } from 'solid-js'

export type ThemeMode = 'light' | 'dark' | 'auto'
const STORAGE_KEY = 'theme'

// Module-level signal replaces the React app's useSyncExternalStore plumbing.
// Starts as 'auto' so server and first client render agree; initThemeFromStorage
// (called from onSettled) syncs it once we are in the browser.
const [mode, setMode] = createSignal<ThemeMode>('auto')
export { mode }

export function nextMode(current: ThemeMode): ThemeMode {
  return current === 'light' ? 'dark' : current === 'dark' ? 'auto' : 'light'
}

export function applyThemeMode(m: ThemeMode) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const resolved = m === 'auto' ? (prefersDark ? 'dark' : 'light') : m
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  root.classList.add(resolved)
  if (m === 'auto') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', m)
  root.style.colorScheme = resolved
}

export function initThemeFromStorage() {
  const stored = window.localStorage.getItem(STORAGE_KEY)
  const m: ThemeMode =
    stored === 'light' || stored === 'dark' || stored === 'auto' ? stored : 'auto'
  setMode(m)
  applyThemeMode(m)
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const onChange = () => {
    if (mode() === 'auto') applyThemeMode('auto')
  }
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

export function toggleTheme() {
  const next = nextMode(mode())
  window.localStorage.setItem(STORAGE_KEY, next)
  setMode(next)
  applyThemeMode(next)
}
