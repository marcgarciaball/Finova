const TABS = ['overview', 'income', 'transactions'] as const
export type InvestmentsTab = (typeof TABS)[number]

export function parseInvestmentsTab(value: string | undefined): InvestmentsTab {
  return (TABS as readonly string[]).includes(value ?? '')
    ? (value as InvestmentsTab)
    : 'overview'
}
