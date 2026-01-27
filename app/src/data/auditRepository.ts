export type LocalAuditEvent = {
  id: string
  at: string
  action: 'evidence_previewed' | 'evidence_downloaded' | 'redacted_copy_exported' | 'evidence_deleted' | 'case_exported' | 'handoff_exported'
  targetId: string
  detail: string
}

const STORAGE_KEY = 'buktiva.audit-log.v1'

export function listAuditEvents(): LocalAuditEvent[] {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    if (!value) return []
    const events = JSON.parse(value) as LocalAuditEvent[]
    return Array.isArray(events) ? events : []
  } catch { return [] }
}

export function recordAuditEvent(action: LocalAuditEvent['action'], targetId: string, detail: string, now = new Date()): LocalAuditEvent {
  const event: LocalAuditEvent = { id: crypto.randomUUID(), at: now.toISOString(), action, targetId, detail }
  const events = [...listAuditEvents(), event].slice(-500)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
  return event
}

export function clearAuditEvents(): void {
  localStorage.removeItem(STORAGE_KEY)
}
