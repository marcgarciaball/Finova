const TABS = ['import', 'export'] as const
export type DataTab = (typeof TABS)[number]

export function parseDataTab(value: string | undefined): DataTab {
  return value === 'export' ? 'export' : 'import'
}
