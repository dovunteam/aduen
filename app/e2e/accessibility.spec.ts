import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test.use({ reducedMotion: 'reduce' })

async function expectNoHighImpactViolations(page: import('@playwright/test').Page) {
  await expect(page.locator('.page')).toHaveCSS('opacity', '1')
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
  const highImpact = results.violations.filter((violation) => violation.impact === 'critical' || violation.impact === 'serious')
  const summary = highImpact.map((violation) => ({
    id: violation.id,
    help: violation.help,
    targets: violation.nodes.map((node) => node.target.join(' ')),
  }))
  expect(summary).toEqual([])
}

test('onboarding has no serious automated WCAG violations', async ({ page }) => {
  await page.goto('/')
  await expectNoHighImpactViolations(page)
})

test('urgent guidance has no serious automated WCAG violations', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel(/I have read and understand/).check()
  await page.getByRole('button', { name: 'Begin safety check' }).click()
  await page.getByLabel('A payment or transaction was not authorised by me').check()
  await expect(page.getByRole('alert')).toBeVisible()
  await expectNoHighImpactViolations(page)
})

test('case details have no serious automated WCAG violations', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel(/I have read and understand/).check()
  await page.getByRole('button', { name: 'Begin safety check' }).click()
  await page.getByRole('button', { name: /No urgent issue/ }).click()
  await expect(page.getByRole('heading', { name: 'Describe the purchase.' })).toBeVisible()
  await expectNoHighImpactViolations(page)
})

test('privacy controls have no serious automated WCAG violations', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Data controls' }).click()
  await expect(page.getByRole('heading', { name: 'Your data stays under your control.' })).toBeVisible()
  await expectNoHighImpactViolations(page)
})

test('evidence review, pack approval, and status screens have no serious automated WCAG violations', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel(/I have read and understand/).check()
  await page.getByRole('button', { name: 'Begin safety check' }).click()
  await page.getByRole('button', { name: /No urgent issue/ }).click()
  await page.getByLabel('Your name or chosen case name').fill('Synthetic Accessibility Consumer')
  await page.getByLabel('Your location').selectOption('malaysia')
  await page.getByLabel('Seller or merchant').fill('Synthetic Accessibility Store')
  await page.getByLabel('Seller location').selectOption('malaysia')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByLabel('Purchase date').fill('2026-08-01')
  await page.getByLabel('Amount paid (MYR)').fill('125.50')
  await page.getByLabel('Payment method').selectOption({ label: 'Card' })
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByLabel('Purchase purpose').selectOption('personal')
  await page.getByLabel('Purchase category').selectOption('general_goods')
  await page.getByLabel('What went wrong?').selectOption('non_delivery')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByLabel('Primary remedy').selectOption('refund')
  await page.getByLabel('Refund amount (RM)').fill('125.50')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByLabel('Merchant contact').selectOption('none')
  await page.getByRole('button', { name: /Save case draft/ }).click()
  await page.getByRole('button', { name: /Add evidence/ }).click()

  for (const [type, name, description] of [
    ['receipt', 'a11y-receipt.txt', 'synthetic transaction receipt'],
    ['payment', 'a11y-payment.txt', 'synthetic payment record'],
    ['listing', 'a11y-listing.txt', 'synthetic delivery listing'],
    ['message', 'a11y-message.txt', 'synthetic merchant request'],
  ]) {
    const input = page.getByLabel('Original file')
    await input.setInputFiles({ name, mimeType: 'text/plain', buffer: Buffer.from(type === 'receipt' ? 'Total RM 125.50.' : `Synthetic ${description}.`) })
    await page.getByLabel('What kind of record?').selectOption(type)
    await page.getByLabel('Description').fill(description)
    await page.getByRole('button', { name: 'Add evidence' }).click()
    await expect(page.getByText(name, { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add evidence' })).toBeEnabled()
  }
  await expectNoHighImpactViolations(page)

  await page.getByRole('button', { name: /Review case/ }).click()
  await expect(page.getByRole('heading', { name: 'Check every candidate.' })).toBeVisible()
  await expectNoHighImpactViolations(page)
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await page.getByRole('button', { name: /Continue to Aduen Check/ }).click()
  await expect(page.getByRole('heading', { name: 'Review the record.' })).toBeVisible()
  await expectNoHighImpactViolations(page)
  await page.getByRole('button', { name: 'Prepare merchant request' }).click()
  await expect(page.getByText('Aduen CASE PACK')).toBeVisible()
  await page.getByLabel('Reviewer code').fill('SYNTH-OPERATOR-01')
  for (const label of [
    'Transaction identity and amount match the evidence',
    'Routing eligibility and uncertainty are reviewed',
    'Dates and deadline assumptions are checked',
    'Unsupported allegations and conclusions are removed',
    'Evidence selection and redaction are reviewed',
  ]) await page.getByLabel(label).check()
  await page.getByRole('button', { name: 'Record operator review' }).click()
  await page.getByLabel(/I reviewed this pack/).check()
  const pdfDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: /Approve and export PDF/ }).click()
  await pdfDownload
  await expectNoHighImpactViolations(page)
  await page.getByRole('button', { name: /Track external status/ }).click()
  await expect(page.getByRole('heading', { name: 'Record what happens next.' })).toBeVisible()
  await expectNoHighImpactViolations(page)
})
