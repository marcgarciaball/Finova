'use client'

import { Plus } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Button } from '@/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/Dialog'
import { Label } from '@/components/ui/Label'

export const SELECT_CLASS =
  'h-11 w-full rounded-2xl border border-glass-line bg-glass px-4 py-2 text-ink text-sm shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'

/** Label + control + inline error, the shared field layout of every form. */
export function Field({
  id,
  label,
  error,
  children,
}: {
  id: string
  label: string
  error?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-neg text-xs">{error}</p> : null}
    </div>
  )
}

/**
 * "Add X" button opening a dialog with a form; the dialog closes itself when
 * the child form reports success via the `onDone` it receives.
 */
export function AddDialog({
  title,
  variant = 'outline',
  children,
}: {
  title: string
  variant?: 'default' | 'outline'
  children: (onDone: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant={variant} size="sm">
          <Plus className="size-4" aria-hidden="true" />
          {title}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children(() => setOpen(false))}
      </DialogContent>
    </Dialog>
  )
}
