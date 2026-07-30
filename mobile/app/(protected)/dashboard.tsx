import {
  accountBalances,
  format,
  money,
  totalBalanceByCurrency,
} from '@finova/domain'
import { useEffect, useState } from 'react'
import { Button, FlatList, Text, View } from 'react-native'
import { getDashboardData } from '../../src/data/dashboard'
import { supabase } from '../../src/lib/supabase'

type AccountBalance = ReturnType<typeof accountBalances>[number]

/**
 * Module-scope render function: no closure deps, so it's created once
 * instead of being rebuilt on every DashboardScreen render.
 */
function renderAccountBalance({ item }: { item: AccountBalance }) {
  return (
    <Text>
      {item.accountId}: {format(money(item.balance, item.currency), 'en')}
    </Text>
  )
}

export default function DashboardScreen() {
  const [balances, setBalances] = useState<ReturnType<typeof accountBalances>>(
    []
  )
  const [totals, setTotals] = useState<
    ReturnType<typeof totalBalanceByCurrency>
  >({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDashboardData()
      .then(({ accounts, txns }) => {
        const perAccount = accountBalances(accounts, txns)
        setBalances(perAccount)
        setTotals(totalBalanceByCurrency(perAccount))
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  return (
    <View style={{ flex: 1, padding: 24, gap: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Net worth</Text>
      {error ? <Text style={{ color: 'red' }}>{error}</Text> : null}
      {Object.entries(totals).map(([currency, total]) => (
        <Text key={currency} style={{ fontSize: 18 }}>
          {format(money(total, currency), 'en')}
        </Text>
      ))}
      <FlatList
        data={balances}
        keyExtractor={(item) => item.accountId}
        renderItem={renderAccountBalance}
      />
      <Button title="Sign out" onPress={() => supabase.auth.signOut()} />
    </View>
  )
}
