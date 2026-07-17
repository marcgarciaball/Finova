import { requireUser } from '@/lib/auth/require-user'
import { CategoryManager } from './CategoryManager'
import { listCategories } from './data'

/** Categories tab (P5-01): manage the two-level category tree. */
export default async function CategoriesPage() {
  await requireUser()
  const rows = await listCategories()
  return <CategoryManager rows={rows} />
}
