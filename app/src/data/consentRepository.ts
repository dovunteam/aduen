import { createConsentRecord } from '../domain/consent'
import type { ConsentRecord } from '../domain/consent'

const CONSENT_KEY = 'tuntiva.consent.v1'

export function acceptConsent(): ConsentRecord {
  const record = createConsentRecord()
  localStorage.setItem(CONSENT_KEY, JSON.stringify(record))
  return record
}

export function readConsent(): ConsentRecord | null {
  try { const value = localStorage.getItem(CONSENT_KEY); return value ? JSON.parse(value) : null }
  catch { return null }
}

export function clearConsent(): void { localStorage.removeItem(CONSENT_KEY) }
