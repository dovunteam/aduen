import { createCaseRecord, EMPTY_DRAFT, transitionCase } from '../domain/case'
import type { CaseDraft, CaseRecord, CaseRecordStatus } from '../domain/case'
import { recordAuditEvent } from './auditRepository'

const CASE_KEY = 'buktiva.case-record.v1'
const LEGACY_DRAFT_KEY = 'buktiva.case-draft.v1'
const TUNTIVA_CASE_KEY = 'tuntiva.case-record.v1'
const TUNTIVA_DRAFT_KEY = 'tuntiva.case-draft.v1'
const CASE_STATUSES: CaseRecordStatus[] = ['draft', 'out_of_scope', 'evidence_collection', 'confirmation', 'review', 'ready_for_pack', 'approved', 'handed_off', 'awaiting_response', 'resolved', 'closed']
const ENUM_FIELDS = {
  consumerLocation: ['', 'malaysia', 'outside'], sellerLocation: ['', 'malaysia', 'outside', 'unknown'], currency: ['MYR'],
  purpose: ['', 'personal', 'business'], issue: ['', 'non_delivery', 'mismatch', 'missing_refund', 'cancellation', 'uncertain'],
  category: ['', 'general_goods', 'general_services', 'aviation', 'financial_service', 'healthcare', 'professional_service', 'land', 'other'],
  remedy: ['', 'delivery', 'replacement', 'repair', 'cancellation', 'refund'], contactHistory: ['', 'none', 'contacted', 'responded'],
} as const

export function readCase(): CaseRecord | null {
  try {
    const current = localStorage.getItem(CASE_KEY)
    if (current) {
      return normaliseCaseRecord(JSON.parse(current))
    }
    const oldRecord = localStorage.getItem(TUNTIVA_CASE_KEY)
    if (oldRecord) {
      const migrated = normaliseCaseRecord(JSON.parse(oldRecord))
      if (!migrated) return null
      localStorage.setItem(CASE_KEY, JSON.stringify(migrated)); localStorage.removeItem(TUNTIVA_CASE_KEY)
      return migrated
    }
    const legacy = localStorage.getItem(LEGACY_DRAFT_KEY) ?? localStorage.getItem(TUNTIVA_DRAFT_KEY)
    if (!legacy) return null
    const draft = { ...EMPTY_DRAFT, ...JSON.parse(legacy) }
    if (!isCaseDraft(draft)) return null
    const migrated = createCaseRecord(draft)
    localStorage.setItem(CASE_KEY, JSON.stringify(migrated)); localStorage.removeItem(LEGACY_DRAFT_KEY); localStorage.removeItem(TUNTIVA_DRAFT_KEY)
    return migrated
  } catch { return null }
}

export function saveCaseDraft(draft: CaseDraft): CaseRecord {
  const current = readCase() ?? createCaseRecord(draft)
  const changed = JSON.stringify(current.draft) !== JSON.stringify(draft)
  // A changed intake must be reviewed again; historical packs remain immutable.
  const reviewed = changed && current.status !== 'draft'
    ? transitionCase(current, 'draft', 'case_details_changed') : current
  const saved = { ...reviewed, draft, updatedAt: new Date().toISOString() }
  localStorage.setItem(CASE_KEY, JSON.stringify(saved))
  if (changed) recordAuditEvent('case_edited', saved.id, 'case draft fields changed')
  return saved
}

export function recordCaseTransition(draft: CaseDraft, status: CaseRecordStatus, action: string): CaseRecord {
  const current = saveCaseDraft(draft)
  if (current.status === status && current.history.at(-1)?.action === action) return current
  const saved = transitionCase(current, status, action)
  localStorage.setItem(CASE_KEY, JSON.stringify(saved))
  recordAuditEvent('case_transitioned', saved.id, `${status}: ${action}`)
  return saved
}

export function clearCase(): void { localStorage.removeItem(CASE_KEY); localStorage.removeItem(LEGACY_DRAFT_KEY); localStorage.removeItem(TUNTIVA_CASE_KEY); localStorage.removeItem(TUNTIVA_DRAFT_KEY) }

function normaliseCaseRecord(value: unknown): CaseRecord | null {
  if (!value || typeof value !== 'object') return null
  const parsed = value as Partial<CaseRecord>
  const candidate = { ...parsed, draft: { ...EMPTY_DRAFT, ...(parsed.draft ?? {}) } } as CaseRecord
  return isCaseRecord(candidate) ? candidate : null
}

function isCaseRecord(value: CaseRecord): boolean {
  return [value.id, value.createdAt, value.updatedAt].every((item) => typeof item === 'string') && CASE_STATUSES.includes(value.status) && isCaseDraft(value.draft) && Array.isArray(value.history) && value.history.every((event) => typeof event.at === 'string' && (event.actor === 'user' || event.actor === 'system') && typeof event.action === 'string' && CASE_STATUSES.includes(event.status))
}

function isCaseDraft(value: CaseDraft): boolean {
  const strings = ['consumerName', 'seller', 'platform', 'purchaseDate', 'amount', 'paymentMethod', 'orderReference', 'remedyAmount', 'promisedDate', 'contactDate'] as const
  return strings.every((key) => typeof value[key] === 'string') && (Object.keys(ENUM_FIELDS) as Array<keyof typeof ENUM_FIELDS>).every((key) => ENUM_FIELDS[key].includes(value[key] as never))
}
