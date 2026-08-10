export type ExtractedField = 'amount' | 'date' | 'reference' | 'remedy' | 'name'
export type ExtractionCandidate = {
  id: string
  field: ExtractedField
  value: string
  confidence: number
  sourceExcerpt: string
  start: number
  end: number
  status: 'unconfirmed' | 'confirmed' | 'rejected'
  confirmedValue: string | null
  reviewHistory?: Array<{ at: string; previousStatus: ExtractionCandidate['status']; previousValue: string | null; status: ExtractionCandidate['status']; value: string | null }>
}

export type EvidenceExtraction = {
  id: string
  evidenceId: string
  createdAt: string
  extractorVersion: 'plain-text-v1'
  candidates: ExtractionCandidate[]
}

export function isValidEvidenceExtraction(value: unknown): value is EvidenceExtraction {
  if (!value || typeof value !== 'object') return false
  const extraction = value as Partial<EvidenceExtraction>
  return typeof extraction.id === 'string' && extraction.id.length > 0 && typeof extraction.evidenceId === 'string' && extraction.evidenceId.length > 0 && typeof extraction.createdAt === 'string' && isIsoTimestamp(extraction.createdAt) && extraction.extractorVersion === 'plain-text-v1' && Array.isArray(extraction.candidates) && extraction.candidates.every(isValidCandidate)
}

function candidate(field: ExtractedField, value: string, confidence: number, text: string, start: number, end: number): ExtractionCandidate {
  return {
    id: crypto.randomUUID(), field, value, confidence,
    sourceExcerpt: text.slice(Math.max(0, start - 24), Math.min(text.length, end + 24)).replace(/\s+/g, ' ').trim(),
    start, end, status: 'unconfirmed', confirmedValue: null,
  }
}

export function extractCandidateFacts(text: string): ExtractionCandidate[] {
  const results: ExtractionCandidate[] = []
  const seen = new Set<string>()
  const add = (item: ExtractionCandidate) => { const key = `${item.field}:${item.value}`; if (!seen.has(key)) { seen.add(key); results.push(item) } }

  for (const match of text.matchAll(/\bRM\s*([0-9][0-9,]*(?:\.\d{1,2})?)\b/gi)) {
    const raw = match[1].replaceAll(',', '')
    add(candidate('amount', Number(raw).toFixed(2), 0.92, text, match.index, match.index + match[0].length))
  }
  for (const match of text.matchAll(/\b(20\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b/g)) {
    add(candidate('date', `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`, 0.88, text, match.index, match.index + match[0].length))
  }
  for (const match of text.matchAll(/\b(0?[1-9]|[12]\d|3[01])[/.](0?[1-9]|1[0-2])[/.](20\d{2})\b/g)) {
    add(candidate('date', `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`, 0.76, text, match.index, match.index + match[0].length))
  }
  for (const match of text.matchAll(/\b(?:order|invoice|reference|ref)\s*(?:number|no\.?|#|:)\s*([A-Z0-9][A-Z0-9-]{3,})\b/gi)) {
    add(candidate('reference', match[1], 0.86, text, match.index, match.index + match[0].length))
  }
  for (const match of text.matchAll(/\b(?:request(?:ed)?|seek(?:ing)?|remedy|want|ask(?:ed)?)\s+(?:for\s+)?(?:a\s+)?(refund|replacement|repair|delivery|cancellation)\b/gi)) {
    add(candidate('remedy', match[1].toLowerCase(), 0.82, text, match.index, match.index + match[0].length))
  }
  for (const match of text.matchAll(/\b(?:customer|buyer|consumer)\s+name\s*[:-]\s*([A-Za-z][A-Za-z '-]{1,79}?)(?=[.!?](?:\s|$)|$)/gi)) {
    add(candidate('name', match[1].trim(), 0.78, text, match.index, match.index + match[0].length))
  }
  return results
}

export function createEvidenceExtraction(evidenceId: string, text: string, now = new Date()): EvidenceExtraction {
  return { id: crypto.randomUUID(), evidenceId, createdAt: now.toISOString(), extractorVersion: 'plain-text-v1', candidates: extractCandidateFacts(text) }
}

export function reviewCandidate(candidateValue: ExtractionCandidate, status: ExtractionCandidate['status'], correctedValue?: string, now = new Date()): ExtractionCandidate {
  const confirmedValue = status === 'confirmed' ? (correctedValue === undefined ? candidateValue.value : correctedValue.trim()) : null
  if (confirmedValue !== null && !isValidCandidateValue(candidateValue.field, confirmedValue)) throw new Error('Invalid candidate value.')
  return { ...candidateValue, status, confirmedValue, reviewHistory: [...(candidateValue.reviewHistory ?? []), { at: now.toISOString(), previousStatus: candidateValue.status, previousValue: candidateValue.confirmedValue, status, value: confirmedValue }] }
}

export function isValidCandidateValue(field: ExtractedField, value: string): boolean {
  if (!value.trim()) return false
  if (field === 'amount') return /^\d+(?:\.\d{1,2})?$/.test(value) && Number.isFinite(Number(value))
  if (field === 'date') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
    const date = new Date(`${value}T00:00:00Z`)
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  }
  if (field === 'remedy') return ['delivery', 'replacement', 'repair', 'cancellation', 'refund'].includes(value.toLowerCase())
  if (field === 'name') return value.length <= 80 && /^[A-Za-z][A-Za-z .'-]*$/.test(value)
  return value.length <= 200 && !Array.from(value).some((character) => character.charCodeAt(0) < 32)
}

function isValidCandidate(value: unknown): value is ExtractionCandidate {
  if (!value || typeof value !== 'object') return false
  const candidateValue = value as Partial<ExtractionCandidate>
  if (typeof candidateValue.id !== 'string' || !candidateValue.id || typeof candidateValue.field !== 'string' || !['amount', 'date', 'reference', 'remedy', 'name'].includes(candidateValue.field) || typeof candidateValue.value !== 'string' || typeof candidateValue.confidence !== 'number' || !Number.isFinite(candidateValue.confidence) || candidateValue.confidence < 0 || candidateValue.confidence > 1 || typeof candidateValue.sourceExcerpt !== 'string' || typeof candidateValue.start !== 'number' || !Number.isInteger(candidateValue.start) || candidateValue.start < 0 || typeof candidateValue.end !== 'number' || !Number.isInteger(candidateValue.end) || candidateValue.end < candidateValue.start || !['unconfirmed', 'confirmed', 'rejected'].includes(candidateValue.status as string) || (candidateValue.confirmedValue !== null && typeof candidateValue.confirmedValue !== 'string')) return false
  const confirmedValid = candidateValue.confirmedValue === null || candidateValue.status !== 'confirmed' || isValidCandidateValue(candidateValue.field as ExtractedField, candidateValue.confirmedValue)
  return confirmedValid && (!candidateValue.reviewHistory || (Array.isArray(candidateValue.reviewHistory) && candidateValue.reviewHistory.every(isValidReview)))
}

function isValidReview(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const review = value as { at?: unknown; previousStatus?: unknown; previousValue?: unknown; status?: unknown; value?: unknown }
  return typeof review.at === 'string' && isIsoTimestamp(review.at) && ['unconfirmed', 'confirmed', 'rejected'].includes(review.previousStatus as string) && (review.previousValue === null || typeof review.previousValue === 'string') && ['unconfirmed', 'confirmed', 'rejected'].includes(review.status as string) && (review.value === null || typeof review.value === 'string')
}

function isIsoTimestamp(value: string): boolean {
  try { return new Date(value).toISOString() === value } catch { return false }
}
