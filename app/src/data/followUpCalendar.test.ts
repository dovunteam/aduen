import { describe, expect, it } from 'vitest'
import { buildFollowUpCalendar } from './followUpCalendar'
import { EMPTY_SUBMISSION } from '../domain/status'

describe('follow-up calendar export', () => {
  it('creates an all-day, escaped local calendar reminder', () => {
    const calendar = buildFollowUpCalendar({ ...EMPTY_SUBMISSION, channel: 'Merchant, support', referenceNumber: 'SYN;001', nextFollowUpDate: '2026-10-04' })?.replace(/\r\n /g, '')
    expect(calendar).toContain('DTSTART;VALUE=DATE:20261004')
    expect(calendar).toContain('SUMMARY:Buktiva follow-up: Merchant\\, support')
    expect(calendar).toContain('Reference: SYN\\;001.')
    expect(calendar).toContain('based on the follow-up date you entered\\, not an external deadline')
  })

  it('does not create a calendar file without a valid follow-up date', () => {
    expect(buildFollowUpCalendar(EMPTY_SUBMISSION)).toBeNull()
    expect(buildFollowUpCalendar({ ...EMPTY_SUBMISSION, nextFollowUpDate: 'not-a-date' })).toBeNull()
    expect(buildFollowUpCalendar({ ...EMPTY_SUBMISSION, nextFollowUpDate: '2026-02-30' })).toBeNull()
    expect(buildFollowUpCalendar({ ...EMPTY_SUBMISSION, nextFollowUpDate: '2026-13-01' })).toBeNull()
  })

  it('creates a one-day event with a UTC timestamp and safely folded Unicode content', () => {
    const calendar = buildFollowUpCalendar({ ...EMPTY_SUBMISSION, nextFollowUpDate: '2028-02-29', channel: '商店'.repeat(60) + '\r\nBEGIN:VEVENT' }, new Date('2026-09-21T12:00:00Z'))!
    expect(calendar).toContain('DURATION:P1D')
    expect(calendar).toContain('DTSTAMP:20260921T120000Z')
    expect(calendar.split('\r\n').filter((line) => line === 'BEGIN:VEVENT')).toHaveLength(1)
    expect(calendar.split('\r\n').every((line) => new TextEncoder().encode(line).length <= 75)).toBe(true)
    expect(calendar.replace(/\r\n /g, '')).toContain('商店'.repeat(60) + '\\nBEGIN:VEVENT')
  })
})
