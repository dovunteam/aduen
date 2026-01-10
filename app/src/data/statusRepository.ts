import { EMPTY_SUBMISSION } from '../domain/status'
import type { SubmissionRecord } from '../domain/status'

const STATUS_KEY = 'tuntiva.submission-record.v1'

export function readSubmission(): SubmissionRecord {
  try {
    const value = localStorage.getItem(STATUS_KEY)
    return value ? { ...EMPTY_SUBMISSION, ...JSON.parse(value) } : EMPTY_SUBMISSION
  } catch { return EMPTY_SUBMISSION }
}

export function saveSubmission(record: SubmissionRecord): SubmissionRecord {
  const saved = { ...record, updatedAt: new Date().toISOString() }
  localStorage.setItem(STATUS_KEY, JSON.stringify(saved))
  return saved
}

export function clearSubmission(): void { localStorage.removeItem(STATUS_KEY) }
