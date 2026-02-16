import { describe, expect, it } from 'vitest'
import { detectEvidenceRisks, scanEvidenceFile } from './evidenceSafety'

describe('evidence safety scan', () => {
  it('flags plausible payment-card numbers using a checksum', () => {
    expect(detectEvidenceRisks('Card 4111 1111 1111 1111').map((risk) => risk.code)).toContain('card_number')
    expect(detectEvidenceRisks('Reference 4111 1111 1111 1112').map((risk) => risk.code)).not.toContain('card_number')
  })

  it('flags authentication and identity-document language', () => {
    const codes = detectEvidenceRisks('OTP 123456. MyKad number follows.').map((risk) => risk.code)
    expect(codes).toContain('authentication_secret')
    expect(codes).toContain('identity_number')
  })

  it('flags explicit third-party information language', () => {
    expect(detectEvidenceRisks('This screenshot contains someone else\'s phone number.').map((risk) => risk.code)).toContain('third_party_data')
    expect(detectEvidenceRisks('This screenshot contains another person\u2019s email address.').map((risk) => risk.code)).toContain('third_party_data')
    expect(detectEvidenceRisks('My own phone number is included.').map((risk) => risk.code)).not.toContain('third_party_data')
  })

  it('flags possible contact details without assuming whose they are', () => {
    expect(detectEvidenceRisks('Contact: example.person@example.test').map((risk) => risk.code)).toContain('contact_details')
    expect(detectEvidenceRisks('Mobile: +60 12-345 6789').map((risk) => risk.code)).toContain('contact_details')
    expect(detectEvidenceRisks('Order reference: ADU-2048').map((risk) => risk.code)).not.toContain('contact_details')
  })

  it('scans the full accepted text file instead of only its opening section', async () => {
    const text = `${'ordinary evidence text. '.repeat(30_000)} Card 4111 1111 1111 1111`
    const risks = await scanEvidenceFile(new File([text], 'long-receipt.txt', { type: 'text/plain' }))
    expect(risks.map((risk) => risk.code)).toContain('card_number')
  })

  it('does not flag ordinary complaint text', () => {
    expect(detectEvidenceRisks('The merchant promised delivery on 20 September.')).toEqual([])
  })

  it('requires manual review for binary evidence that cannot be text-scanned', async () => {
    const risks = await scanEvidenceFile(new File(['%PDF-1.4'], 'receipt.pdf', { type: 'application/pdf' }))
    expect(risks.map((risk) => risk.code)).toEqual(['binary_unscanned'])
  })
})
