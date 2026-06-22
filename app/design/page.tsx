'use client'
import { Home, LineChart, Settings, Wallet } from 'lucide-react'
import { useState } from 'react'
import { AreaChart } from '@/components/charts/AreaChart'
import { BarChart } from '@/components/charts/BarChart'
import { DonutChart } from '@/components/charts/DonutChart'
import { HeroCard } from '@/components/dashboard/HeroCard'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { ListRow } from '@/components/dashboard/ListRow'
import { NavRail } from '@/components/dashboard/NavRail'
import { ThemeSwitcher } from '@/components/theme-switcher'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DeltaPill } from '@/components/ui/DeltaPill'
import { GlassCard } from '@/components/ui/GlassCard'
import { Input } from '@/components/ui/input'
import { SegmentedControl } from '@/components/ui/SegmentedControl'

const usd = (n: number) =>
  `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
const trendData = [
  { month: 'Jan', net: 1800 },
  { month: 'Feb', net: 2000 },
  { month: 'Mar', net: 1950 },
  { month: 'Apr', net: 2200 },
  { month: 'May', net: 2300 },
  { month: 'Jun', net: 2420 },
]

export default function DesignShowcase() {
  const [range, setRange] = useState('m')
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-10 p-8">
      <header className="flex items-center justify-between">
        <h1 className="font-display font-bold text-3xl text-ink tracking-tight">
          Finova components
        </h1>
        <ThemeSwitcher />
      </header>

      <section className="flex flex-wrap items-center gap-3">
        <Button variant="brand">Primary</Button>
        <Button variant="glass">Glass</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="outline">Outline</Button>
        <SegmentedControl
          aria-label="Range"
          value={range}
          onValueChange={setRange}
          options={[
            { label: 'Day', value: 'd' },
            { label: 'Week', value: 'w' },
            { label: 'Month', value: 'm' },
          ]}
        />
        <DeltaPill value={2.6} suffix="%" />
        <DeltaPill value={-1.2} suffix="%" />
        <Badge variant="pos">Confirmed</Badge>
        <Badge variant="neutral">Draft</Badge>
        <Input aria-label="Search" placeholder="Search…" className="max-w-xs" />
      </section>

      <section className="grid gap-6 md:grid-cols-[auto_1fr]">
        <NavRail
          items={[
            { label: 'Overview', href: '#', icon: Home, active: true },
            { label: 'Wallet', href: '#', icon: Wallet },
            { label: 'Analytics', href: '#', icon: LineChart },
            { label: 'Settings', href: '#', icon: Settings },
          ]}
        />
        <div className="grid gap-6">
          <HeroCard
            label="Net worth"
            value={2420.1}
            format={usd}
            delta={2.6}
            deltaSuffix="%"
            trend={trendData.map((d) => d.net)}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard
              label="Balance"
              value={32390}
              format={usd}
              delta={7.4}
              deltaSuffix="%"
              footnote="vs last month"
            />
            <KpiCard
              label="Spending"
              value={1232}
              format={usd}
              delta={-3.4}
              deltaSuffix="%"
              footnote="vs last month"
            />
            <KpiCard
              label="Investments"
              value={9876.8}
              format={usd}
              delta={1.1}
              deltaSuffix="%"
              footnote="vs last month"
            />
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <GlassCard>
          <h2 className="mb-4 font-display font-semibold text-ink text-lg">
            Net worth trend
          </h2>
          <AreaChart data={trendData} index="month" categories={['net']} />
        </GlassCard>
        <GlassCard>
          <h2 className="mb-4 font-display font-semibold text-ink text-lg">
            Spending by month
          </h2>
          <BarChart
            data={trendData.map((d) => ({ month: d.month, spend: d.net / 2 }))}
            index="month"
            categories={['spend']}
          />
        </GlassCard>
        <GlassCard>
          <h2 className="mb-4 font-display font-semibold text-ink text-lg">
            Categories
          </h2>
          <DonutChart
            data={[
              { name: 'Rent', value: 40 },
              { name: 'Food', value: 25 },
              { name: 'Transport', value: 15 },
              { name: 'Fun', value: 20 },
            ]}
          />
        </GlassCard>
        <GlassCard>
          <h2 className="mb-4 font-display font-semibold text-ink text-lg">
            Recent activity
          </h2>
          <ListRow
            title="Salary"
            subtitle="Acme Inc"
            amount={2500}
            income
            format={usd}
            categoryColor="var(--cat-lime)"
          />
          <ListRow
            title="Rent"
            subtitle="Monthly"
            amount={1200}
            format={usd}
            categoryColor="var(--cat-rose)"
          />
          <ListRow
            title="Groceries"
            subtitle="Whole Foods"
            amount={84.2}
            format={usd}
            categoryColor="var(--cat-teal)"
          />
        </GlassCard>
      </section>
    </main>
  )
}
