import { describe, expect, it } from 'vitest'
import { buildFollowUpCalendar } from './followUpCalendar'
import { EMPTY_SUBMISSION } from '../domain/status'

describe('follow-up calendar export', () => {
  it('creates an all-day, escaped local calendar reminder', () => {
    const calendar = buildFollowUpCalendar({ ...EMPTY_SUBMISSION, channel: 'Merchant, support', referenceNumber: 'SYN;001', nextFollowUpDate: '2026-10-04' })
    expect(calendar).toContain('DTSTART;VALUE=DATE:20261004')
    expect(calendar).toContain('SUMMARY:Buktiva follow-up: Merchant\\, support')
    expect(calendar).toContain('Reference: SYN\\;001.')
  })

  it('does not create a calendar file without a valid follow-up date', () => {
    expect(buildFollowUpCalendar(EMPTY_SUBMISSION)).toBeNull()
    expect(buildFollowUpCalendar({ ...EMPTY_SUBMISSION, nextFollowUpDate: 'not-a-date' })).toBeNull()
  })
})
