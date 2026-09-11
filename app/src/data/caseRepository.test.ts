import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EMPTY_DRAFT } from '../domain/case'
import { readCase, saveCaseDraft } from './caseRepository'
import { listAuditEvents } from './auditRepository'

beforeEach(() => {
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  })
})
afterEach(() => vi.unstubAllGlobals())

describe('case repository', () => {
  it('rejects a stored case with an unknown lifecycle status', () => {
    localStorage.setItem('buktiva.case-record.v1', JSON.stringify({ id: 'case-1', createdAt: '2026-09-21', updatedAt: '2026-09-21', status: 'invalid', draft: EMPTY_DRAFT, history: [] }))
    expect(readCase()).toBeNull()
  })

  it('rejects invalid draft dates and amounts before writing', () => {
    expect(() => saveCaseDraft({ ...EMPTY_DRAFT, purchaseDate: '2026-02-30' })).toThrow('Invalid case draft')
    expect(() => saveCaseDraft({ ...EMPTY_DRAFT, amount: '-1' })).toThrow('Invalid case draft')
    expect(() => saveCaseDraft({ ...EMPTY_DRAFT, amount: '25.999' })).toThrow('Invalid case draft')
    expect(() => saveCaseDraft({ ...EMPTY_DRAFT, amount: ' ' })).toThrow('Invalid case draft')
    expect(readCase()).toBeNull()
  })

  it('rejects stored cases with non-canonical lifecycle timestamps', () => {
    localStorage.setItem('buktiva.case-record.v1', JSON.stringify({ id: 'case-1', createdAt: '2026-09-21', updatedAt: '2026-09-21', status: 'draft', draft: EMPTY_DRAFT, history: [] }))
    expect(readCase()).toBeNull()
  })

  it('rejects stored cases without identity or lifecycle history', () => {
    const timestamp = '2026-09-21T00:00:00.000Z'
    const base = { createdAt: timestamp, updatedAt: timestamp, status: 'draft', draft: EMPTY_DRAFT }
    localStorage.setItem('buktiva.case-record.v1', JSON.stringify({ ...base, id: '', history: [{ at: timestamp, actor: 'system', action: 'case_created', status: 'draft' }] }))
    expect(readCase()).toBeNull()
    localStorage.setItem('buktiva.case-record.v1', JSON.stringify({ ...base, id: 'case-1', history: [] }))
    expect(readCase()).toBeNull()
  })

  it('rejects oversized or control-character case text', () => {
    expect(() => saveCaseDraft({ ...EMPTY_DRAFT, seller: 'x'.repeat(501) })).toThrow('Invalid case draft')
    expect(() => saveCaseDraft({ ...EMPTY_DRAFT, consumerName: 'Synthetic\nBuyer' })).toThrow('Invalid case draft')

    const timestamp = '2026-09-21T00:00:00.000Z'
    localStorage.setItem('buktiva.case-record.v1', JSON.stringify({
      id: 'case-1', createdAt: timestamp, updatedAt: timestamp, status: 'draft', draft: EMPTY_DRAFT,
      history: [{ at: timestamp, actor: 'system', action: 'x'.repeat(161), status: 'draft' }],
    }))
    expect(readCase()).toBeNull()
  })

  it('audits first creation separately from later edits', () => {
    saveCaseDraft({ ...EMPTY_DRAFT, seller: 'Synthetic seller' })
    expect(listAuditEvents().map((event) => event.action)).toEqual(['case_created'])
    saveCaseDraft({ ...EMPTY_DRAFT, seller: 'Updated synthetic seller' })
    expect(listAuditEvents().map((event) => event.action)).toEqual(['case_created', 'case_edited'])
  })
})
