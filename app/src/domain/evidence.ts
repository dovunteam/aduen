export const EVIDENCE_TYPES = [
  'receipt',
  'listing',
  'payment',
  'delivery',
  'message',
  'merchant_response',
  'other',
] as const

export type EvidenceType = typeof EVIDENCE_TYPES[number]

export type EvidenceMetadata = {
  id: string
  fileName: string
  mimeType: string
  size: number
  sha256: string
  sourceType: EvidenceType
  eventDate: string | null
  description: string
  includeInPack: boolean
  uploadedAt: string
}

export type EvidenceInput = Pick<EvidenceMetadata, 'sourceType' | 'eventDate' | 'description'>

export const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024
export const ACCEPTED_EVIDENCE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
] as const

export function validateEvidenceFile(file: Pick<File, 'size' | 'type'>): string | null {
  if (file.size === 0) return 'The selected file is empty.'
  if (file.size > MAX_EVIDENCE_BYTES) return 'The file is larger than the 10 MB prototype limit.'
  if (!ACCEPTED_EVIDENCE_TYPES.includes(file.type as typeof ACCEPTED_EVIDENCE_TYPES[number])) {
    return 'Use a PDF, JPG, PNG, WebP, or plain-text file.'
  }
  return null
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function evidenceTypeLabel(type: EvidenceType): string {
  return ({
    receipt: 'Receipt or order',
    listing: 'Listing or promise',
    payment: 'Payment record',
    delivery: 'Delivery record',
    message: 'Message or contact',
    merchant_response: 'Merchant response',
    other: 'Other evidence',
  } as const)[type]
}
