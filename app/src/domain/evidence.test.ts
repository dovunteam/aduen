import { describe, expect, it } from 'vitest'
import { evidenceTypeLabel, formatFileSize, MAX_EVIDENCE_BYTES, validateEvidenceFile } from './evidence'

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
})
