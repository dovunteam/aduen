import { createCaseRecord, EMPTY_DRAFT, transitionCase } from '../domain/case'
import type { CaseDraft, CaseRecord, CaseRecordStatus } from '../domain/case'
import { recordAuditEvent } from './auditRepository'

const CASE_KEY = 'Aduen.case-record.v1'
const LEGACY_DRAFT_KEY = 'Aduen.case-draft.v1'
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
      const migrated = normaliseLegacyCaseRecord(JSON.parse(oldRecord))
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
  if (!isCaseDraft(draft)) throw new Error('Invalid case draft.')
  const existing = readCase()
  const current = existing ?? createCaseRecord(draft)
  const changed = JSON.stringify(current.draft) !== JSON.stringify(draft)
  // A changed intake must be reviewed again; historical packs remain immutable.
  const reviewed = changed && current.status !== 'draft'
    ? transitionCase(current, 'draft', 'case_details_changed') : current
  const saved = { ...reviewed, draft, updatedAt: new Date().toISOString() }
  localStorage.setItem(CASE_KEY, JSON.stringify(saved))
  if (!existing) recordAuditEvent('case_created', saved.id, 'case record created')
  else if (changed) recordAuditEvent('case_edited', saved.id, 'case draft fields changed')
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

function normaliseLegacyCaseRecord(value: unknown): CaseRecord | null {
  if (!value || typeof value !== 'object') return null
  const parsed = value as Partial<CaseRecord>
  const history = Array.isArray(parsed.history) && parsed.history.length > 0
    ? parsed.history
    : typeof parsed.createdAt === 'string' && CASE_STATUSES.includes(parsed.status as CaseRecordStatus)
      ? [{ at: parsed.createdAt, actor: 'system' as const, action: 'case_created', status: parsed.status as CaseRecordStatus }]
      : []
  return normaliseCaseRecord({ ...parsed, history })
}

function isCaseRecord(value: CaseRecord): boolean {
  return isBoundedText(value.id, 100, true) && typeof value.createdAt === 'string' && typeof value.updatedAt === 'string' && isIsoTimestamp(value.createdAt) && isIsoTimestamp(value.updatedAt) && CASE_STATUSES.includes(value.status) && isCaseDraft(value.draft) && Array.isArray(value.history) && value.history.length > 0 && value.history.every((event) => isIsoTimestamp(event.at) && (event.actor === 'user' || event.actor === 'system') && isBoundedText(event.action, 160, true) && CASE_STATUSES.includes(event.status))
}

function isCaseDraft(value: CaseDraft): boolean {
  const strings = ['consumerName', 'seller', 'platform', 'purchaseDate', 'amount', 'paymentMethod', 'orderReference', 'remedyAmount', 'promisedDate', 'contactDate'] as const
  const textFields = ['consumerName', 'seller', 'platform', 'paymentMethod', 'orderReference'] as const
  return strings.every((key) => typeof value[key] === 'string') && textFields.every((key) => isBoundedText(value[key], 500)) && (Object.keys(ENUM_FIELDS) as Array<keyof typeof ENUM_FIELDS>).every((key) => ENUM_FIELDS[key].includes(value[key] as never)) && isDateOnlyOrEmpty(value.purchaseDate) && isDateOnlyOrEmpty(value.promisedDate) && isDateOnlyOrEmpty(value.contactDate) && isNonNegativeAmountOrEmpty(value.amount) && isNonNegativeAmountOrEmpty(value.remedyAmount)
}

function isBoundedText(value: unknown, maxLength: number, requireNonEmpty = false): value is string {
  return typeof value === 'string' && value.length <= maxLength && (!requireNonEmpty || value.length > 0) && !Array.from(value).some((character) => {
    const code = character.charCodeAt(0)
    return code <= 31 || code === 127
  })
}

function isDateOnlyOrEmpty(value: string): boolean {
  if (!value) return true
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function isNonNegativeAmountOrEmpty(value: string): boolean {
  if (!value) return true
  return /^\d+(?:\.\d{1,2})?$/.test(value) && Number.isFinite(Number(value))
}

function isIsoTimestamp(value: string): boolean {
  try { return new Date(value).toISOString() === value } catch { return false }
}
