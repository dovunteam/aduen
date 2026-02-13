import { expect, test } from '@playwright/test'

async function acceptBoundary(page: import('@playwright/test').Page) {
  await page.goto('/')
  const begin = page.getByRole('button', { name: 'Begin safety check' })
  await expect(begin).toBeDisabled()
  await page.getByLabel(/I understand Tuntiva's role/).check()
  await begin.click()
}

async function reachCaseDetails(page: import('@playwright/test').Page) {
  await acceptBoundary(page)
  await page.getByRole('button', { name: /No urgent issue/ }).click()
  await expect(page.getByRole('heading', { name: 'Describe the purchase.' })).toBeVisible()
}

async function fillCase(page: import('@playwright/test').Page, overrides: { purpose?: string; category?: string; consumerLocation?: string } = {}) {
  await page.getByLabel('Your name or chosen case name').fill('Synthetic Test Consumer')
  await page.getByLabel('Your location').selectOption(overrides.consumerLocation ?? 'malaysia')
  await page.getByLabel('Seller or merchant').fill('Synthetic Store')
  await page.getByLabel('Seller location').selectOption('malaysia')
  await page.getByLabel('Purchase date').fill('2026-08-01')
  await page.getByLabel('Amount paid (MYR)').fill('125.50')
  await page.getByLabel('Payment method').selectOption({ label: 'Card' })
  await page.getByLabel('Purchase purpose').selectOption(overrides.purpose ?? 'personal')
  await page.getByLabel('Purchase category').selectOption(overrides.category ?? 'general_goods')
  await page.getByLabel('What went wrong?').selectOption('non_delivery')
  await page.getByLabel('Primary remedy').selectOption('refund')
  await page.getByLabel('Refund amount (RM)').fill('125.50')
  await page.getByLabel('Merchant contact').selectOption('none')
  await page.getByRole('button', { name: /Save case draft/ }).click()
}

test('urgent risk blocks the ordinary intake path', async ({ page }) => {
  await acceptBoundary(page)
  await page.getByLabel('A payment or transaction was not authorised by me').check()
  await expect(page.getByRole('alert')).toContainText('Pause ordinary case preparation')
  await expect(page.getByRole('button', { name: /No urgent issue/ })).toHaveCount(0)
})

test('an unsupported sector stops before evidence collection', async ({ page }) => {
  await reachCaseDetails(page)
  await fillCase(page, { category: 'healthcare' })
  await expect(page.getByRole('heading', { name: 'Tuntiva should not prepare this case.' })).toBeVisible()
  await expect(page.getByText('Healthcare matters are excluded')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add evidence' })).toHaveCount(0)
})

test('a supported draft preserves original evidence and resumes at the evidence stage', async ({ page }) => {
  await reachCaseDetails(page)
  await fillCase(page)
  await page.getByRole('button', { name: /Add evidence/ }).click()
  await page.getByLabel('Original file').setInputFiles({ name: 'synthetic-receipt.txt', mimeType: 'text/plain', buffer: Buffer.from('Synthetic order receipt. Total MYR 125.50.') })
  await page.getByLabel('Event date').fill('2026-08-01')
  await page.getByLabel('Description').fill('Synthetic order receipt')
  await page.getByRole('button', { name: 'Add evidence' }).click()
  await expect(page.getByText('synthetic-receipt.txt')).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: /Resume saved case/ }).click()
  await expect(page.getByRole('heading', { name: 'Keep the originals.' })).toBeVisible()
  await expect(page.getByText('synthetic-receipt.txt')).toBeVisible()
})
