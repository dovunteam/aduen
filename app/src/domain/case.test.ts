import { describe, expect, it } from 'vitest'
import { createCaseRecord, EMPTY_DRAFT, transitionCase } from './case'

describe('case record', () => {
  it('creates a unique auditable record', () => {
    const record = createCaseRecord(EMPTY_DRAFT, new Date('2026-09-20T10:00:00Z'))
    expect(record.id).toBeTruthy()
    expect(record.status).toBe('draft')
    expect(record.history[0]).toEqual({ at: '2026-09-20T10:00:00.000Z', actor: 'system', action: 'case_created', status: 'draft' })
  })

  it('appends status transitions without altering earlier history', () => {
    const original = createCaseRecord(EMPTY_DRAFT, new Date('2026-09-20T10:00:00Z'))
    const changed = transitionCase(original, 'evidence_collection', 'case_details_confirmed', new Date('2026-09-20T10:05:00Z'))
    expect(original.history).toHaveLength(1)
    expect(changed.history).toHaveLength(2)
    expect(changed.status).toBe('evidence_collection')
  })
})
