export type CaseDraft = {
  seller: string
  platform: string
  purchaseDate: string
  amount: string
  paymentMethod: string
  orderReference: string
  purpose: 'personal' | 'business' | ''
  issue: 'non_delivery' | 'mismatch' | 'missing_refund' | 'cancellation' | 'uncertain' | ''
  remedy: 'delivery' | 'replacement' | 'repair' | 'cancellation' | 'refund' | ''
  remedyAmount: string
  promisedDate: string
  contactHistory: 'none' | 'contacted' | 'responded' | ''
  contactDate: string
}

export const EMPTY_DRAFT: CaseDraft = {
  seller: '', platform: '', purchaseDate: '', amount: '', paymentMethod: '', orderReference: '',
  purpose: '', issue: '', remedy: '', remedyAmount: '', promisedDate: '', contactHistory: '', contactDate: '',
}

export type CaseRecordStatus = 'draft' | 'evidence_collection' | 'review' | 'ready_for_pack' | 'approved' | 'handed_off' | 'awaiting_response' | 'resolved' | 'closed'
export type CaseAuditEvent = { at: string; actor: 'user' | 'system'; action: string; status: CaseRecordStatus }
export type CaseRecord = { id: string; createdAt: string; updatedAt: string; status: CaseRecordStatus; draft: CaseDraft; history: CaseAuditEvent[] }

export function createCaseRecord(draft: CaseDraft, now = new Date()): CaseRecord {
  const timestamp = now.toISOString()
  return { id: crypto.randomUUID(), createdAt: timestamp, updatedAt: timestamp, status: 'draft', draft, history: [{ at: timestamp, actor: 'system', action: 'case_created', status: 'draft' }] }
}

export function transitionCase(record: CaseRecord, status: CaseRecordStatus, action: string, now = new Date()): CaseRecord {
  const timestamp = now.toISOString()
  return { ...record, status, updatedAt: timestamp, history: [...record.history, { at: timestamp, actor: 'user', action, status }] }
}
