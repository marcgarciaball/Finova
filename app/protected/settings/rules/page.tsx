import { requireUser } from '@/lib/auth/require-user'
import { suggestRuleFromCorrection } from '@/lib/domain/rules/suggest'
import { listAccounts, listCategories, listRules } from './data'
import type { RuleFormInitial } from './RuleForm'
import { RuleManager } from './RuleManager'

/**
 * Rules tab (P5-01). A `?description=&categoryId=` deep-link (from "make this a
 * rule" on a transaction) opens the create form prefilled via the P3-05 core.
 */
export default async function RulesPage({
  searchParams,
}: {
  searchParams: Promise<{ categoryId?: string; description?: string }>
}) {
  await requireUser()
  const [rules, categories, accounts] = await Promise.all([
    listRules(),
    listCategories(),
    listAccounts(),
  ])

  const params = await searchParams
  let initialDraft: RuleFormInitial | undefined
  if (params.description && params.categoryId) {
    const s = suggestRuleFromCorrection({
      description: params.description,
      categoryId: params.categoryId,
    })
    initialDraft = {
      name: s.name,
      categoryId: s.categoryId,
      conditions: s.conditions,
    }
  }

  return (
    <RuleManager
      rules={rules}
      categories={categories}
      accounts={accounts}
      initialDraft={initialDraft}
    />
  )
}
