export type ExtractedField = 'amount' | 'date' | 'reference' | 'remedy' | 'name'
export type ExtractedDateRole = 'purchase' | 'promised' | 'delivery' | 'contact' | 'unclassified'
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
  dateRole?: ExtractedDateRole
  reviewHistory?: Array<{ at: string; previousStatus: ExtractionCandidate['status']; previousValue: string | null; status: ExtractionCandidate['status']; value: string | null }>
}

export type EvidenceExtraction = {
  id: string
  evidenceId: string
  createdAt: string
  extractorVersion: 'plain-text-v1' | 'plain-text-v2' | 'plain-text-v3' | 'plain-text-v4' | 'pdf-text-v1'
  candidates: ExtractionCandidate[]
}

export function isValidEvidenceExtraction(value: unknown): value is EvidenceExtraction {
  if (!value || typeof value !== 'object') return false
  const extraction = value as Partial<EvidenceExtraction>
  return typeof extraction.id === 'string' && extraction.id.length > 0 && typeof extraction.evidenceId === 'string' && extraction.evidenceId.length > 0 && typeof extraction.createdAt === 'string' && isIsoTimestamp(extraction.createdAt) && ['plain-text-v1', 'plain-text-v2', 'plain-text-v3', 'plain-text-v4', 'pdf-text-v1'].includes(extraction.extractorVersion as string) && Array.isArray(extraction.candidates) && extraction.candidates.every(isValidCandidate)
}

function candidate(field: ExtractedField, value: string, confidence: number, text: string, start: number, end: number, dateRole?: ExtractionCandidate['dateRole']): ExtractionCandidate {
  return {
    id: crypto.randomUUID(), field, value, confidence,
    sourceExcerpt: text.slice(Math.max(0, start - 24), Math.min(text.length, end + 24)).replace(/\s+/g, ' ').trim(),
    start, end, status: 'unconfirmed', confirmedValue: null,
    ...(field === 'date' ? { dateRole: dateRole ?? 'unclassified' } : {}),
  }
}

function classifyDate(text: string, start: number): NonNullable<ExtractionCandidate['dateRole']> {
  const context = text.slice(Math.max(0, start - 60), start).trimEnd()
  const labelSuffix = String.raw`\s*(?:(?:is|on|pada|:)\s*)?$`
  if (new RegExp(String.raw`(?:purchase\s+date|date\s+of\s+purchase|order\s+date|transaction\s+date|purchased(?:\s+on)?|tarikh\s+(?:pembelian|pesanan|transaksi))${labelSuffix}`, 'i').test(context)) return 'purchase'
  if (new RegExp(String.raw`(?:promised\s+(?:(?:delivery|performance)\s+)?date|delivery\s+(?:was\s+)?promised(?:\s+for)?|tarikh\s+(?:penghantaran|prestasi)\s+yang\s+dijanjikan)${labelSuffix}`, 'i').test(context)) return 'promised'
  if (new RegExp(String.raw`(?:delivery\s+date|date\s+of\s+delivery|delivered(?:\s+on)?|received(?:\s+on)?|tarikh\s+penghantaran|diterima(?:\s+pada)?)${labelSuffix}`, 'i').test(context)) return 'delivery'
  if (new RegExp(String.raw`(?:merchant\s+contact\s+date|contact\s+date|date\s+of\s+contact|complaint\s+date|date\s+of\s+complaint|contacted(?:\s+on)?|complained(?:\s+on)?|tarikh\s+(?:hubungan|aduan|menghubungi))${labelSuffix}`, 'i').test(context)) return 'contact'
  return 'unclassified'
}

export function extractCandidateFacts(text: string): ExtractionCandidate[] {
  const results: ExtractionCandidate[] = []
  const seen = new Set<string>()
  const add = (item: ExtractionCandidate) => { const key = `${item.field}:${item.value}`; if (!seen.has(key)) { seen.add(key); results.push(item) } }

  for (const match of text.matchAll(/\b(?:RM|MYR)\s*([0-9][0-9,]*(?:\.\d{1,2})?)\b/gi)) {
    const raw = match[1].replaceAll(',', '')
    add(candidate('amount', Number(raw).toFixed(2), 0.92, text, match.index, match.index + match[0].length))
  }
  const addDate = (value: string, confidence: number, match: RegExpMatchArray) => {
    if (match.index !== undefined && isValidCandidateValue('date', value)) add(candidate('date', value, confidence, text, match.index, match.index + match[0].length, classifyDate(text, match.index)))
  }
  for (const match of text.matchAll(/\b(20\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b/g)) {
    addDate(`${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`, 0.88, match)
  }
  for (const match of text.matchAll(/\b(0?[1-9]|[12]\d|3[01])[/.](0?[1-9]|1[0-2])[/.](20\d{2})\b/g)) {
    addDate(`${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`, 0.76, match)
  }
  const monthNumbers: Record<string, string> = { jan: '01', january: '01', januari: '01', feb: '02', february: '02', februari: '02', mar: '03', march: '03', mac: '03', apr: '04', april: '04', may: '05', mei: '05', jun: '06', june: '06', jul: '07', july: '07', julai: '07', aug: '08', august: '08', ogos: '08', sep: '09', sept: '09', september: '09', oct: '10', october: '10', oktober: '10', nov: '11', november: '11', dec: '12', december: '12', disember: '12' }
  for (const match of text.matchAll(/\b(0?[1-9]|[12]\d|3[01])\s+(Jan(?:uary|uari)?|Feb(?:ruary|ruari)?|Mar(?:ch)?|Mac|Apr(?:il)?|May|Mei|Jun(?:e)?|Jul(?:y|ai)?|Aug(?:ust)?|Ogos|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Oktober|Nov(?:ember)?|Dec(?:ember)?|Disember)\s+(20\d{2})\b/gi)) {
    const month = monthNumbers[match[2].toLowerCase()]
    addDate(`${match[3]}-${month}-${match[1].padStart(2, '0')}`, 0.78, match)
  }
  for (const match of text.matchAll(/\b(?:order|invoice|reference|ref)\s*(?:number|no\.?|#|:)\s*([A-Z0-9][A-Z0-9-]{3,})\b/gi)) {
    add(candidate('reference', match[1], 0.86, text, match.index, match.index + match[0].length))
  }
  for (const match of text.matchAll(/\b(?:nombor\s+(?:pesanan|invois|rujukan)|no\.?\s+rujukan|rujukan)\s*(?:no\.?|#|:)?\s*([A-Z0-9][A-Z0-9-]{3,})\b/gi)) {
    add(candidate('reference', match[1], 0.82, text, match.index, match.index + match[0].length))
  }
  for (const match of text.matchAll(/\b(?:request(?:ed)?|seek(?:ing)?|remedy|want|ask(?:ed)?)\s+(?:for\s+)?(?:a\s+)?(refund|replacement|repair|delivery|cancellation)\b/gi)) {
    add(candidate('remedy', match[1].toLowerCase(), 0.82, text, match.index, match.index + match[0].length))
  }
  const malayRemedies: Record<string, string> = { 'bayaran balik': 'refund', 'bayaran semula': 'refund', penggantian: 'replacement', pembaikan: 'repair', penghantaran: 'delivery', pembatalan: 'cancellation' }
  for (const match of text.matchAll(/\b(?:memohon|meminta|minta|mahukan|penyelesaian\s+diminta)\s+(bayaran\s+balik|bayaran\s+semula|penggantian|pembaikan|penghantaran|pembatalan)\b/gi)) {
    add(candidate('remedy', malayRemedies[match[1].toLowerCase()], 0.8, text, match.index, match.index + match[0].length))
  }
  for (const match of text.matchAll(/\b(?:customer|buyer|consumer)\s+name\s*[:-]\s*(\p{L}[\p{L}\p{M} .’'-]{1,79}?)(?=[.!?](?:\s|$)|$)/giu)) {
    add(candidate('name', match[1].trim(), 0.78, text, match.index, match.index + match[0].length))
  }
  for (const match of text.matchAll(/\bnama\s+(?:pelanggan|pembeli|pengguna)\s*[:-]\s*(\p{L}[\p{L}\p{M} .’'-]{1,79}?)(?=[.!?](?:\s|$)|$)/giu)) {
    add(candidate('name', match[1].trim(), 0.78, text, match.index, match.index + match[0].length))
  }
  return results
}

export function createEvidenceExtraction(evidenceId: string, text: string, now = new Date(), extractorVersion: EvidenceExtraction['extractorVersion'] = 'plain-text-v4'): EvidenceExtraction {
  return { id: crypto.randomUUID(), evidenceId, createdAt: now.toISOString(), extractorVersion, candidates: extractCandidateFacts(text) }
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
  if (field === 'name') return value.length <= 80 && /^\p{L}[\p{L}\p{M} .’'-]*$/u.test(value)
  return value.length <= 200 && !Array.from(value).some((character) => character.charCodeAt(0) < 32)
}

function isValidCandidate(value: unknown): value is ExtractionCandidate {
  if (!value || typeof value !== 'object') return false
  const candidateValue = value as Partial<ExtractionCandidate>
  if (typeof candidateValue.id !== 'string' || !candidateValue.id || typeof candidateValue.field !== 'string' || !['amount', 'date', 'reference', 'remedy', 'name'].includes(candidateValue.field) || typeof candidateValue.value !== 'string' || typeof candidateValue.confidence !== 'number' || !Number.isFinite(candidateValue.confidence) || candidateValue.confidence < 0 || candidateValue.confidence > 1 || typeof candidateValue.sourceExcerpt !== 'string' || typeof candidateValue.start !== 'number' || !Number.isInteger(candidateValue.start) || candidateValue.start < 0 || typeof candidateValue.end !== 'number' || !Number.isInteger(candidateValue.end) || candidateValue.end < candidateValue.start || !['unconfirmed', 'confirmed', 'rejected'].includes(candidateValue.status as string) || (candidateValue.confirmedValue !== null && typeof candidateValue.confirmedValue !== 'string')) return false
  if (candidateValue.dateRole !== undefined && (candidateValue.field !== 'date' || !['purchase', 'promised', 'delivery', 'contact', 'unclassified'].includes(candidateValue.dateRole))) return false
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
