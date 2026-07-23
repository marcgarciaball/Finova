import { Redirect } from 'expo-router'
import { useSession } from '../src/auth/useSession'

export default function Index() {
  const { session, loading } = useSession()
  if (loading) {
    return null
  }
  return (
    <Redirect href={session ? '/(protected)/dashboard' : '/(auth)/login'} />
  )
}
