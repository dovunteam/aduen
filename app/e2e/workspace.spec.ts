import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { EMPTY_DRAFT, type CaseRecordStatus } from '../src/domain/case'
import { EMPTY_SUBMISSION } from '../src/domain/status'
import { approveComplaintPack, createComplaintPack } from '../src/domain/complaintPack'
import { evaluateInitialRoute } from '../src/domain/routing'

async function seedCase(page: Page, status: CaseRecordStatus = 'evidence_collection', consent = true) {
  await page.addInitScript(({ draft, status, consent }) => {
    if (localStorage.getItem('workspace-seeded')) return
    localStorage.setItem('workspace-seeded', 'true')
    const at = '2026-09-01T00:00:00.000Z'
    localStorage.setItem('Aduen.case-record.v1', JSON.stringify({ id: 'workspace-case', draft, status, createdAt: at, updatedAt: at, history: [{ at, actor: 'user', action: 'case_details_confirmed', status }] }))
    if (consent) localStorage.setItem('Aduen.consent.v1', JSON.stringify({ noticeVersion: 'local-first-privacy-and-role-v2', acceptedAt: at, purpose: 'case-preparation-and-local-storage', withdrawalPath: 'data-controls' }))
  }, { draft: { ...EMPTY_DRAFT, consumerName: 'Synthetic Consumer', consumerLocation: 'malaysia', seller: 'Synthetic Workspace Store', sellerLocation: 'malaysia', purchaseDate: '2026-08-01', amount: '125.50', paymentMethod: 'Card', purpose: 'personal', category: 'general_goods', issue: 'non_delivery', remedy: 'refund', remedyAmount: '125.50', contactHistory: 'none' }, status, consent })
}

test('returning users can manage evidence, search records, and resume after reload', async ({ page }) => {
  const localOrigin = `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT ?? 4173}`
  const offDeviceRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().startsWith('http') && new URL(request.url()).origin !== localOrigin) offDeviceRequests.push(request.url())
  })
  await seedCase(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Synthetic Workspace Store' })).toBeVisible()
  await expect(page.getByText('3 required items missing from the evidence check.', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Manage evidence' }).click()
  await page.getByLabel('Original file').setInputFiles({ name: 'workspace-receipt.txt', mimeType: 'text/plain', buffer: Buffer.from('Synthetic purchase record.') })
  await page.getByLabel('What kind of record?').selectOption('receipt')
  await page.getByRole('button', { name: 'Add evidence' }).click()
  await expect(page.getByText('workspace-receipt.txt', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'My case', exact: true }).click()
  await expect(page.getByText('workspace-receipt.txt', { exact: true })).toBeVisible()
  await expect(page.getByText('2 required items missing from the evidence check.', { exact: false })).toBeVisible()
  await page.getByLabel('Search evidence').fill('missing-file')
  await expect(page.getByRole('status')).toHaveText('No evidence matches your search.')
  await page.getByLabel('Search evidence').fill('receipt')
  await expect(page.getByText('workspace-receipt.txt', { exact: true })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: /Resume saved case/ }).click()
  await expect(page.getByLabel('Original file')).toBeVisible()
  expect(offDeviceRequests).toEqual([])
})

test('draft and unsupported cases retain their workflow gates', async ({ page }) => {
  await seedCase(page, 'draft')
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Manage evidence' })).toHaveCount(0)
  await page.getByRole('button', { name: /Resume saved case/ }).click()
  await expect(page.getByRole('heading', { name: 'Describe the purchase.' })).toBeVisible()
  await page.evaluate(() => {
    const record = JSON.parse(localStorage.getItem('Aduen.case-record.v1')!)
    record.status = 'out_of_scope'
    record.draft.purpose = 'business'
    localStorage.setItem('Aduen.case-record.v1', JSON.stringify(record))
  })
  await page.reload()
  await expect(page.getByRole('button', { name: 'Manage evidence' })).toHaveCount(0)
  await page.getByRole('button', { name: /Resume saved case/ }).click()
  await expect(page.locator('.workspace-page')).toHaveCount(0)
  await expect(page.getByLabel('Original file')).toHaveCount(0)
})

test('workspace requires accepted consent', async ({ page }) => {
  await seedCase(page, 'draft', false)
  await page.goto('/')
  await expect(page.locator('.workspace-page')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Resume saved case/ })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'My case' })).toHaveCount(0)
})

test('retention controls schedule and enforce local deletion', async ({ page }) => {
  await seedCase(page, 'draft')
  await page.goto('/')
  await page.getByRole('button', { name: 'Data controls', exact: true }).click()
  await page.getByLabel('Delete local data after').selectOption('30')
  await expect(page.getByText('Local data will be deleted when Aduen is next opened', { exact: false })).toBeVisible()

  await page.addInitScript(() => localStorage.setItem('Aduen.retention.v1', JSON.stringify({ setAt: '2026-08-01T00:00:00.000Z', expiresAt: '2026-08-02T00:00:00.000Z', days: 30 })))
  await page.reload()
  await expect(page.getByRole('heading', { name: /Turn a failed purchase/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Resume saved case/ })).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('Aduen.case-record.v1'))).toBeNull()
  expect(await page.evaluate(() => localStorage.getItem('Aduen.consent.v1'))).toBeNull()
})

test('storage failure is visible and records can be retried', async ({ page }) => {
  await seedCase(page)
  await page.addInitScript(() => {
    const open = indexedDB.open.bind(indexedDB)
    indexedDB.open = (name, version) => {
      if (sessionStorage.getItem('storage-restored')) return open(name, version)
      throw new Error('Synthetic storage failure')
    }
  })
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText('Records could not be loaded')
  await expect(page.locator('.workspace-stats')).toHaveCount(0)
  await page.evaluate(() => sessionStorage.setItem('storage-restored', 'true'))
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.locator('.workspace-stats')).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('historical pack approvals do not bypass a changed case review', async ({ page }) => {
  await seedCase(page, 'draft')
  const route = evaluateInitialRoute(EMPTY_DRAFT, [])
  const first = approveComplaintPack(createComplaintPack(EMPTY_DRAFT, [], route, new Date('2026-09-01T00:00:00Z'), 1))
  const second = createComplaintPack(EMPTY_DRAFT, [], route, new Date('2026-09-02T00:00:00Z'), 2)
  await page.addInitScript((packs) => localStorage.setItem('Aduen.pack-versions.v1', JSON.stringify(packs)), [first, second])
  await page.goto('/')
  await page.getByText('Pack version history', { exact: true }).click()
  await expect(page.locator('.workspace-packs li').first()).toContainText('Version 2')
  await expect(page.locator('.workspace-packs li').first()).toContainText('Not approved')
  await expect(page.locator('.workspace-packs li').last()).toContainText('Approved by you')
  await page.getByRole('button', { name: /Resume saved case/ }).click()
  await expect(page.getByRole('heading', { name: 'Describe the purchase.' })).toBeVisible()
})

test('follow-up reminders use local dates and disappear for recorded outcomes', async ({ page }) => {
  await seedCase(page, 'handed_off')
  await page.clock.install({ time: new Date('2026-09-23T12:00:00Z') })
  await page.goto('/')
  await page.evaluate((record) => localStorage.setItem('Aduen.submission-record.v1', JSON.stringify(record)), { ...EMPTY_SUBMISSION, status: 'handed_off', channel: 'Merchant', submissionDate: '2026-09-01', nextFollowUpDate: '2026-09-22', updatedAt: '2026-09-01T00:00:00.000Z' })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Time to follow up' })).toBeVisible()
  await expect(page.getByText('Your chosen reminder, not an official deadline.', { exact: false })).toBeVisible()
  await page.evaluate(() => {
    const record = JSON.parse(localStorage.getItem('Aduen.submission-record.v1')!)
    localStorage.setItem('Aduen.submission-record.v1', JSON.stringify({ ...record, status: 'resolved', outcome: 'refund' }))
  })
  await page.reload()
  await expect(page.locator('.workspace-followup')).toHaveCount(0)
})

for (const locale of ['en', 'ms'] as const) {
  for (const width of [390, 1440]) {
    test(`workspace is accessible and fits ${width}px in ${locale}`, async ({ page }, testInfo) => {
      await seedCase(page)
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/')
      if (locale === 'ms') await page.getByRole('button', { name: 'BM', exact: true }).click()
      await expect(page.getByRole('heading', { name: locale === 'ms' ? 'Rekod kes anda' : 'Your case records' })).toBeVisible()
      await expect(page.locator('.workspace-stats')).toBeVisible()
      await expect(page.locator('.page')).toHaveCSS('opacity', '1')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
      expect(results.violations.filter((item) => item.impact === 'serious' || item.impact === 'critical')).toEqual([])
      await page.screenshot({ path: testInfo.outputPath('workspace.png'), fullPage: true, animations: 'disabled' })
      await page.getByRole('button', { name: locale === 'ms' ? 'Edit butiran kes' : 'Edit case details' }).click()
      await expect(page.getByRole('button', { name: locale === 'ms' ? 'Kes saya' : 'My case', exact: true })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    })
  }
}
