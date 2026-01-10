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
