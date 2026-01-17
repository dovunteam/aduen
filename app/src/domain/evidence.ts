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

export function validateEvidenceSignature(mimeType: string, bytes: Uint8Array): string | null {
  const startsWith = (...signature: number[]) => signature.every((value, index) => bytes[index] === value)
  const valid = mimeType === 'application/pdf' ? startsWith(0x25, 0x50, 0x44, 0x46, 0x2d)
    : mimeType === 'image/png' ? startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
      : mimeType === 'image/jpeg' ? startsWith(0xff, 0xd8, 0xff)
        : mimeType === 'image/webp' ? startsWith(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
          : mimeType === 'text/plain' ? !bytes.some((value) => value === 0)
            : false
  return valid ? null : 'The file contents do not match the selected file type.'
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
