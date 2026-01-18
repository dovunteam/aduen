import { expect, test } from '@playwright/test'

test('Bahasa Malaysia preference persists across the safety journey', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'BM' }).click()

  await expect(page.locator('html')).toHaveAttribute('lang', 'ms')
  await expect(page.getByRole('heading', { name: 'Susun semula pembelian yang bermasalah.' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('button', { name: 'BM' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByLabel(/Saya memahami peranan Tuntiva/).check()
  await page.getByRole('button', { name: 'Mulakan semakan keselamatan' }).click()
  await page.getByLabel('Bayaran atau transaksi tidak dibenarkan oleh saya').check()

  await expect(page.getByRole('alert')).toContainText('Hubungi bank anda')
  await expect(page.getByRole('link', { name: /Panduan penipuan Bank Negara Malaysia/ })).toHaveAttribute('href', 'https://www.bnm.gov.my/faqs/scams')
})
