import type { ExpoConfig } from 'expo/config'

const config: ExpoConfig = {
  name: 'Finova',
  slug: 'finova',
  scheme: 'finova',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  ios: { bundleIdentifier: 'com.finova.app', supportsTablet: false },
  android: { package: 'com.finova.app' },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    webAppUrl: process.env.EXPO_PUBLIC_WEB_APP_URL, // for /api/log-error
  },
  plugins: ['expo-router'],
}

export default config
