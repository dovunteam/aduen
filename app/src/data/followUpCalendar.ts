import type { SubmissionRecord } from '../domain/status'

export function buildFollowUpCalendar(record: SubmissionRecord): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(record.nextFollowUpDate)) return null
  const date = record.nextFollowUpDate.replaceAll('-', '')
  const channel = record.channel.trim() || 'case'
  const reference = record.referenceNumber.trim() ? ` Reference: ${record.referenceNumber.trim()}.` : ''
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Buktiva//Follow-up//EN', 'BEGIN:VEVENT', `UID:buktiva-follow-up-${date}-${calendarText(channel)}@local`, `DTSTART;VALUE=DATE:${date}`, `DTEND;VALUE=DATE:${date}`, `SUMMARY:${calendarText(`Buktiva follow-up: ${channel}`)}`, `DESCRIPTION:${calendarText(`Review your Buktiva case follow-up.${reference} Buktiva does not send notifications or submit anything for you.`)}`, 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n')
}

export function downloadFollowUpCalendar(record: SubmissionRecord): boolean {
  const calendar = buildFollowUpCalendar(record)
  if (!calendar) return false
  const url = URL.createObjectURL(new Blob([calendar], { type: 'text/calendar;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `buktiva-follow-up-${record.nextFollowUpDate}.ics`
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}

function calendarText(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll(';', '\\;').replaceAll(',', '\\,')
}
