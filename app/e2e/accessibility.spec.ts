import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

async function expectNoHighImpactViolations(page: import('@playwright/test').Page) {
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
  await page.getByLabel(/I understand Buktiva's role/).check()
  await page.getByRole('button', { name: 'Begin safety check' }).click()
  await page.getByLabel('A payment or transaction was not authorised by me').check()
  await expect(page.getByRole('alert')).toBeVisible()
  await expectNoHighImpactViolations(page)
})

test('case details have no serious automated WCAG violations', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel(/I understand Buktiva's role/).check()
  await page.getByRole('button', { name: 'Begin safety check' }).click()
  await page.getByRole('button', { name: /No urgent issue/ }).click()
  await expect(page.getByRole('heading', { name: 'Describe the purchase.' })).toBeVisible()
  await expectNoHighImpactViolations(page)
})
