import type { SubmissionRecord } from '../domain/status'
import { recordAuditEvent } from './auditRepository'

export function buildFollowUpCalendar(record: SubmissionRecord, now = new Date()): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(record.nextFollowUpDate)) return null
  const parsed = new Date(`${record.nextFollowUpDate}T00:00:00Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== record.nextFollowUpDate) return null
  const date = record.nextFollowUpDate.replaceAll('-', '')
  const channel = record.channel.trim() || 'case'
  const reference = record.referenceNumber.trim() ? ` Reference: ${record.referenceNumber.trim()}.` : ''
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Buktiva//Follow-up//EN', 'BEGIN:VEVENT', `UID:${crypto.randomUUID()}@buktiva.local`, `DTSTAMP:${now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}`, `DTSTART;VALUE=DATE:${date}`, 'DURATION:P1D', `SUMMARY:${calendarText(`Buktiva follow-up: ${channel}`)}`, `DESCRIPTION:${calendarText(`Review your Buktiva case follow-up.${reference} This reminder is based on the follow-up date you entered, not an external deadline. Buktiva does not send notifications or submit anything for you.`)}`, 'END:VEVENT', 'END:VCALENDAR', ''].map(foldLine).join('\r\n')
}

export function downloadFollowUpCalendar(record: SubmissionRecord): boolean {
  const calendar = buildFollowUpCalendar(record)
  if (!calendar) return false
  const url = URL.createObjectURL(new Blob([calendar], { type: 'text/calendar;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `buktiva-follow-up-${record.nextFollowUpDate}.ics`
  anchor.click()
  recordAuditEvent('follow_up_exported', 'submission', 'follow-up calendar reminder exported')
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}

function calendarText(value: string): string {
  return value.replaceAll('\\', '\\\\').replace(/\r\n|\r|\n/g, '\\n').replaceAll(';', '\\;').replaceAll(',', '\\,')
}

// RFC 5545 content lines are folded at 75 UTF-8 octets, between characters.
function foldLine(value: string): string {
  const encoder = new TextEncoder()
  let result = '', length = 0
  for (const character of value) {
    const size = encoder.encode(character).length
    if (length + size > 75) { result += '\r\n '; length = 1 }
    result += character; length += size
  }
  return result
}
