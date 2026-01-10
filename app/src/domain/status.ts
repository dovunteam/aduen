export const CASE_STATUSES = ['ready', 'handed_off', 'awaiting_response', 'resolved', 'closed'] as const
export type CaseStatus = typeof CASE_STATUSES[number]

export type SubmissionRecord = {
  status: CaseStatus
  channel: string
  submissionDate: string
  referenceNumber: string
  nextFollowUpDate: string
  response: string
  outcome: 'refund' | 'replacement' | 'repair' | 'delivery' | 'rejected' | 'redirected' | 'withdrawn' | 'unresolved' | ''
  updatedAt: string
}

export const EMPTY_SUBMISSION: SubmissionRecord = { status: 'ready', channel: '', submissionDate: '', referenceNumber: '', nextFollowUpDate: '', response: '', outcome: '', updatedAt: '' }

export function validateStatusTransition(from: CaseStatus, to: CaseStatus): boolean {
  const allowed: Record<CaseStatus, CaseStatus[]> = {
    ready: ['ready', 'handed_off'],
    handed_off: ['handed_off', 'awaiting_response', 'resolved', 'closed'],
    awaiting_response: ['awaiting_response', 'resolved', 'closed'],
    resolved: ['resolved'],
    closed: ['closed'],
  }
  return allowed[from].includes(to)
}

export function nextStatus(record: SubmissionRecord): CaseStatus {
  if (record.outcome) return record.outcome === 'refund' || record.outcome === 'replacement' || record.outcome === 'repair' || record.outcome === 'delivery' ? 'resolved' : 'closed'
  if (record.response.trim()) return 'awaiting_response'
  if (record.submissionDate) return 'handed_off'
  return 'ready'
}
