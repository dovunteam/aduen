export type LocalAuditEvent = {
  id: string
  at: string
  action: 'consent_accepted' | 'case_created' | 'case_edited' | 'case_recovered' | 'submission_edited' | 'derived_fact_reviewed' | 'request_copied' | 'pack_viewed' | 'pack_approved' | 'evidence_added' | 'evidence_inclusion_changed' | 'evidence_previewed' | 'evidence_downloaded' | 'redacted_copy_exported' | 'evidence_deleted' | 'case_transitioned' | 'case_exported' | 'pack_exported' | 'handoff_exported' | 'review_brief_exported' | 'operator_review_recorded' | 'follow_up_exported' | 'retention_updated'
  targetId: string
  detail: string
}

const STORAGE_KEY = 'Aduen.audit-log.v1'
const ACTIONS: LocalAuditEvent['action'][] = ['consent_accepted', 'case_created', 'case_edited', 'case_recovered', 'submission_edited', 'derived_fact_reviewed', 'request_copied', 'pack_viewed', 'pack_approved', 'evidence_added', 'evidence_inclusion_changed', 'evidence_previewed', 'evidence_downloaded', 'redacted_copy_exported', 'evidence_deleted', 'case_transitioned', 'case_exported', 'pack_exported', 'handoff_exported', 'review_brief_exported', 'operator_review_recorded', 'follow_up_exported', 'retention_updated']

export function listAuditEvents(): LocalAuditEvent[] {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    if (!value) return []
    const events = JSON.parse(value) as unknown
    return Array.isArray(events) ? events.filter(isAuditEvent) : []
  } catch { return [] }
}

export function recordAuditEvent(action: LocalAuditEvent['action'], targetId: string, detail: string, now = new Date()): LocalAuditEvent {
  const event = createAuditEvent(action, targetId, detail, now)
  persistAuditEvent(event)
  return event
}

export function createAuditEvent(action: LocalAuditEvent['action'], targetId: string, detail: string, now = new Date()): LocalAuditEvent {
  return { id: crypto.randomUUID(), at: now.toISOString(), action, targetId, detail: sanitiseDetail(detail) }
}

export function persistAuditEvent(event: LocalAuditEvent): void {
  const events = [...listAuditEvents(), event].slice(-500)
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(events)) } catch { /* Audit persistence is best-effort when storage is unavailable. */ }
}

export function clearAuditEvents(): void {
  localStorage.removeItem(STORAGE_KEY)
}

function isAuditEvent(value: unknown): value is LocalAuditEvent {
  if (!value || typeof value !== 'object') return false
  const event = value as Partial<LocalAuditEvent>
  return typeof event.id === 'string' && event.id.length > 0 && event.id.length <= 100 && isIsoTimestamp(event.at) && isBoundedText(event.targetId, 160) && isBoundedText(event.detail, 240) && typeof event.action === 'string' && ACTIONS.includes(event.action as LocalAuditEvent['action'])
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try { return new Date(value).toISOString() === value } catch { return false }
}

function sanitiseDetail(value: string): string {
  const withoutControls = Array.from(value, (character) => { const code = character.charCodeAt(0); return code <= 31 || code === 127 ? ' ' : character }).join('')
  return withoutControls.replace(/\s+/g, ' ').trim().slice(0, 240)
}

function isBoundedText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length <= maxLength && !Array.from(value).some((character) => { const code = character.charCodeAt(0); return code <= 31 || code === 127 })
}
