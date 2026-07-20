import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { rowsToRecords } from './csv'
import { parseSpreadsheetToParsed, recordsToExcelBytes } from './excel'

/** Build an .xlsx in memory from a 2D matrix (typed cells preserved). */
async function makeXlsx(matrix: unknown[][]): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook()
  const sheet = wb.addWorksheet('Statement')
  for (const row of matrix) {
    sheet.addRow(row)
  }
  return new Uint8Array(await wb.xlsx.writeBuffer())
}

/** Build a legacy binary .xls in memory from a 2D matrix (via SheetJS). */
function makeXls(matrix: unknown[][]): Uint8Array {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(matrix), 'Statement')
  return new Uint8Array(
    XLSX.write(wb, { type: 'array', bookType: 'xls' }) as ArrayBuffer
  )
}

describe('parseSpreadsheetToParsed — .xlsx (ExcelJS)', () => {
  it('reads the first row as trimmed headers and the rest as string rows', async () => {
    const bytes = await makeXlsx([
      [' Date ', 'Amount', 'Description'],
      ['2026-01-02', -50, 'Coffee'],
      ['2026-01-03', 1234.56, 'Salary'],
    ])
    const parsed = await parseSpreadsheetToParsed('bank.xlsx', bytes)
    expect(parsed.headers).toEqual(['Date', 'Amount', 'Description'])
    expect(rowsToRecords(parsed)).toEqual([
      { Date: '2026-01-02', Amount: '-50', Description: 'Coffee' },
      { Date: '2026-01-03', Amount: '1234.56', Description: 'Salary' },
    ])
  })

  it('renders date-typed cells as ISO YYYY-MM-DD', async () => {
    const bytes = await makeXlsx([
      ['Date', 'Amount'],
      [new Date(Date.UTC(2026, 5, 29)), 10],
    ])
    const parsed = await parseSpreadsheetToParsed('bank.xlsx', bytes)
    expect(parsed.rows[0]?.[0]).toBe('2026-06-29')
  })

  it('skips fully blank rows and ignores trailing empty columns', async () => {
    const bytes = await makeXlsx([
      ['Date', 'Amount', ''],
      [],
      ['2026-01-02', 5, ''],
    ])
    const parsed = await parseSpreadsheetToParsed('bank.xlsx', bytes)
    expect(parsed.headers).toEqual(['Date', 'Amount'])
    expect(parsed.rows).toEqual([['2026-01-02', '5']])
  })

  it('resolves formula cells to their cached result', async () => {
    const wb = new ExcelJS.Workbook()
    const sheet = wb.addWorksheet('S')
    sheet.addRow(['Label', 'Total'])
    sheet.addRow(['Sum', { formula: 'A2', result: 42 }])
    const bytes = new Uint8Array(await wb.xlsx.writeBuffer())
    const parsed = await parseSpreadsheetToParsed('bank.xlsx', bytes)
    expect(parsed.rows[0]?.[1]).toBe('42')
  })
})

describe('parseSpreadsheetToParsed — legacy .xls (SheetJS)', () => {
  it('reads a binary .xls into trimmed headers and string rows', async () => {
    const bytes = makeXls([
      [' Date ', 'Amount', 'Description'],
      ['2026-01-02', -50, 'Coffee'],
      ['2026-01-03', 1234.56, 'Salary'],
    ])
    const parsed = await parseSpreadsheetToParsed('sabadell.xls', bytes)
    expect(parsed.headers).toEqual(['Date', 'Amount', 'Description'])
    expect(rowsToRecords(parsed)).toEqual([
      { Date: '2026-01-02', Amount: '-50', Description: 'Coffee' },
      { Date: '2026-01-03', Amount: '1234.56', Description: 'Salary' },
    ])
  })

  it('renders date-typed cells as ISO YYYY-MM-DD', async () => {
    const bytes = makeXls([
      ['Date', 'Amount'],
      [new Date(Date.UTC(2026, 5, 29)), 10],
    ])
    const parsed = await parseSpreadsheetToParsed('sabadell.xls', bytes)
    expect(parsed.rows[0]?.[0]).toBe('2026-06-29')
  })

  it('skips fully blank rows and trailing empty columns', async () => {
    const bytes = makeXls([['Date', 'Amount', ''], [], ['2026-01-02', 5, '']])
    const parsed = await parseSpreadsheetToParsed('sabadell.xls', bytes)
    expect(parsed.headers).toEqual(['Date', 'Amount'])
    expect(parsed.rows).toEqual([['2026-01-02', '5']])
  })

  it('skips leading preamble rows and uses the widest row as the header (Sabadell layout)', async () => {
    // Sabadell prepends title/account/date-range rows before the real header.
    const bytes = makeXls([
      ['Consulta de movimientos'],
      ['29/06/2026 9:55:30'],
      ['Selección:', 'Desde 01/01/2026 hasta 29/06/2026'],
      ['F. Operativa', 'Concepto', 'Importe', 'Saldo'],
      ['29/06/2026', 'BAR EL GAT', -37, 10707.21],
      ['26/06/2026', 'NOMINA NEXUM', 2087.85, 10744.21],
    ])
    const parsed = await parseSpreadsheetToParsed('sabadell.xls', bytes)
    expect(parsed.headers).toEqual([
      'F. Operativa',
      'Concepto',
      'Importe',
      'Saldo',
    ])
    expect(rowsToRecords(parsed)).toEqual([
      {
        'F. Operativa': '29/06/2026',
        Concepto: 'BAR EL GAT',
        Importe: '-37',
        Saldo: '10707.21',
      },
      {
        'F. Operativa': '26/06/2026',
        Concepto: 'NOMINA NEXUM',
        Importe: '2087.85',
        Saldo: '10744.21',
      },
    ])
  })
})

describe('recordsToExcelBytes round-trip', () => {
  it('writes headers + rows that parse back unchanged', async () => {
    const headers = ['Date', 'Amount', 'Description']
    // Numbers are emitted verbatim (no formula-sanitizing) so -50 round-trips.
    const bytes = await recordsToExcelBytes(headers, [
      ['2026-01-02', -50, 'Coffee'],
      ['2026-01-03', 1234.56, 'Salary'],
    ])
    const parsed = await parseSpreadsheetToParsed('export.xlsx', bytes)
    expect(parsed.headers).toEqual(headers)
    expect(parsed.rows).toEqual([
      ['2026-01-02', '-50', 'Coffee'],
      ['2026-01-03', '1234.56', 'Salary'],
    ])
  })

  it('neutralizes formula-injection on export', async () => {
    const bytes = await recordsToExcelBytes(['Note'], [['=1+2']])
    const parsed = await parseSpreadsheetToParsed('export.xlsx', bytes)
    expect(parsed.rows[0]?.[0]).toBe("'=1+2")
  })
})
