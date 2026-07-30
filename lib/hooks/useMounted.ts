'use client'

import { useSyncExternalStore } from 'react'

function subscribe() {
  return () => {}
}

function getClientSnapshot() {
  return true
}

function getServerSnapshot() {
  return false
}

/**
 * True once the component has hydrated on the client. Unlike the classic
 * `useEffect(() => setMounted(true), [])` pattern, `useSyncExternalStore`
 * resolves the client/server snapshot mismatch during hydration itself
 * (before the browser paints), so client-only UI (e.g. reading localStorage
 * via next-themes) appears immediately instead of flashing in after mount.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot)
}
