import { describe, expect, it, vi } from 'vitest'
import JSZip from 'jszip'
import { buildCaseArchive, safeFileName } from './caseArchive'
import { getEvidenceOriginal, listEvidence } from './evidenceRepository'
import { EMPTY_DRAFT } from '../domain/case'
import { EMPTY_SUBMISSION } from '../domain/status'

vi.mock('./evidenceRepository', () => ({ getEvidenceOriginal: vi.fn(), listEvidence: vi.fn(), listExtractions: vi.fn().mockResolvedValue([]) }))
vi.mock('./caseRepository', () => ({ readCase: () => null }))
vi.mock('./consentRepository', () => ({ readConsent: () => null }))
vi.mock('./packRepository', () => ({ listPacks: () => [] }))

describe('case archive', () => {
  it('exports all originals including evidence excluded from the complaint pack', async () => {
    const original = new Blob(['Synthetic private note'])
    const digest = await crypto.subtle.digest('SHA-256', await original.arrayBuffer())
    const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
    vi.mocked(listEvidence).mockResolvedValue([{ id: 'private-note', fileName: 'note.txt', mimeType: 'text/plain', size: original.size, sha256, sourceType: 'other', eventDate: null, description: '', uploadedAt: '', includeInPack: false }])
    vi.mocked(getEvidenceOriginal).mockResolvedValue(original)
    const zip = await JSZip.loadAsync(await buildCaseArchive(EMPTY_DRAFT, EMPTY_SUBMISSION))
    expect(await zip.file('evidence-originals/01-note.txt')!.async('string')).toBe('Synthetic private note')
    expect(JSON.parse(await zip.file('case-record.json')!.async('string')).evidence[0].includeInPack).toBe(false)
    vi.mocked(getEvidenceOriginal).mockResolvedValue(null)
    await expect(buildCaseArchive(EMPTY_DRAFT, EMPTY_SUBMISSION)).rejects.toThrow('original missing')
    vi.mocked(getEvidenceOriginal).mockResolvedValue(new Blob(['altered']))
    await expect(buildCaseArchive(EMPTY_DRAFT, EMPTY_SUBMISSION)).rejects.toThrow('integrity check failed')
  })
  it('prevents evidence names from creating unsafe archive paths', () => {
    expect(safeFileName('../receipt:final?.pdf')).toBe('._receipt_final_.pdf')
    expect(safeFileName('')).toBe('evidence-file')
  })
})
