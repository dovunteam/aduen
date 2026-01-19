import { EMPTY_SUBMISSION } from '../domain/status'
import type { SubmissionRecord } from '../domain/status'

const STATUS_KEY = 'buktiva.submission-record.v1'
const TUNTIVA_STATUS_KEY = 'tuntiva.submission-record.v1'

export function readSubmission(): SubmissionRecord {
  try {
    const value = localStorage.getItem(STATUS_KEY) ?? localStorage.getItem(TUNTIVA_STATUS_KEY)
    if (!value) return EMPTY_SUBMISSION
    if (!localStorage.getItem(STATUS_KEY)) { localStorage.setItem(STATUS_KEY, value); localStorage.removeItem(TUNTIVA_STATUS_KEY) }
    return { ...EMPTY_SUBMISSION, ...JSON.parse(value) }
  } catch { return EMPTY_SUBMISSION }
}

export function saveSubmission(record: SubmissionRecord): SubmissionRecord {
  const saved = { ...record, updatedAt: new Date().toISOString() }
  localStorage.setItem(STATUS_KEY, JSON.stringify(saved))
  return saved
}

export function clearSubmission(): void { localStorage.removeItem(STATUS_KEY); localStorage.removeItem(TUNTIVA_STATUS_KEY) }
