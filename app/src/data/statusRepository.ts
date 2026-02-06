import { CASE_STATUSES, EMPTY_SUBMISSION } from '../domain/status'
import type { SubmissionRecord } from '../domain/status'
import { recordAuditEvent } from './auditRepository'

const STATUS_KEY = 'buktiva.submission-record.v1'
const TUNTIVA_STATUS_KEY = 'tuntiva.submission-record.v1'
const OUTCOMES: SubmissionRecord['outcome'][] = ['', 'refund', 'replacement', 'repair', 'delivery', 'partial', 'rejected', 'redirected', 'withdrawn', 'unresolved']

export function readSubmission(): SubmissionRecord {
  try {
    const value = localStorage.getItem(STATUS_KEY) ?? localStorage.getItem(TUNTIVA_STATUS_KEY)
    if (!value) return EMPTY_SUBMISSION
    if (!localStorage.getItem(STATUS_KEY)) { localStorage.setItem(STATUS_KEY, value); localStorage.removeItem(TUNTIVA_STATUS_KEY) }
    const candidate = { ...EMPTY_SUBMISSION, ...JSON.parse(value) } as SubmissionRecord
    if (!isSubmissionRecord(candidate)) return EMPTY_SUBMISSION
    return candidate
  } catch { return EMPTY_SUBMISSION }
}

export function saveSubmission(record: SubmissionRecord): SubmissionRecord {
  const previous = readSubmission()
  const saved = { ...record, updatedAt: new Date().toISOString() }
  if (!isSubmissionRecord(saved)) throw new Error('Invalid submission record.')
  localStorage.setItem(STATUS_KEY, JSON.stringify(saved))
  const { updatedAt: _previousUpdatedAt, ...previousContent } = previous
  const { updatedAt: _savedUpdatedAt, ...savedContent } = saved
  if (JSON.stringify(previousContent) !== JSON.stringify(savedContent)) recordAuditEvent('submission_edited', 'submission', 'external status record changed')
  return saved
}

export function clearSubmission(): void { localStorage.removeItem(STATUS_KEY); localStorage.removeItem(TUNTIVA_STATUS_KEY) }

function isSubmissionRecord(value: SubmissionRecord): boolean {
  const strings = [value.channel, value.submissionDate, value.referenceNumber, value.nextFollowUpDate, value.response, value.updatedAt]
  const followUpOrderValid = !value.submissionDate || !value.nextFollowUpDate || value.nextFollowUpDate >= value.submissionDate
  const requiresHandoff = ['handed_off', 'awaiting_response', 'resolved', 'closed'].includes(value.status)
  const hasHandoffDetails = Boolean(value.channel.trim() && value.submissionDate)
  const successfulOutcome = ['refund', 'replacement', 'repair', 'delivery', 'partial'].includes(value.outcome)
  const closedOutcome = ['rejected', 'redirected', 'withdrawn', 'unresolved'].includes(value.outcome)
  const outcomeMatchesStatus = value.status !== 'resolved' && value.status !== 'closed' || value.status === 'resolved' && successfulOutcome || value.status === 'closed' && closedOutcome
  return CASE_STATUSES.includes(value.status) && OUTCOMES.includes(value.outcome) && strings.every((item) => typeof item === 'string') && isDateOnlyOrEmpty(value.submissionDate) && isDateOnlyOrEmpty(value.nextFollowUpDate) && isIsoTimestampOrEmpty(value.updatedAt) && followUpOrderValid && (!requiresHandoff || hasHandoffDetails) && outcomeMatchesStatus
}

function isDateOnlyOrEmpty(value: string): boolean {
  if (!value) return true
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function isIsoTimestampOrEmpty(value: string): boolean {
  if (!value) return true
  try { return new Date(value).toISOString() === value } catch { return false }
}
