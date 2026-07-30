'use client'

import {
  buildColumnMapping,
  emptyFormState,
  formStateFromMapping,
  type MappingFormState,
  suggestMapping,
} from '@finova/domain/import/mapping-form'
import type { ParseUploadData } from '@finova/domain/import/parse-upload'
import { useTranslations } from 'next-intl'
import { useActionState, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import type { AccountRow } from '@/lib/validation/account'
import { type ParseResult, saveTemplate, uploadImport } from './actions'
import { ColumnMappingForm } from './ColumnMappingForm'
import { MappingPreview } from './MappingPreview'
import { ReviewPanel } from './ReviewPanel'

/** Parsed file + the mapping form state, once an upload has been parsed. */
interface Loaded {
  /** The persisted batch this upload created; carried for review/commit (P2-07). */
  batchId: string
  data: ParseUploadData
  templateName: string
}

/** Upload-error message keys the form localizes precisely; else a generic one. */
const KNOWN_PARSE_ERRORS = new Set([
  'notCsv',
  'emptyFile',
  'tooLarge',
  'noRows',
  'tooManyRows',
  'noFile',
  'unsupportedType',
  'invalidExcel',
  'storageFailed',
])

export function ImportClient({ accounts }: { accounts: AccountRow[] }) {
  const t = useTranslations('import')
  const [parseState, parseAction, parsing] = useActionState<
    ParseResult | undefined,
    FormData
  >(uploadImport, undefined)

  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [form, setForm] = useState<MappingFormState>(emptyFormState)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [templateName, setTemplateName] = useState('')

  // When a new file parses, seed the mapping (and template name field) from a
  // saved template if present.
  useEffect(() => {
    if (parseState?.ok) {
      setForm(
        parseState.template
          ? formStateFromMapping(parseState.template.mapping)
          : suggestMapping(parseState.data.headers)
      )
      const name = parseState.template?.name ?? ''
      setLoaded({
        batchId: parseState.batchId,
        data: parseState.data,
        templateName: name,
      })
      setTemplateName(name)
      setSaveMsg(null)
    }
  }, [parseState])

  const parseError =
    parseState && !parseState.ok
      ? KNOWN_PARSE_ERRORS.has(parseState.error)
        ? t(`errors.${parseState.error}`)
        : t('errors.unexpected')
      : null

  const mapping = useMemo(() => buildColumnMapping(form), [form])

  // Only offer the review step once the mapping has its required columns; an
  // incomplete mapping would only earn a server-side validationFailed.
  const mappingReady = useMemo(() => {
    if (!mapping.date.column || !mapping.description.column) {
      return false
    }
    return mapping.amount.kind === 'single'
      ? mapping.amount.column !== ''
      : mapping.amount.debitColumn !== '' || mapping.amount.creditColumn !== ''
  }, [mapping])

  async function onSave() {
    if (!loaded) {
      return
    }
    setSaving(true)
    setSaveMsg(null)
    try {
      const result = await saveTemplate({
        name: templateName,
        signature: loaded.data.signature,
        mapping,
      })
      setSaveMsg(result.ok ? t('saved') : t('errors.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-glass-line bg-glass px-4 py-3 text-ink-soft text-sm">
        {t('commitBanner')}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <form action={parseAction} className="flex flex-col gap-3">
            <Label htmlFor="import-file">{t('upload.label')}</Label>
            <input
              id="import-file"
              name="file"
              type="file"
              accept=".csv,.xlsx"
              required
              className="text-ink text-sm file:mr-4 file:rounded-full file:border-0 file:bg-brand file:px-4 file:py-2 file:font-medium file:text-white"
            />
            <Button type="submit" disabled={parsing} className="self-start">
              {parsing ? t('upload.parsing') : t('upload.submit')}
            </Button>
            {parseError ? (
              <p className="text-neg text-sm">{parseError}</p>
            ) : null}
          </form>
        </CardContent>
      </Card>

      {loaded ? (
        <Card>
          <CardContent className="flex flex-col gap-6 pt-6">
            <p className="text-ink-soft text-sm">
              {t('rowsDetected', { count: loaded.data.rowCount })}
            </p>
            <ColumnMappingForm
              headers={loaded.data.headers}
              state={form}
              onChange={setForm}
            />
            <MappingPreview
              sampleRecords={loaded.data.sampleRecords}
              mapping={mapping}
            />
            <div className="flex flex-col gap-2 border-glass-line border-t pt-4">
              <Label htmlFor="template-name">{t('templateName')}</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="template-name"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder={t('templateNamePlaceholder')}
                  maxLength={100}
                  className="max-w-xs"
                />
                <Button
                  type="button"
                  onClick={onSave}
                  disabled={saving || templateName.trim() === ''}
                >
                  {t('saveTemplate')}
                </Button>
              </div>
              {saveMsg ? (
                <p className="text-ink-soft text-sm">{saveMsg}</p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {loaded && mappingReady ? (
        <ReviewPanel
          key={`${loaded.batchId}:${JSON.stringify(mapping)}`}
          batchId={loaded.batchId}
          mapping={mapping}
          accounts={accounts}
        />
      ) : null}
    </div>
  )
}
