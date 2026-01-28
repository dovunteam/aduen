export type LocalAuditEvent = {
  id: string
  at: string
  action: 'evidence_previewed' | 'evidence_downloaded' | 'redacted_copy_exported' | 'evidence_deleted' | 'case_transitioned' | 'case_exported' | 'pack_exported' | 'handoff_exported'
  targetId: string
  detail: string
}

const STORAGE_KEY = 'buktiva.audit-log.v1'
const ACTIONS: LocalAuditEvent['action'][] = ['evidence_previewed', 'evidence_downloaded', 'redacted_copy_exported', 'evidence_deleted', 'case_transitioned', 'case_exported', 'pack_exported', 'handoff_exported']

export function listAuditEvents(): LocalAuditEvent[] {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    if (!value) return []
    const events = JSON.parse(value) as unknown
    return Array.isArray(events) ? events.filter(isAuditEvent) : []
  } catch { return [] }
}

export function recordAuditEvent(action: LocalAuditEvent['action'], targetId: string, detail: string, now = new Date()): LocalAuditEvent {
  const event: LocalAuditEvent = { id: crypto.randomUUID(), at: now.toISOString(), action, targetId, detail }
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
  return typeof event.id === 'string' && typeof event.at === 'string' && typeof event.targetId === 'string' && typeof event.detail === 'string' && typeof event.action === 'string' && ACTIONS.includes(event.action as LocalAuditEvent['action'])
}
