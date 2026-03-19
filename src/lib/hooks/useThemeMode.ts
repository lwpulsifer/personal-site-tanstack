import { useCallback, useSyncExternalStore } from 'react'

type ThemeMode = 'light' | 'dark' | 'auto'

const STORAGE_KEY = 'theme'

function getSnapshot(): ThemeMode {
  if (typeof window === 'undefined') return 'auto'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'auto') return stored
  return 'auto'
}

function getServerSnapshot(): ThemeMode {
  return 'auto'
}

function applyThemeMode(mode: ThemeMode) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const resolved = mode === 'auto' ? (prefersDark ? 'dark' : 'light') : mode

  document.documentElement.classList.remove('light', 'dark')
  document.documentElement.classList.add(resolved)

  if (mode === 'auto') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', mode)
  }

  document.documentElement.style.colorScheme = resolved
}

// Listeners subscribed via useSyncExternalStore
const listeners = new Set<() => void>()

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange)

  // Apply theme on first subscription and listen for system preference changes
  applyThemeMode(getSnapshot())
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const onMediaChange = () => {
    if (getSnapshot() === 'auto') applyThemeMode('auto')
  }
  media.addEventListener('change', onMediaChange)

  return () => {
    listeners.delete(onStoreChange)
    media.removeEventListener('change', onMediaChange)
  }
}

export function useThemeMode() {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const toggle = useCallback(() => {
    const next: ThemeMode =
      mode === 'light' ? 'dark' : mode === 'dark' ? 'auto' : 'light'
    window.localStorage.setItem(STORAGE_KEY, next)
    applyThemeMode(next)
    // Notify all subscribers that the store changed
    for (const fn of listeners) fn()
  }, [mode])

  return { mode, toggle } as const
}
