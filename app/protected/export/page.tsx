import { redirect } from 'next/navigation'

/** Export moved under the merged Datos screen (nav IA priority 2). */
export default function ExportPage() {
  redirect('/protected/data?tab=export')
}
