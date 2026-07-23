/**
 * Pure upload validation for the import bucket (P2-01).
 *
 * Gates a file by extension allowlist (.csv/.xls/.xlsx) and the 5 MB size cap
 * before any I/O, and reports the canonical `contentType` derived from the
 * extension — so an odd browser-supplied MIME type can't false-reject and the
 * Server Action stores a trustworthy content type. Never throws; distinct from
 * `parse-upload.ts`, which guards the CSV *contents*.
 */

/** 5 MB — matches the bucket's `file_size_limit`. */
const MAX_BYTES = 5 * 1024 * 1024

export type UploadFileKind = 'csv' | 'excel'

interface ExtensionSpec {
  contentType: string
  kind: UploadFileKind
}

const BY_EXTENSION: Record<string, ExtensionSpec> = {
  '.csv': { kind: 'csv', contentType: 'text/csv' },
  // Legacy binary .xls (BIFF/OLE2) is parsed by SheetJS; modern .xlsx by ExcelJS.
  '.xls': { kind: 'excel', contentType: 'application/vnd.ms-excel' },
  '.xlsx': {
    kind: 'excel',
    contentType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
}

export type ValidateUploadResult =
  | { ok: true; kind: UploadFileKind; contentType: string }
  | { ok: false; error: 'noFile' | 'tooLarge' | 'unsupportedType' }

export function validateUpload(meta: {
  name: string
  size: number
  type?: string
}): ValidateUploadResult {
  if (meta.name.trim() === '' || meta.size <= 0) {
    return { ok: false, error: 'noFile' }
  }
  if (meta.size > MAX_BYTES) {
    return { ok: false, error: 'tooLarge' }
  }

  const dot = meta.name.lastIndexOf('.')
  const ext = dot >= 0 ? meta.name.slice(dot).toLowerCase() : ''
  const spec = BY_EXTENSION[ext]
  if (!spec) {
    return { ok: false, error: 'unsupportedType' }
  }

  return { ok: true, kind: spec.kind, contentType: spec.contentType }
}
