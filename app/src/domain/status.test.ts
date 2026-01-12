import { describe, expect, it } from 'vitest'
import { EMPTY_SUBMISSION, nextStatus, validateStatusTransition } from './status'

describe('case status', () => {
  it('derives handoff and response states from recorded external events', () => {
    expect(nextStatus({ ...EMPTY_SUBMISSION, submissionDate: '2026-05-01' })).toBe('handed_off')
    expect(nextStatus({ ...EMPTY_SUBMISSION, submissionDate: '2026-05-01', response: 'We are reviewing it.' })).toBe('awaiting_response')
  })

  it('separates successful and unsuccessful terminal outcomes', () => {
    expect(nextStatus({ ...EMPTY_SUBMISSION, outcome: 'refund' })).toBe('resolved')
    expect(nextStatus({ ...EMPTY_SUBMISSION, outcome: 'partial' })).toBe('resolved')
    expect(nextStatus({ ...EMPTY_SUBMISSION, outcome: 'rejected' })).toBe('closed')
  })

  it('prevents a terminal case from silently returning to an active state', () => {
    expect(validateStatusTransition('resolved', 'awaiting_response')).toBe(false)
    expect(validateStatusTransition('awaiting_response', 'resolved')).toBe(true)
  })
})
