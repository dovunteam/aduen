export type CaseDraft = {
  consumerName: string
  consumerLocation: 'malaysia' | 'outside' | ''
  seller: string
  sellerLocation: 'malaysia' | 'outside' | 'unknown' | ''
  platform: string
  purchaseDate: string
  amount: string
  currency: 'MYR'
  paymentMethod: string
  orderReference: string
  purpose: 'personal' | 'business' | ''
  issue: 'non_delivery' | 'mismatch' | 'missing_refund' | 'cancellation' | 'uncertain' | ''
  category: 'general_goods' | 'general_services' | 'aviation' | 'financial_service' | 'healthcare' | 'professional_service' | 'land' | 'other' | ''
  remedy: 'delivery' | 'replacement' | 'repair' | 'cancellation' | 'refund' | ''
  remedyAmount: string
  promisedDate: string
  contactHistory: 'none' | 'contacted' | 'responded' | ''
  contactDate: string
}

export const EMPTY_DRAFT: CaseDraft = {
  consumerName: '', consumerLocation: '', seller: '', sellerLocation: '', platform: '', purchaseDate: '', amount: '', currency: 'MYR', paymentMethod: '', orderReference: '',
  purpose: '', issue: '', category: '', remedy: '', remedyAmount: '', promisedDate: '', contactHistory: '', contactDate: '',
}

export type CaseRecordStatus = 'draft' | 'out_of_scope' | 'evidence_collection' | 'review' | 'ready_for_pack' | 'approved' | 'handed_off' | 'awaiting_response' | 'resolved' | 'closed'
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
