import { recordAuditEvent } from './auditRepository'

export const OPERATOR_REVIEW_CHECKS = ['facts', 'route', 'deadlines', 'language', 'evidence'] as const
export type OperatorReviewCheck = typeof OPERATOR_REVIEW_CHECKS[number]
export type OperatorReview = {
  reviewerCode: string
  reviewedAt: string
  notes: string
  checks: Record<OperatorReviewCheck, boolean>
}

const STORAGE_KEY = 'Aduen.operator-reviews.v1'

export function readOperatorReview(packId: string): OperatorReview | null {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, unknown>
    const review = value[packId]
    return isOperatorReview(review) ? review : null
  } catch { return null }
}

export function listOperatorReviews(): Record<string, OperatorReview> {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, unknown>
    return Object.fromEntries(Object.entries(value).filter(([, review]) => isOperatorReview(review))) as Record<string, OperatorReview>
  } catch { return {} }
}

export function saveOperatorReview(packId: string, review: OperatorReview): void {
  if (!isSafeId(packId) || !isOperatorReview(review)) throw new Error('Invalid operator review.')
  const reviews = listOperatorReviews()
  reviews[packId] = review
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews))
  recordAuditEvent('operator_review_recorded', packId, `operator review recorded by ${review.reviewerCode}`)
}

export function clearOperatorReviews(): void { localStorage.removeItem(STORAGE_KEY) }

export function isCompleteOperatorReview(review: OperatorReview | null): review is OperatorReview {
  return Boolean(review && review.reviewerCode.trim() && OPERATOR_REVIEW_CHECKS.every((check) => review.checks[check]))
}

function isOperatorReview(value: unknown): value is OperatorReview {
  if (!value || typeof value !== 'object') return false
  const review = value as Partial<OperatorReview>
  return typeof review.reviewerCode === 'string' && review.reviewerCode.trim().length > 0 && review.reviewerCode.length <= 120 && isIsoTimestamp(review.reviewedAt) && typeof review.notes === 'string' && review.notes.length <= 1000 && Boolean(review.checks && typeof review.checks === 'object') && OPERATOR_REVIEW_CHECKS.every((check) => typeof review.checks?.[check] === 'boolean')
}

function isSafeId(value: string): boolean { return value.length > 0 && value.length <= 100 && !Array.from(value).some((character) => { const code = character.charCodeAt(0); return code <= 31 || code === 127 }) }
function isIsoTimestamp(value: unknown): value is string { try { return typeof value === 'string' && new Date(value).toISOString() === value } catch { return false } }
