import { createContext, useContext, useEffect, useState } from 'react'
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
  })

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()

    // Hydrate immediately from the cached session (no network request).
    supabase.auth.getSession().then(({ data }) => {
      setState({
        user: data.session?.user ?? null,
        isAuthenticated: !!data.session,
      })
    })

    // Keep state in sync as the user signs in or out.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({
        user: session?.user ?? null,
        isAuthenticated: !!session,
      })
    })

    return () => subscription.unsubscribe()
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
