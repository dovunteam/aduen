import { expect, test } from '@playwright/test'

async function addBmEvidence(page: import('@playwright/test').Page, type: string, name: string, content = `Synthetic ${name}.`) {
  await page.getByLabel('Fail asal').setInputFiles({ name, mimeType: 'text/plain', buffer: Buffer.from(content) })
  await page.getByLabel('Apakah jenis rekod?').selectOption(type)
  await page.getByRole('button', { name: 'Tambah bukti' }).click()
  await expect(page.getByText(name, { exact: true })).toBeVisible()
}

test('Bahasa Malaysia preference persists across the safety journey', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'BM' }).click()

  await expect(page.locator('html')).toHaveAttribute('lang', 'ms')
  await expect(page.getByRole('heading', { name: 'Susun semula pembelian yang bermasalah.' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('button', { name: 'BM' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByLabel(/Saya memahami peranan Aduen/).check()
  await page.getByRole('button', { name: 'Mulakan semakan keselamatan' }).click()
  await page.getByLabel('Bayaran atau transaksi tidak dibenarkan oleh saya').check()

  await expect(page.getByRole('alert')).toContainText('Hubungi bank anda')
  await expect(page.getByRole('link', { name: /Panduan penipuan Bank Negara Malaysia/ })).toHaveAttribute('href', 'https://www.bnm.gov.my/faqs/scams')
})

test('Bahasa Malaysia case details preserve stable domain values', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'BM' }).click()
  await page.getByLabel(/Saya memahami peranan Aduen/).check()
  await page.getByRole('button', { name: 'Mulakan semakan keselamatan' }).click()
  await page.getByRole('button', { name: /Tiada isu mendesak/ }).click()

  await page.getByLabel('Nama anda atau nama kes pilihan').fill('Pengguna Contoh')
  await page.getByLabel('Lokasi anda').selectOption('malaysia')
  await page.getByLabel('Penjual atau peniaga').fill('Kedai Contoh')
  await page.getByLabel('Lokasi penjual').selectOption('malaysia')
  await page.getByLabel('Tarikh pembelian').fill('2026-09-03')
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

  await addBmEvidence(page, 'receipt', 'resit.txt')
  await addBmEvidence(page, 'payment', 'bayaran.txt')
  await addBmEvidence(page, 'listing', 'iklan.txt')
  await page.getByLabel('Fail asal').setInputFiles({ name: 'mesej.txt', mimeType: 'text/plain', buffer: Buffer.from('No. rujukan: ADU-1234. Tarikh pembelian: 3 September 2026. Dibayar RM120.00 pada 3 September 2026. Nama pelanggan: Pengguna Contoh. Saya memohon bayaran balik. Hubungi saya di pengguna@example.test.') })
  await page.getByLabel('Apakah jenis rekod?').selectOption('message')
  await page.getByRole('button', { name: 'Tambah bukti' }).click()
  await expect(page.getByRole('alert')).toContainText('alamat e-mel')
  await page.getByLabel('Saya telah menyemak amaran ini dan masih perlu menyertakan fail asal ini.').check()
  await page.getByRole('button', { name: 'Tambah bukti' }).click()
  await page.getByRole('button', { name: 'Semak kes' }).click()
  await expect(page.getByRole('heading', { name: 'Semak setiap calon.' })).toBeVisible()
  await expect(page.getByText('plain-text-v4', { exact: true })).toBeVisible()
  const confirmCandidate = page.getByRole('button', { name: 'Sahkan', exact: true })
  await expect(confirmCandidate).toHaveCount(5)
  for (let index = 0; index < 5; index += 1) {
    await expect(confirmCandidate.nth(index)).toBeEnabled()
    await confirmCandidate.nth(index).click()
  }
  await page.getByRole('button', { name: 'Teruskan ke Semakan Aduen' }).click()
  await expect(page.getByRole('heading', { name: 'Semak rekod.' })).toBeVisible()
  await expect(page.getByText('Garis masa Aduen', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Sediakan permintaan peniaga' }).click()
  await expect(page.getByRole('heading', { name: 'Semak sebelum mengeksport.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Fakta terbitan disahkan/ })).toBeVisible()
  await expect(page.getByText('plain-text-v4').last()).toBeVisible()
  await expect(page.locator('.request-preview')).toContainText('Tuan/Puan Kedai Contoh')
  await expect(page.locator('.request-preview')).toContainText('masih belum diterima')
  await expect(page.locator('.request-preview')).not.toContainText('I am writing')
  await expect(page.getByLabel(/Saya telah menyemak pek ini/)).toBeVisible()
  await page.getByLabel(/Saya telah menyemak pek ini/).check()
  const pdfDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: /Luluskan dan eksport PDF/ }).click()
  expect((await pdfDownload).suggestedFilename()).toMatch(/^Aduen-kedai-contoh-v\d+\.pdf$/)
})

test('Bahasa Malaysia privacy controls describe local data handling', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'BM' }).click()
  await page.getByRole('button', { name: 'Kawalan data' }).click()

  await expect(page.getByRole('heading', { name: 'Data anda kekal di bawah kawalan anda.' })).toBeVisible()
  await expect(page.getByText('Pelayar ini', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Sejarah aktiviti setempat' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Eksport ZIP' })).toBeDisabled()
})
