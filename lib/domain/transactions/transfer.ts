/**
 * Two-leg transfer construction (roadmap 1.2). Pure.
 *
 * A transfer "move money A→B" is stored as two rows sharing one
 * `transfer_group_id` (the DB check ties `is_transfer` to the group token):
 * a negative leg on the source account and a positive leg on the destination,
 * equal magnitude, same currency. Transfers are excluded from income/expense
 * totals (P1-06) but included in balances (P4-01) — which is exactly what two
 * signed legs produce. The caller supplies the group id and timestamp so this
 * stays deterministic.
 */

export interface TransferLegInput {
  amountCents: number // positive magnitude to move
  currency: string
  description: string
  fromAccountId: string
  groupId: string
  occurredAtIso: string
  toAccountId: string
}

export interface TransferLeg {
  account_id: string
  amount_cents: number
  category_id: null
  currency: string
  description: string
  is_recurring: false
  is_transfer: true
  note: null
  occurred_at: string
  tags: string[]
  transfer_group_id: string
}

/** The two rows to insert — source (−) first, destination (+) second. */
export function buildTransferLegs(input: TransferLegInput): TransferLeg[] {
  const base = {
    category_id: null,
    currency: input.currency,
    description: input.description,
    is_recurring: false,
    is_transfer: true,
    note: null,
    occurred_at: input.occurredAtIso,
    tags: [] as string[],
    transfer_group_id: input.groupId,
  } as const
  return [
    {
      ...base,
      account_id: input.fromAccountId,
      amount_cents: -Math.abs(input.amountCents),
    },
    {
      ...base,
      account_id: input.toAccountId,
      amount_cents: Math.abs(input.amountCents),
    },
  ]
}
