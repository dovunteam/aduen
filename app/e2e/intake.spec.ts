import { expect, test } from '@playwright/test'

async function acceptBoundary(page: import('@playwright/test').Page) {
  await page.goto('/')
  const begin = page.getByRole('button', { name: 'Begin safety check' })
  await expect(begin).toBeDisabled()
  await page.getByLabel(/I understand Buktiva's role/).check()
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

async function addEvidence(page: import('@playwright/test').Page, type: string, name: string, description: string) {
  await page.getByLabel('Original file').setInputFiles({ name, mimeType: 'text/plain', buffer: Buffer.from(`Synthetic ${description}. No real consumer information.`) })
  await page.getByLabel('What kind of record?').selectOption(type)
  await page.getByLabel('Event date').fill('2026-08-01')
  await page.getByLabel('Description').fill(description)
  await page.getByRole('button', { name: 'Add evidence' }).click()
  await expect(page.getByText(name)).toBeVisible()
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
  await expect(page.getByRole('heading', { name: 'Buktiva should not prepare this case.' })).toBeVisible()
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
  const originalDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download original' }).click()
  expect((await originalDownload).suggestedFilename()).toBe('synthetic-receipt.txt')
  await page.reload()
  await page.getByRole('button', { name: /Resume saved case/ }).click()
  await expect(page.getByRole('heading', { name: 'Keep the originals.' })).toBeVisible()
  await expect(page.getByText('synthetic-receipt.txt')).toBeVisible()
})

test('a complete merchant-first case reaches approved PDF export and outcome tracking', async ({ page }) => {
  await reachCaseDetails(page)
  await fillCase(page)
  await page.getByRole('button', { name: /Add evidence/ }).click()
  await addEvidence(page, 'receipt', 'receipt.txt', 'order receipt')
  await addEvidence(page, 'payment', 'payment.txt', 'payment record')
  await addEvidence(page, 'listing', 'listing.txt', 'promised delivery listing')
  await addEvidence(page, 'message', 'message.txt', 'written merchant request')
  await page.getByRole('button', { name: /Review case/ }).click()
  await expect(page.getByText('0', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Merchant or platform first' })).toBeVisible()
  await page.getByRole('button', { name: 'Prepare merchant request' }).click()
  await expect(page.getByText('BUKTIVA CASE PACK')).toBeVisible()
  await page.getByLabel(/I reviewed this pack/).check()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /Approve and export PDF/ }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('buktiva-synthetic-store-v1.pdf')
  await page.getByRole('button', { name: /Track external status/ }).click()
  await page.getByLabel('Recipient or channel').fill('Synthetic merchant email')
  await page.getByLabel('Submission date').fill('2026-08-10')
  await page.getByLabel('External reference').fill('SYNTH-001')
  await page.getByRole('button', { name: /Save status/ }).click()
  await expect(page.getByRole('status')).toContainText('Status saved')
  await expect(page.getByText('Handed off', { exact: true })).toBeVisible()
})

test('extracted candidates require explicit confirmation, correction, or rejection', async ({ page }) => {
  await reachCaseDetails(page)
  await fillCase(page)
  await page.getByRole('button', { name: /Add evidence/ }).click()
  await page.getByLabel('Original file').setInputFiles({
    name: 'extractable-order.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Order no. SYN-2048 placed on 2026-08-01. Total RM 130.00.'),
  })
  await page.getByLabel('What kind of record?').selectOption('receipt')
  await page.getByLabel('Description').fill('Extractable synthetic order')
  await page.getByRole('button', { name: 'Add evidence' }).click()
  await page.getByRole('button', { name: /Review case/ }).click()
  await expect(page.getByRole('heading', { name: 'Check every candidate.' })).toBeVisible()
  await expect(page.getByText('3', { exact: true }).first()).toBeVisible()
  const cards = page.locator('article.candidate')
  await cards.nth(0).getByLabel('Candidate value').fill('125.50')
  await cards.nth(0).getByRole('button', { name: 'Confirm correction' }).click()
  await cards.nth(1).getByRole('button', { name: 'Confirm' }).click()
  await cards.nth(2).getByRole('button', { name: 'Reject' }).click()
  await expect(page.getByText('Confirmed as 125.50')).toBeVisible()
  await expect(page.getByText('Rejected — not used as a fact')).toBeVisible()
  await page.getByRole('button', { name: /Continue to Buktiva Check/ }).click()
  await expect(page.getByRole('heading', { name: 'Review the record.' })).toBeVisible()
})
