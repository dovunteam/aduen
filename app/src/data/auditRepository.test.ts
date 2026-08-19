import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearAuditEvents, listAuditEvents, recordAuditEvent } from './auditRepository'

beforeEach(() => {
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  })
})
afterEach(() => vi.unstubAllGlobals())

describe('local audit log', () => {
  it('records ordered sensitive-action events and can clear them', () => {
    const first = recordAuditEvent('case_edited', 'case-1', 'case draft fields changed', new Date('2026-09-21T00:00:00Z'))
    const second = recordAuditEvent('redacted_copy_exported', 'e1', 'PNG copy', new Date('2026-09-21T00:01:00Z'))
    expect(listAuditEvents()).toEqual([first, second])
    clearAuditEvents()
    expect(listAuditEvents()).toEqual([])
  })

  it('keeps only the newest 500 events', () => {
    for (let index = 0; index < 505; index += 1) recordAuditEvent('evidence_downloaded', `e${index}`, 'original')
    const events = listAuditEvents()
    expect(events).toHaveLength(500)
    expect(events[0].targetId).toBe('e5')
  })

  it('ignores malformed stored records', () => {
    localStorage.setItem('buktiva.audit-log.v1', JSON.stringify([{ action: 'unknown' }, { id: 'invalid-time', at: 'not-a-date', action: 'case_exported', targetId: 'case', detail: 'archive' }, { id: 'oversized', at: '2026-09-21T00:00:00.000Z', action: 'case_exported', targetId: 'case', detail: 'x'.repeat(241) }, { id: 'control', at: '2026-09-21T00:00:00.000Z', action: 'case_exported', targetId: 'case', detail: 'archive\nwith-control' }, { id: 'valid', at: '2026-09-21T00:00:00.000Z', action: 'case_exported', targetId: 'case', detail: 'archive' }]))
    expect(listAuditEvents()).toHaveLength(1)
    expect(listAuditEvents()[0].id).toBe('valid')
  })

  it('normalises and bounds event details', () => {
    const event = recordAuditEvent('case_exported', 'case', `  first\nsecond\t${'x'.repeat(300)}  `)
    expect(event.detail).toBe(`first second ${'x'.repeat(240 - 'first second '.length)}`)
  })
})
