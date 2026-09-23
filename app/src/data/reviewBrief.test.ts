import { describe, expect, it } from 'vitest'
import { EMPTY_DRAFT } from '../domain/case'
import { buildReviewBrief } from './reviewBrief'

describe('manual review briefs', () => {
  it('preserves review inputs without including original file bytes', () => {
    const brief = buildReviewBrief({
      case: { ...EMPTY_DRAFT, seller: 'Example seller' },
      locale: 'en',
      checks: [],
      timeline: [],
      conflicts: ['Amount needs review'],
      route: {
        routeName: 'Manual review',
        recommendedAction: 'Check the missing facts.',
        matchingFacts: [],
        unmetPrerequisites: ['Transaction amount'],
        exclusionsChecked: [],
        source: 'Aduen Case Routing Rules',
        sourceUrl: 'https://example.com/rules',
        sourceType: 'product-default',
        sourceChecked: '2026-09-23',
        ruleVersion: 'test-1',
        confidence: 'uncertain',
      },
      evidence: [{ id: 'e1', fileName: 'receipt.txt', mimeType: 'text/plain', size: 10, sha256: 'a'.repeat(64), sourceType: 'receipt', eventDate: null, description: 'Receipt', includeInPack: true, uploadedAt: '2026-09-23T00:00:00.000Z' }],
      extractions: [],
    }, new Date('2026-09-24T00:00:00.000Z'))

    expect(brief.exportVersion).toBe(1)
    expect(brief.exportedAt).toBe('2026-09-24T00:00:00.000Z')
    expect(brief.case.seller).toBe('Example seller')
    expect(brief.conflicts).toEqual(['Amount needs review'])
    expect(brief.evidence[0].fileName).toBe('receipt.txt')
    expect(brief).not.toHaveProperty('originals')
  })
})
