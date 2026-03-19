import { createContext, useContext, useSyncExternalStore } from 'react'
import type { User } from '@supabase/supabase-js'
import { getSupabaseBrowserClient } from './supabase'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthState>({
  user: null,
  isAuthenticated: false,
})

// Module-level store for auth state, driven by Supabase's auth listener.
let currentState: AuthState = { user: null, isAuthenticated: false }
const listeners = new Set<() => void>()
let subscribed = false

function ensureSubscription() {
  if (subscribed || typeof window === 'undefined') return
  subscribed = true

  const supabase = getSupabaseBrowserClient()

  // Hydrate from cached session (no network request)
  supabase.auth.getSession().then(({ data }) => {
    currentState = {
      user: data.session?.user ?? null,
      isAuthenticated: !!data.session,
    }
    for (const fn of listeners) fn()
  })

  // Keep in sync as the user signs in or out
  supabase.auth.onAuthStateChange((_event, session) => {
    currentState = {
      user: session?.user ?? null,
      isAuthenticated: !!session,
    }
    for (const fn of listeners) fn()
  })
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange)
  ensureSubscription()
  return () => listeners.delete(onStoreChange)
}

function getSnapshot() {
  return currentState
}

const serverSnapshot: AuthState = { user: null, isAuthenticated: false }
function getServerSnapshot() {
  return serverSnapshot
}

export function AuthProvider({
  initialUser = null,
  children,
}: {
  initialUser?: User | null
  children: React.ReactNode
}) {
  // Seed the store with server-provided user before the first subscribe
  if (initialUser && !currentState.user) {
    currentState = { user: initialUser, isAuthenticated: true }
  }

  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
