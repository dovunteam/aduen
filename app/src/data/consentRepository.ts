import { createConsentRecord, NOTICE_VERSION } from '../domain/consent'
import type { ConsentRecord } from '../domain/consent'

const CONSENT_KEY = 'buktiva.consent.v1'
const TUNTIVA_CONSENT_KEY = 'tuntiva.consent.v1'

export function acceptConsent(): ConsentRecord {
  const record = createConsentRecord()
  localStorage.setItem(CONSENT_KEY, JSON.stringify(record))
  return record
}

export function readConsent(): ConsentRecord | null {
  try {
    const value = localStorage.getItem(CONSENT_KEY)
    if (value) return parseConsent(value)
    const legacy = localStorage.getItem(TUNTIVA_CONSENT_KEY)
    if (!legacy) return null
    const parsed = parseConsent(legacy)
    if (!parsed) return null
    localStorage.setItem(CONSENT_KEY, JSON.stringify(parsed)); localStorage.removeItem(TUNTIVA_CONSENT_KEY)
    return parsed
  }
  catch { return null }
}

export function clearConsent(): void { localStorage.removeItem(CONSENT_KEY); localStorage.removeItem(TUNTIVA_CONSENT_KEY) }

function parseConsent(value: string): ConsentRecord | null {
  const parsed = JSON.parse(value) as Partial<ConsentRecord>
  if (parsed.noticeVersion !== NOTICE_VERSION || parsed.purpose !== 'case-preparation-and-local-storage' || parsed.withdrawalPath !== 'data-controls' || typeof parsed.acceptedAt !== 'string') return null
  try { if (new Date(parsed.acceptedAt).toISOString() !== parsed.acceptedAt) return null } catch { return null }
  return parsed as ConsentRecord
}
