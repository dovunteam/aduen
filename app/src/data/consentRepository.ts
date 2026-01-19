import { createConsentRecord } from '../domain/consent'
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
    if (value) return JSON.parse(value)
    const legacy = localStorage.getItem(TUNTIVA_CONSENT_KEY)
    if (!legacy) return null
    localStorage.setItem(CONSENT_KEY, legacy); localStorage.removeItem(TUNTIVA_CONSENT_KEY)
    return JSON.parse(legacy)
  }
  catch { return null }
}

export function clearConsent(): void { localStorage.removeItem(CONSENT_KEY); localStorage.removeItem(TUNTIVA_CONSENT_KEY) }
