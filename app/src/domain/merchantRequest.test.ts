import { describe, expect, it } from 'vitest'
import { EMPTY_DRAFT } from './case'
import { createMerchantRequest } from './merchantRequest'

describe('merchant request generation', () => {
  it('produces a factual single-remedy request from entered fields', () => {
    const request = createMerchantRequest({ ...EMPTY_DRAFT, consumerName: 'Synthetic Consumer', seller: 'Synthetic Store', purchaseDate: '2026-08-01', amount: '125.5', orderReference: 'SYN-1', issue: 'non_delivery', remedy: 'refund', remedyAmount: '125.5' })
    expect(request.subject).toContain('refund')
    expect(request.body).toContain('MYR 125.50')
    expect(request.body).toContain('have not been received')
    expect(request.generatedFrom).toContain('issue')
  })

  it('does not introduce accusations, legal conclusions, or invented deadlines', () => {
    const text = createMerchantRequest({ ...EMPTY_DRAFT, issue: 'mismatch', remedy: 'replacement' }).body.toLowerCase()
    expect(text).not.toMatch(/fraud|illegal|theft|entitled|within \d+ days/)
  })

  it('generates the approved request in Bahasa Malaysia when selected', () => {
    const request = createMerchantRequest({ ...EMPTY_DRAFT, consumerName: 'Nama Contoh', seller: 'Kedai Contoh', purchaseDate: '2026-08-01', amount: '125.50', orderReference: 'SYN-1', issue: 'non_delivery', remedy: 'refund', remedyAmount: '125.5' }, 'ms')
    expect(request.subject).toContain('Permohonan bayaran balik')
    expect(request.body).toContain('Tuan/Puan Kedai Contoh')
    expect(request.body).toContain('masih belum diterima')
    expect(request.body).toContain('sebanyak RM125.50')
    expect(request.body).toContain('Nama Contoh')
    expect(request.body).not.toContain('I am writing')
  })
})
