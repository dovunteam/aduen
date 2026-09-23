import { describe, expect, it } from 'vitest'
import { localizeFactConflict } from './caseReviewMessages'

describe('case review conflict messages', () => {
  it('localizes semantic fact conflicts in Bahasa Malaysia', () => {
    expect(localizeFactConflict('Confirmed evidence contains different transaction amounts.', 'ms')).toContain('jumlah transaksi yang berbeza')
    expect(localizeFactConflict('Confirmed evidence contains different refund amounts.', 'ms')).toContain('jumlah bayaran balik yang berbeza')
    expect(localizeFactConflict('A confirmed extracted refund amount differs from the entered requested refund amount of MYR 25.00.', 'ms')).toContain('MYR 25.00')
    expect(localizeFactConflict('Confirmed evidence contains multiple dates labelled for merchant contact.', 'ms')).toContain('hubungan dengan peniaga')
    expect(localizeFactConflict('A confirmed date labelled for promised performance differs from the entered promised performance date of 2026-08-03.', 'ms')).toContain('2026-08-03')
    expect(localizeFactConflict('A confirmed extracted remedy differs from the entered requested remedy of refund.', 'ms')).toContain('bayaran balik')
    expect(localizeFactConflict('Confirmed evidence contains different consumer names.', 'ms')).toContain('nama pengguna yang berbeza')
    expect(localizeFactConflict('A confirmed extracted reference differs from the entered order or reference number.', 'ms')).toContain('Nombor rujukan')
    expect(localizeFactConflict('A confirmed promised performance date occurs before the recorded purchase date.', 'ms')).toContain('sebelum tarikh pembelian')
    expect(localizeFactConflict('A confirmed delivery date occurs before the recorded purchase date.', 'ms')).toContain('sebelum tarikh pembelian')
    expect(localizeFactConflict('A confirmed delivery date occurs before the promised performance date.', 'ms')).toContain('sebelum tarikh prestasi yang dijanjikan')
  })

  it('preserves the original English message for the English interface', () => {
    const message = 'Confirmed evidence contains different transaction amounts.'
    expect(localizeFactConflict(message, 'en')).toBe(message)
  })
})
