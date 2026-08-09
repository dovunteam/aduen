import { describe, expect, it } from 'vitest'
import { evidenceTypeLabel, formatFileSize, isValidEvidenceMetadata, MAX_EVIDENCE_BYTES, validateEvidenceFile, validateEvidenceSignature } from './evidence'

describe('evidence validation', () => {
  it('accepts supported evidence files', () => {
    expect(validateEvidenceFile({ size: 2048, type: 'application/pdf' })).toBeNull()
  })

  it('rejects empty, oversized, and unsupported files', () => {
    expect(validateEvidenceFile({ size: 0, type: 'image/png' })).toContain('empty')
    expect(validateEvidenceFile({ size: MAX_EVIDENCE_BYTES + 1, type: 'image/png' })).toContain('10 MB')
    expect(validateEvidenceFile({ size: 200, type: 'text/html' })).toContain('PDF')
  })

  it('formats metadata for display', () => {
    expect(formatFileSize(850)).toBe('850 B')
    expect(formatFileSize(2048)).toBe('2.0 KB')
    expect(formatFileSize(2 * 1024 * 1024)).toBe('2.0 MB')
    expect(evidenceTypeLabel('merchant_response')).toBe('Merchant response')
  })

  it('checks signatures instead of trusting MIME labels', () => {
    expect(validateEvidenceSignature('application/pdf', new TextEncoder().encode('%PDF-1.7'))).toBeNull()
    expect(validateEvidenceSignature('application/pdf', new TextEncoder().encode('<html>'))).toContain('do not match')
    expect(validateEvidenceSignature('image/png', new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBeNull()
    expect(validateEvidenceSignature('text/plain', new Uint8Array([65, 0, 66]))).toContain('do not match')
  })

  it('validates stored metadata independently from the upload form', () => {
    const valid = { id: 'e1', fileName: 'receipt.txt', mimeType: 'text/plain', size: 12, sha256: 'a'.repeat(64), sourceType: 'receipt', eventDate: '2026-09-21', description: 'Synthetic receipt', includeInPack: true, uploadedAt: '2026-09-21T00:00:00.000Z' }
    expect(isValidEvidenceMetadata(valid)).toBe(true)
    expect(isValidEvidenceMetadata({ ...valid, size: MAX_EVIDENCE_BYTES + 1 })).toBe(false)
    expect(isValidEvidenceMetadata({ ...valid, eventDate: '2026-02-30' })).toBe(false)
    expect(isValidEvidenceMetadata({ ...valid, sha256: 'not-a-hash' })).toBe(false)
  })
})
