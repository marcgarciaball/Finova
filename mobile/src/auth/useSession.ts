import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { isSessionValid } from './session'

export function useSession(): { session: Session | null; loading: boolean } {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, next) => {
        setSession(next)
      }
    )
    return () => listener.subscription.unsubscribe()
  }, [])

  return {
    session: session && isSessionValid(session) ? session : null,
    loading,
  }
}
