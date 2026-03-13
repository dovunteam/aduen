import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { createCaseRecord, EMPTY_DRAFT } from '../src/domain/case'

const authority = 'https://identity.example.test/'
const clientId = 'aduen-hosted-e2e'
const origin = `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT ?? 4173}`
const primaryCase = createCaseRecord({ ...EMPTY_DRAFT, consumerName: 'Synthetic Consumer', seller: 'Synthetic Local Store', purchaseDate: '2026-08-01', amount: '125.50' }, new Date('2026-09-24T00:00:00.000Z'))
const anotherCase = createCaseRecord({ ...EMPTY_DRAFT, consumerName: 'Second Synthetic Consumer', seller: 'Synthetic Account Store', purchaseDate: '2026-07-15', amount: '52.00' }, new Date('2026-09-22T00:00:00.000Z'))

test.skip(process.env.ADUEN_HOSTED_E2E !== 'true', 'Run with the hosted E2E Vite configuration.')

async function seedSignedInCase(page: Page) {
  await page.addInitScript(({ record, authority, clientId }) => {
    localStorage.setItem('Aduen.case-record.v1', JSON.stringify(record))
    localStorage.setItem('Aduen.consent.v1', JSON.stringify({ noticeVersion: 'prototype-privacy-and-role-v1', acceptedAt: '2026-09-24T00:00:00.000Z', purpose: 'case-preparation-and-local-storage', withdrawalPath: 'data-controls' }))
    sessionStorage.setItem(`oidc.user:${authority}:${clientId}`, JSON.stringify({ access_token: 'synthetic-e2e-access-token', expires_at: Math.floor(Date.now() / 1000) + 3600, profile: { sub: 'synthetic-hosted-user' }, token_type: 'Bearer', scope: 'openid aduen-api' }))
  }, { record: primaryCase, authority, clientId })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
}

async function seedSignedInEmptyCase(page: Page) {
  await page.addInitScript(({ authority, clientId }) => {
    localStorage.setItem('Aduen.consent.v1', JSON.stringify({ noticeVersion: 'prototype-privacy-and-role-v1', acceptedAt: '2026-09-24T00:00:00.000Z', purpose: 'case-preparation-and-local-storage', withdrawalPath: 'data-controls' }))
    sessionStorage.setItem(`oidc.user:${authority}:${clientId}`, JSON.stringify({ access_token: 'synthetic-e2e-access-token', expires_at: Math.floor(Date.now() / 1000) + 3600, profile: { sub: 'synthetic-hosted-user' }, token_type: 'Bearer', scope: 'openid aduen-api' }))
  }, { authority, clientId })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
}

test('hosted save requires consent and account copies can be listed and deleted with their revision', async ({ page }) => {
  const requests: Array<{ method: string; url: string; revision?: string }> = []
  const owned = new Map<string, { record: typeof primaryCase; revision: number }>()
  let forceStaleRevision = true
  await page.route('https://api.example.test/v1/**', async (route) => {
    const request = route.request()
    const method = request.method()
    const url = new URL(request.url())
    const headers = {
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'access-control-allow-headers': 'Authorization, Content-Type, If-Match',
      'access-control-expose-headers': 'ETag',
    }
    if (method === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return }
    requests.push({ method, url: request.url(), revision: request.headers()['if-match'] })
    if (method === 'GET' && url.pathname === '/v1/account/data/export') {
      await route.fulfill({ status: 200, headers, json: { exportedAt: '2026-09-24T00:00:00.000Z', cases: [...owned.values(), { record: anotherCase, revision: 3 }] } }); return
    }
    if (method === 'GET' && url.pathname === '/v1/cases' && url.searchParams.get('cursor') === 'next-page') {
      await route.fulfill({ status: 200, headers, json: { cases: [{ record: anotherCase, revision: 3 }], nextCursor: null } }); return
    }
    if (method === 'GET' && url.pathname === '/v1/cases') {
      await route.fulfill({ status: 200, headers, json: { cases: [...owned.values()], nextCursor: 'next-page' } }); return
    }
    if (method === 'GET' && url.pathname === `/v1/cases/${primaryCase.id}`) {
      const saved = owned.get(primaryCase.id)
      if (!saved) { await route.fulfill({ status: 404, headers, json: { error: 'case_not_found' } }); return }
      await route.fulfill({ status: 200, headers: { ...headers, ETag: `"${saved.revision}"` }, json: saved }); return
    }
    if (method === 'POST' && url.pathname === '/v1/cases') {
      const record = request.postDataJSON() as typeof primaryCase
      owned.set(record.id, { record, revision: 1 })
      await route.fulfill({ status: 201, headers: { ...headers, ETag: '"1"' }, json: { record, revision: 1 } }); return
    }
    if (method === 'DELETE' && url.pathname === `/v1/cases/${primaryCase.id}`) {
      const saved = owned.get(primaryCase.id)
      if (!saved || request.headers()['if-match'] !== `"${saved.revision}"`) { await route.fulfill({ status: 412, headers, json: { error: 'revision_conflict_or_case_not_found' } }); return }
      if (forceStaleRevision) {
        forceStaleRevision = false
        owned.set(primaryCase.id, { ...saved, revision: saved.revision + 1 })
        await route.fulfill({ status: 412, headers, json: { error: 'revision_conflict_or_case_not_found' } }); return
      }
      owned.delete(primaryCase.id)
      await route.fulfill({ status: 204, headers }); return
    }
    if (method === 'DELETE' && url.pathname === '/v1/account/data') {
      owned.clear()
      await route.fulfill({ status: 204, headers }); return
    }
    await route.fulfill({ status: 404, headers, json: { error: 'not_found' } })
  })

  await seedSignedInCase(page)
  await page.getByRole('button', { name: 'Data controls', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Save a structured copy to your account' })).toBeVisible()
  const save = page.getByRole('button', { name: 'Save hosted copy' })
  await expect(save).toBeDisabled()
  await page.getByLabel('I agree to send or replace this case record in my Aduen account now.').check()
  await save.click()
  await expect(page.getByRole('status').filter({ hasText: 'The hosted case record was saved.' })).toBeVisible()
  expect(requests.filter((request) => request.method === 'POST')).toHaveLength(1)

  await page.getByRole('button', { name: 'Load hosted copies' }).click()
  await expect(page.getByText('Synthetic Local Store', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Load more' }).click()
  await expect(page.getByText('Synthetic Account Store', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Use as local draft: Synthetic Account Store' })).toBeDisabled()
  await page.setViewportSize({ width: 390, height: 844 })
  const violations = await new AxeBuilder({ page }).analyze()
  expect(violations.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Delete hosted copy: Synthetic Local Store' }).click()
  await expect(page.getByRole('alert')).toContainText('The hosted record was not deleted')
  await expect(page.getByText('Synthetic Local Store', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Load hosted copies' }).click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Delete hosted copy: Synthetic Local Store' }).click()
  await expect(page.getByText('Synthetic Local Store', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Load more' }).click()
  await expect(page.getByText('Synthetic Account Store', { exact: true })).toBeVisible()
  expect(requests.filter((request) => request.method === 'DELETE').map((request) => request.revision)).toEqual(['"1"', '"2"'])
  const audit = await page.evaluate(() => JSON.parse(localStorage.getItem('Aduen.audit-log.v1') ?? '[]') as Array<{ action: string }>)
  expect(audit.some((event) => event.action === 'hosted_case_saved')).toBe(true)
  expect(audit.some((event) => event.action === 'hosted_case_deleted')).toBe(true)

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export all hosted data' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('aduen-hosted-data-2026-09-24.json')
  const downloadPath = await download.path()
  expect(downloadPath).not.toBeNull()
  if (downloadPath) {
    const exportedData = JSON.parse(await readFile(downloadPath, 'utf8')) as { format: string; cases: Array<{ record: { id: string } }> }
    expect(exportedData.format).toBe('aduen-hosted-case-data-v1')
    expect(exportedData.cases.map((item) => item.record.id).sort()).toEqual([anotherCase.id])
  }
  expect(requests.some((request) => request.method === 'GET' && request.url.endsWith('/v1/account/data/export'))).toBe(true)

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Delete all hosted data' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'All hosted case data and mutation history were deleted' })).toBeVisible()
  expect(requests.some((request) => request.method === 'DELETE' && request.url.endsWith('/v1/account/data'))).toBe(true)
  expect(await page.evaluate(() => localStorage.getItem('Aduen.case-record.v1') !== null)).toBe(true)
  const fullAudit = await page.evaluate(() => JSON.parse(localStorage.getItem('Aduen.audit-log.v1') ?? '[]') as Array<{ action: string }> )
  expect(fullAudit.some((event) => event.action === 'hosted_account_data_deleted')).toBe(true)
})

test('hosted structured case can start a separate local draft when this browser has no case data', async ({ page }) => {
  const owned = new Map([[anotherCase.id, { record: anotherCase, revision: 2 }]])
  const methods: string[] = []
  await page.route('https://api.example.test/v1/**', async (route) => {
    const request = route.request()
    const headers = {
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'access-control-allow-headers': 'Authorization, Content-Type, If-Match',
      'access-control-expose-headers': 'ETag',
    }
    if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return }
    methods.push(request.method())
    if (request.method() === 'GET') { await route.fulfill({ status: 200, headers, json: { cases: [...owned.values()], nextCursor: null } }); return }
    await route.fulfill({ status: 404, headers, json: { error: 'not_found' } })
  })

  await seedSignedInEmptyCase(page)
  await page.getByRole('button', { name: 'Data controls', exact: true }).click()
  await page.getByRole('button', { name: 'Load hosted copies' }).click()
  const useCopy = page.getByRole('button', { name: 'Use as local draft: Synthetic Account Store' })
  await expect(useCopy).toBeEnabled()
  page.once('dialog', (dialog) => dialog.accept())
  await useCopy.click()

  await expect(page.getByRole('heading', { level: 1, name: 'Synthetic Account Store' })).toBeVisible()
  await expect(page.getByText('Synthetic Account Store', { exact: true })).toBeVisible()
  const local = await page.evaluate(() => JSON.parse(localStorage.getItem('Aduen.case-record.v1') ?? 'null') as { id: string; status: string; draft: { seller: string }; history: Array<{ action: string }> } | null)
  expect(local?.id).not.toBe(anotherCase.id)
  expect(local?.draft.seller).toBe('Synthetic Account Store')
  expect(local?.status).toBe('draft')
  expect(local?.history.at(-1)?.action).toBe('hosted_copy_imported_as_new_local_draft')
  expect(methods).toEqual(['GET'])
  const audit = await page.evaluate(() => JSON.parse(localStorage.getItem('Aduen.audit-log.v1') ?? '[]') as Array<{ action: string; targetId: string }>)
  expect(audit.some((event) => event.action === 'hosted_case_imported' && event.targetId === anotherCase.id)).toBe(true)
})
