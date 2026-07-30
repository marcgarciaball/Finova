import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Button, Text, TextInput, View } from 'react-native'
import { supabase } from '../../src/lib/supabase'

export default function LoginScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSignIn() {
    setSubmitting(true)
    setError(null)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (signInError) {
        setError(signInError.message)
        return
      }
      router.replace('/(protected)/dashboard')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 12 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>
        Sign in to Finova
      </Text>
      <TextInput
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={{ borderWidth: 1, borderRadius: 8, padding: 12 }}
      />
      <TextInput
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={{ borderWidth: 1, borderRadius: 8, padding: 12 }}
      />
      {error ? <Text style={{ color: 'red' }}>{error}</Text> : null}
      <Button
        title={submitting ? 'Signing in…' : 'Sign in'}
        onPress={handleSignIn}
        disabled={submitting}
      />
    </View>
  )
}
