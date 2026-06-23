/**
 * ING España statement adapter (P2-04).
 *
 * Delimiter `;`, ES decimals (`1.234,56`), `dd/mm/yyyy` dates. The signed
 * `IMPORTE (€)` column is the amount (negative = expense); `DESCRIPCIÓN` is the
 * description. `SALDO (€)` is a running balance and `IMPORTE (€)` is a symbol,
 * not an ISO code, so currency falls back to the account at import time.
 */

import { defineMappingAdapter } from './define-mapping-adapter'

export const ingAdapter = defineMappingAdapter({
  id: 'ing',
  signatureHeaders: ['F. VALOR', 'DESCRIPCIÓN', 'IMPORTE (€)', 'SALDO (€)'],
  mapping: {
    amount: {
      kind: 'single',
      column: 'IMPORTE (€)',
      negativeIs: 'expense',
      decimal: ',',
    },
    date: { column: 'F. VALOR', format: 'dmy' },
    description: { column: 'DESCRIPCIÓN' },
  },
})
