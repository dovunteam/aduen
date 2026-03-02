import { clearAuditEvents } from './auditRepository'
import { clearCase } from './caseRepository'
import { clearConsent } from './consentRepository'
import { clearEvidence } from './evidenceRepository'
import { clearOperatorReviews } from './operatorReviewRepository'
import { clearPacks } from './packRepository'
import { clearSubmission } from './statusRepository'
import { recordAuditEvent } from './auditRepository'

export type RetentionRecord = { setAt: string; expiresAt: string; days: 30 | 90 | 365 }

const STORAGE_KEY = 'Aduen.retention.v1'

export function readRetention(): RetentionRecord | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    if (!value) return null
    const record = JSON.parse(value) as Partial<RetentionRecord>
    if (![30, 90, 365].includes(record.days as number) || !isIsoTimestamp(record.setAt) || !isIsoTimestamp(record.expiresAt)) return null
    return record as RetentionRecord
  } catch { return null }
}

export function saveRetention(days: RetentionRecord['days'], now = new Date()): RetentionRecord {
  const record: RetentionRecord = { setAt: now.toISOString(), expiresAt: new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString(), days }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
  recordAuditEvent('retention_updated', 'retention', `local retention set to ${days} days`)
  return record
}

export function clearRetention(audit = true): void {
  localStorage.removeItem(STORAGE_KEY)
  if (audit) recordAuditEvent('retention_updated', 'retention', 'local retention disabled')
}

export function isRetentionDue(record: RetentionRecord | null, now = new Date()): boolean {
  return Boolean(record && record.expiresAt <= now.toISOString())
}

export async function expireLocalDataIfDue(now = new Date()): Promise<boolean> {
  const record = readRetention()
  if (!isRetentionDue(record, now)) return false
  await clearEvidence()
  clearSubmission()
  clearPacks()
  clearOperatorReviews()
  clearConsent()
  clearAuditEvents()
  clearCase()
  clearRetention(false)
  return true
}

function isIsoTimestamp(value: unknown): value is string {
  try { return typeof value === 'string' && new Date(value).toISOString() === value } catch { return false }
}
