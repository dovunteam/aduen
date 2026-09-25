import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { acceptConsent, readConsent } from './consentRepository'
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

describe('consent repository', () => {
  it('rejects stale or malformed consent records', () => {
    localStorage.setItem('Aduen.consent.v1', JSON.stringify({ noticeVersion: 'old', acceptedAt: 'not-a-date', purpose: 'case-preparation-and-local-storage', withdrawalPath: 'data-controls' }))
    expect(readConsent()).toBeNull()
  })

  it('records acceptance in the local activity history', () => {
    const record = acceptConsent()
    expect(record.noticeVersion).toBe('local-first-privacy-and-role-v2')
    expect(listAuditEvents()).toMatchObject([{ action: 'consent_accepted', targetId: 'consent' }])
  })
})
