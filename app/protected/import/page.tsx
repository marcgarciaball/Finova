import { redirect } from 'next/navigation'

/** Import moved under the merged Datos screen (nav IA priority 2). */
export default function ImportPage() {
  redirect('/protected/data?tab=import')
}
