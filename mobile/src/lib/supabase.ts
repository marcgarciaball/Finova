import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import Constants from 'expo-constants'

// Session persistence via AsyncStorage (unencrypted on-device storage) is a
// deliberate Phase-1 tradeoff, mirroring how P0-11 shipped CSP with
// 'unsafe-inline' and flagged the hardening as a follow-up: swap for
// expo-secure-store (encrypted, but has a ~2KB per-value limit that needs a
// chunking wrapper) before this app carries real user sessions in production.
const { supabaseUrl, supabaseAnonKey } = Constants.expoConfig?.extra ?? {}

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are not set'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
