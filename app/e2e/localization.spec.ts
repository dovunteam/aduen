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

test('Bahasa Malaysia case details preserve stable domain values', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'BM' }).click()
  await page.getByLabel(/Saya memahami peranan Tuntiva/).check()
  await page.getByRole('button', { name: 'Mulakan semakan keselamatan' }).click()
  await page.getByRole('button', { name: /Tiada isu mendesak/ }).click()

  await page.getByLabel('Nama anda atau nama kes pilihan').fill('Pengguna Contoh')
  await page.getByLabel('Lokasi anda').selectOption('malaysia')
  await page.getByLabel('Penjual atau peniaga').fill('Kedai Contoh')
  await page.getByLabel('Lokasi penjual').selectOption('malaysia')
  await page.getByLabel('Tarikh pembelian').fill('2026-09-01')
  await page.getByLabel('Jumlah dibayar (MYR)', { exact: true }).fill('120')
  await page.getByLabel('Kaedah pembayaran').selectOption('Card')
  await page.getByLabel('Tujuan pembelian').selectOption('personal')
  await page.getByLabel('Kategori pembelian').selectOption('general_goods')
  await page.getByLabel('Apakah masalahnya?').selectOption('non_delivery')
  await page.getByLabel('Penyelesaian utama').selectOption('refund')
  await page.getByLabel('Jumlah bayaran balik (RM)').fill('120')
  await page.getByLabel('Hubungan dengan peniaga').selectOption('none')
  await page.getByRole('button', { name: /Simpan draf kes/ }).click()

  await expect(page.getByRole('heading', { name: 'Rekod kes anda telah dimulakan.' })).toBeVisible()
  await expect(page.locator('.summary')).toContainText('Barangan atau perkhidmatan tidak diterima')
  await expect(page.locator('.summary')).toContainText('Bayaran balik')

  await page.getByRole('button', { name: 'Tambah bukti' }).click()
  await expect(page.getByRole('heading', { name: 'Simpan yang asal.' })).toBeVisible()
  await expect(page.getByLabel('Apakah jenis rekod?')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Semak kes' })).toBeDisabled()
})
