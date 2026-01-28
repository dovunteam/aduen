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
    const first = recordAuditEvent('evidence_previewed', 'e1', 'image preview', new Date('2026-09-21T00:00:00Z'))
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
})
