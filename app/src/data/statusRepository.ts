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
  localStorage.setItem(STATUS_KEY, JSON.stringify(saved))
  const { updatedAt: _previousUpdatedAt, ...previousContent } = previous
  const { updatedAt: _savedUpdatedAt, ...savedContent } = saved
  if (JSON.stringify(previousContent) !== JSON.stringify(savedContent)) recordAuditEvent('submission_edited', 'submission', 'external status record changed')
  return saved
}

export function clearSubmission(): void { localStorage.removeItem(STATUS_KEY); localStorage.removeItem(TUNTIVA_STATUS_KEY) }

function isSubmissionRecord(value: SubmissionRecord): boolean {
  return CASE_STATUSES.includes(value.status) && OUTCOMES.includes(value.outcome) && [value.channel, value.submissionDate, value.referenceNumber, value.nextFollowUpDate, value.response, value.updatedAt].every((item) => typeof item === 'string')
}
