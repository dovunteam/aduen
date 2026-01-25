import { beforeEach, describe, expect, it, vi } from 'vitest'
import JSZip from 'jszip'
import { buildHandoffArchive } from './handoffArchive'
import { getEvidenceOriginal } from './evidenceRepository'
import { approveComplaintPack, createComplaintPack } from '../domain/complaintPack'
import { EMPTY_DRAFT } from '../domain/case'
import { evaluateInitialRoute } from '../domain/routing'
import { createEvidenceExtraction, reviewCandidate } from '../domain/extraction'
import type { EvidenceMetadata } from '../domain/evidence'

vi.mock('./evidenceRepository', () => ({ getEvidenceOriginal: vi.fn() }))

async function fixture() {
  const original = new Blob(['Synthetic receipt RM 120.00'])
  const digest = await crypto.subtle.digest('SHA-256', await original.arrayBuffer())
  const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  const item: EvidenceMetadata = { id: 'selected', fileName: '../receipt.txt', mimeType: 'text/plain', size: original.size, sha256, sourceType: 'receipt', eventDate: null, description: '', includeInPack: true, uploadedAt: new Date().toISOString() }
  const excluded = { ...item, id: 'excluded', includeInPack: false }
  const extraction = createEvidenceExtraction('excluded', 'RM 999.00')
  extraction.candidates = extraction.candidates.map((candidate) => reviewCandidate(candidate, 'confirmed'))
  const pack = createComplaintPack(EMPTY_DRAFT, [item, excluded], evaluateInitialRoute(EMPTY_DRAFT, []), new Date(), 1, [extraction])
  return { original, pack: approveComplaintPack(pack) }
}

describe('approved evidence archive', () => {
  beforeEach(() => vi.resetAllMocks())

  it('packages verified selected originals and a PDF without excluded derived facts', async () => {
    const { original, pack } = await fixture()
    vi.mocked(getEvidenceOriginal).mockResolvedValue(original)
    const zip = await JSZip.loadAsync(await buildHandoffArchive(pack))
    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'))
    expect(manifest.evidence).toHaveLength(1)
    expect(await zip.file(manifest.evidence[0].archivePath)!.async('string')).toBe(await original.text())
    expect(manifest.evidence[0].archivePath).not.toContain('../')
    expect(manifest.pack.route).toMatchObject({ routeName: 'Manual review', ruleVersion: 'MY-R010-2026.09.20.2' })
    expect(getEvidenceOriginal).toHaveBeenCalledExactlyOnceWith('selected')
    expect(pack.confirmedDerivedFacts).toEqual([])
    const pdf = await zip.file('buktiva-case-v1.pdf')!.async('string')
    expect(pdf).toMatch(/^%PDF/)
    expect(pdf).not.toContain('999.00')
  })

  it('rejects unapproved packs before reading originals', async () => {
    const { pack } = await fixture()
    await expect(buildHandoffArchive({ ...pack, approvedAt: null })).rejects.toThrow('Approve')
    expect(getEvidenceOriginal).not.toHaveBeenCalled()
  })

  it('rejects missing or altered originals instead of exporting an incomplete archive', async () => {
    const { pack } = await fixture()
    vi.mocked(getEvidenceOriginal).mockResolvedValue(null)
    await expect(buildHandoffArchive(pack)).rejects.toThrow('Original missing')
    vi.mocked(getEvidenceOriginal).mockResolvedValue(new Blob(['altered']))
    await expect(buildHandoffArchive(pack)).rejects.toThrow('integrity check failed')
  })
})
