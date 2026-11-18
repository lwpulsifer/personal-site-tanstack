import type { User } from '@supabase/supabase-js'
import {
  type Accessor,
  createContext,
  createMemo,
  createSignal,
  onSettled,
  type ParentProps,
  useContext,
} from 'solid-js'
import { getServerUser } from '../server/auth'
import { getSupabaseBrowserClient } from './supabase'

type AuthState = { user: Accessor<User | null>; isAuthenticated: Accessor<boolean> }

const AuthContext = createContext<AuthState>()

// `undefined` until the browser client reports; before that we fall back to the
// server-provided user (cookie), so SSR and first paint already know who's here.
const [clientUser, setClientUser] = createSignal<User | null | undefined>(undefined)

export function AuthProvider(props: ParentProps) {
  const serverUser = createMemo(() => getServerUser())

  onSettled(() => {
    const supabase = getSupabaseBrowserClient()
    supabase.auth.getSession().then(({ data }) => setClientUser(data.session?.user ?? null))
    const { data } = supabase.auth.onAuthStateChange((_event, session) =>
      setClientUser(session?.user ?? null),
    )
    return () => data.subscription.unsubscribe()
  })

  const user = () => {
    const c = clientUser()
    return c !== undefined ? c : (serverUser() ?? null)
  }
  const state: AuthState = { user, isAuthenticated: () => !!user() }
  return <AuthContext value={state}>{props.children}</AuthContext>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
