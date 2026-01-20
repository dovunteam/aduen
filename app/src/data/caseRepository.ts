import { createCaseRecord, EMPTY_DRAFT, transitionCase } from '../domain/case'
import type { CaseDraft, CaseRecord, CaseRecordStatus } from '../domain/case'

const CASE_KEY = 'buktiva.case-record.v1'
const LEGACY_DRAFT_KEY = 'buktiva.case-draft.v1'
const TUNTIVA_CASE_KEY = 'tuntiva.case-record.v1'
const TUNTIVA_DRAFT_KEY = 'tuntiva.case-draft.v1'

export function readCase(): CaseRecord | null {
  try {
    const current = localStorage.getItem(CASE_KEY)
    if (current) {
      const parsed = JSON.parse(current) as CaseRecord
      return { ...parsed, draft: { ...EMPTY_DRAFT, ...parsed.draft } }
    }
    const oldRecord = localStorage.getItem(TUNTIVA_CASE_KEY)
    if (oldRecord) {
      const parsed = JSON.parse(oldRecord) as CaseRecord
      const migrated = { ...parsed, draft: { ...EMPTY_DRAFT, ...parsed.draft } }
      localStorage.setItem(CASE_KEY, JSON.stringify(migrated)); localStorage.removeItem(TUNTIVA_CASE_KEY)
      return migrated
    }
    const legacy = localStorage.getItem(LEGACY_DRAFT_KEY) ?? localStorage.getItem(TUNTIVA_DRAFT_KEY)
    if (!legacy) return null
    const migrated = createCaseRecord({ ...EMPTY_DRAFT, ...JSON.parse(legacy) })
    localStorage.setItem(CASE_KEY, JSON.stringify(migrated)); localStorage.removeItem(LEGACY_DRAFT_KEY); localStorage.removeItem(TUNTIVA_DRAFT_KEY)
    return migrated
  } catch { return null }
}

export function saveCaseDraft(draft: CaseDraft): CaseRecord {
  const current = readCase() ?? createCaseRecord(draft)
  const saved = { ...current, draft, updatedAt: new Date().toISOString() }
  localStorage.setItem(CASE_KEY, JSON.stringify(saved))
  return saved
}

export function recordCaseTransition(draft: CaseDraft, status: CaseRecordStatus, action: string): CaseRecord {
  const current = saveCaseDraft(draft)
  if (current.status === status && current.history.at(-1)?.action === action) return current
  const saved = transitionCase(current, status, action)
  localStorage.setItem(CASE_KEY, JSON.stringify(saved))
  return saved
}

export function clearCase(): void { localStorage.removeItem(CASE_KEY); localStorage.removeItem(LEGACY_DRAFT_KEY); localStorage.removeItem(TUNTIVA_CASE_KEY); localStorage.removeItem(TUNTIVA_DRAFT_KEY) }
