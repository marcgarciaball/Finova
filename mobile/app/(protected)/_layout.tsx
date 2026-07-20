import { Redirect, Stack } from 'expo-router'
import { Text, View } from 'react-native'
import { useSession } from '../../src/auth/useSession'

export default function ProtectedLayout() {
  const { session, loading } = useSession()

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>Loading…</Text>
      </View>
    )
  }
  if (!session) {
    return <Redirect href="/(auth)/login" />
  }
  return <Stack screenOptions={{ headerShown: false }} />
}
