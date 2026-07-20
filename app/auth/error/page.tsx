import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

async function ErrorContent({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>
}) {
  const params = await searchParams
  const t = await getTranslations('auth.error')

  return (
    <>
      {params?.error ? (
        <p className="text-muted-foreground text-sm">
          {t('withCode', { code: params.error })}
        </p>
      ) : (
        <p className="text-muted-foreground text-sm">{t('generic')}</p>
      )}
    </>
  )
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>
}) {
  const t = await getTranslations('auth.error')
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{t('title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense>
                <ErrorContent searchParams={searchParams} />
              </Suspense>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
