import { expect, test } from '@playwright/test'

test('migrates an existing Tuntiva case, consent, and language preference to Buktiva keys', async ({ page }) => {
  await page.addInitScript(() => {
    const draft = {
      consumerName: 'Legacy Consumer', consumerLocation: 'malaysia', seller: 'Legacy Store', sellerLocation: 'malaysia', platform: '', purchaseDate: '2026-09-01', amount: '50', currency: 'MYR', paymentMethod: 'Card', orderReference: '', purpose: 'personal', issue: 'non_delivery', category: 'general_goods', remedy: 'refund', remedyAmount: '50', promisedDate: '', contactHistory: 'none', contactDate: '',
    }
    localStorage.setItem('tuntiva.case-record.v1', JSON.stringify({ id: 'legacy-case', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z', status: 'draft', draft, history: [] }))
    localStorage.setItem('tuntiva.consent.v1', JSON.stringify({ noticeVersion: 'prototype-privacy-and-role-v1', acceptedAt: '2026-09-01T00:00:00.000Z', purpose: 'case-preparation-and-local-storage', withdrawalPath: 'data-controls' }))
    localStorage.setItem('tuntiva-locale', 'ms')
  })

  await page.goto('/')

  await expect(page.locator('html')).toHaveAttribute('lang', 'ms')
  await expect(page.getByRole('button', { name: 'Sambung kes tersimpan' })).toBeEnabled()
  await expect.poll(() => page.evaluate(() => ({
    case: localStorage.getItem('buktiva.case-record.v1'),
    consent: localStorage.getItem('buktiva.consent.v1'),
    locale: localStorage.getItem('buktiva-locale'),
    oldCase: localStorage.getItem('tuntiva.case-record.v1'),
    oldConsent: localStorage.getItem('tuntiva.consent.v1'),
    oldLocale: localStorage.getItem('tuntiva-locale'),
  }))).toEqual({ case: expect.any(String), consent: expect.any(String), locale: 'ms', oldCase: null, oldConsent: null, oldLocale: null })
})
