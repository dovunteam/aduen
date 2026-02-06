export type LocalAuditEvent = {
  id: string
  at: string
  action: 'consent_accepted' | 'case_edited' | 'submission_edited' | 'derived_fact_reviewed' | 'request_copied' | 'pack_viewed' | 'pack_approved' | 'evidence_inclusion_changed' | 'evidence_previewed' | 'evidence_downloaded' | 'redacted_copy_exported' | 'evidence_deleted' | 'case_transitioned' | 'case_exported' | 'pack_exported' | 'handoff_exported' | 'follow_up_exported'
  targetId: string
  detail: string
}

const STORAGE_KEY = 'buktiva.audit-log.v1'
const ACTIONS: LocalAuditEvent['action'][] = ['consent_accepted', 'case_edited', 'submission_edited', 'derived_fact_reviewed', 'request_copied', 'pack_viewed', 'pack_approved', 'evidence_inclusion_changed', 'evidence_previewed', 'evidence_downloaded', 'redacted_copy_exported', 'evidence_deleted', 'case_transitioned', 'case_exported', 'pack_exported', 'handoff_exported', 'follow_up_exported']

export function listAuditEvents(): LocalAuditEvent[] {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    if (!value) return []
    const events = JSON.parse(value) as unknown
    return Array.isArray(events) ? events.filter(isAuditEvent) : []
  } catch { return [] }
}

export function recordAuditEvent(action: LocalAuditEvent['action'], targetId: string, detail: string, now = new Date()): LocalAuditEvent {
  const event: LocalAuditEvent = { id: crypto.randomUUID(), at: now.toISOString(), action, targetId, detail: sanitiseDetail(detail) }
  const events = [...listAuditEvents(), event].slice(-500)
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(events)) } catch { /* Audit persistence is best-effort when storage is unavailable. */ }
  return event
}

export function clearAuditEvents(): void {
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* There is nothing to clear when storage is unavailable. */ }
}

function isAuditEvent(value: unknown): value is LocalAuditEvent {
  if (!value || typeof value !== 'object') return false
  const event = value as Partial<LocalAuditEvent>
  return typeof event.id === 'string' && isIsoTimestamp(event.at) && typeof event.targetId === 'string' && typeof event.detail === 'string' && typeof event.action === 'string' && ACTIONS.includes(event.action as LocalAuditEvent['action'])
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try { return new Date(value).toISOString() === value } catch { return false }
}

function sanitiseDetail(value: string): string {
  const withoutControls = Array.from(value, (character) => { const code = character.charCodeAt(0); return code <= 31 || code === 127 ? ' ' : character }).join('')
  return withoutControls.replace(/\s+/g, ' ').trim().slice(0, 240)
}
