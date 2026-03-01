import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearRetention, isRetentionDue, readRetention, saveRetention } from './retentionRepository'

describe('retention settings', () => {
  beforeEach(() => {
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('stores a dated retention choice and reports when it is due', () => {
    const now = new Date('2026-09-24T00:00:00.000Z')
    const record = saveRetention(30, now)
    expect(record.expiresAt).toBe('2026-10-24T00:00:00.000Z')
    expect(readRetention()).toEqual(record)
    expect(isRetentionDue(record, new Date('2026-10-23T23:59:59.999Z'))).toBe(false)
    expect(isRetentionDue(record, new Date('2026-10-24T00:00:00.000Z'))).toBe(true)
    clearRetention()
    expect(readRetention()).toBeNull()
  })

  it('ignores malformed retention records', () => {
    localStorage.setItem('Aduen.retention.v1', JSON.stringify({ days: 45, setAt: 'invalid', expiresAt: 'invalid' }))
    expect(readRetention()).toBeNull()
  })
})
