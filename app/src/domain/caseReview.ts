import type { CaseDraft } from './case'
import type { EvidenceMetadata, EvidenceType } from './evidence'
import type { EvidenceExtraction } from './extraction'
import type { Locale } from '../i18n'

export type CheckItem = { id: string; level: 'required' | 'useful'; label: string; reason: string; source: string; satisfied: boolean }
export type TimelineItem = { id: string; date: string | null; label: string; detail: string; source: 'confirmed case detail' | 'user-described evidence' | 'confirmed extracted fact'; eventRole?: 'purchase' | 'promised' | 'delivery' | 'contact' | 'unclassified' }

const ISSUE_RULES: Partial<Record<CaseDraft['issue'], Array<{ type: EvidenceType; level: CheckItem['level']; label: string; reason: string }>>> = {
  non_delivery: [
    { type: 'listing', level: 'required', label: 'Promised delivery or performance', reason: 'Shows what the seller agreed to provide and when.' },
    { type: 'message', level: 'required', label: 'Seller contact', reason: 'Shows that a clear resolution request reached the seller.' },
    { type: 'delivery', level: 'useful', label: 'Delivery or tracking record', reason: 'Helps distinguish delay from non-performance.' },
  ],
  mismatch: [
    { type: 'listing', level: 'required', label: 'Original listing or specification', reason: 'Allows comparison with what was received.' },
    { type: 'other', level: 'required', label: 'Record of the item received', reason: 'Shows the material difference without relying on description alone.' },
    { type: 'message', level: 'useful', label: 'Seller contact', reason: 'Shows the attempted resolution.' },
  ],
  missing_refund: [
    { type: 'merchant_response', level: 'required', label: 'Refund promise or status', reason: 'Shows the amount or processing period the seller stated.' },
    { type: 'payment', level: 'required', label: 'Payment record showing non-receipt', reason: 'Supports that the promised refund has not arrived.' },
  ],
  cancellation: [
    { type: 'message', level: 'required', label: 'Cancellation request', reason: 'Shows when and how cancellation was requested.' },
    { type: 'payment', level: 'required', label: 'Payment or billing record', reason: 'Shows the charge being disputed.' },
  ],
}

export function checkCompleteness(draft: CaseDraft, evidence: EvidenceMetadata[]): CheckItem[] {
  const included = evidence.filter((item) => item.includeInPack)
  const has = (type: EvidenceType) => included.some((item) => item.sourceType === type)
  const checks: CheckItem[] = [
    { id: 'transaction', level: 'required', label: 'Order, receipt, or transaction record', reason: 'Identifies the seller and purchase.', source: 'Aduen MVP – supported cohort', satisfied: has('receipt') },
    { id: 'payment', level: 'required', label: 'Payment evidence', reason: 'Supports the amount and payment method.', source: 'Aduen workflow – evidence capture', satisfied: has('payment') },
    ...(ISSUE_RULES[draft.issue] ?? []).map((rule) => {
      const firstMerchantRequest = rule.type === 'message' && draft.contactHistory === 'none'
      return {
        ...rule,
        level: firstMerchantRequest ? 'useful' as const : rule.level,
        reason: firstMerchantRequest ? 'Not required before the first written request; add the sent request to the record afterward.' : rule.reason,
        id: `${draft.issue}-${rule.type}`,
        source: `Aduen workflow – ${draft.issue.replaceAll('_', ' ')} variant`,
        satisfied: has(rule.type),
      }
    }),
  ]
  if (draft.remedy === 'refund') checks.push({ id: 'refund-amount', level: 'required', label: 'Exact refund amount', reason: 'A monetary remedy needs one clear amount.', source: 'Aduen MVP – remedy statement', satisfied: Number(draft.remedyAmount) > 0 })
  return checks
}

export function buildTimeline(draft: CaseDraft, evidence: EvidenceMetadata[], extractions: EvidenceExtraction[] = []): TimelineItem[] {
  const items: TimelineItem[] = [
    { id: 'purchase', date: draft.purchaseDate || null, label: 'Purchase made', detail: `${draft.seller} · RM ${Number(draft.amount || 0).toFixed(2)}`, source: 'confirmed case detail' },
    ...(draft.promisedDate ? [{ id: 'promised', date: draft.promisedDate, label: 'Promised performance date', detail: 'Date recorded by the consumer', source: 'confirmed case detail' as const }] : []),
    ...(draft.contactHistory && draft.contactHistory !== 'none' ? [{ id: 'merchant-contact', date: draft.contactDate || null, label: 'Merchant contacted', detail: draft.contactHistory === 'responded' ? 'Merchant response recorded' : 'No response recorded', source: 'confirmed case detail' as const }] : []),
    ...evidence.map((item) => ({ id: item.id, date: item.eventDate, label: item.description || item.fileName, detail: item.sourceType.replaceAll('_', ' '), source: 'user-described evidence' as const })),
    ...extractions.flatMap((record) => {
      const item = evidence.find((entry) => entry.id === record.evidenceId)
      if (!item) return []
      return record.candidates.flatMap((candidate) => {
        if (candidate.field !== 'date' || candidate.status !== 'confirmed' || !candidate.confirmedValue) return []
        const eventRole = candidate.dateRole ?? 'unclassified'
        const labels: Record<string, string> = { purchase: 'Purchase date in evidence', promised: 'Promised performance date in evidence', delivery: 'Delivery date in evidence', contact: 'Merchant contact date in evidence', unclassified: 'Confirmed date in evidence' }
        return [{ id: candidate.id, date: candidate.confirmedValue, label: labels[eventRole] ?? labels.unclassified, detail: item.fileName, source: 'confirmed extracted fact' as const, eventRole }]
      })
    }),
  ]
  return items.sort((a, b) => {
    if (!a.date) return 1
    if (!b.date) return -1
    return a.date.localeCompare(b.date)
  })
}

export function timelineLabel(item: TimelineItem, locale: Locale): string {
  if (!item.eventRole) return item.label
  const labels = locale === 'ms'
    ? { purchase: 'Tarikh pembelian dalam bukti', promised: 'Tarikh prestasi dijanjikan dalam bukti', delivery: 'Tarikh penghantaran dalam bukti', contact: 'Tarikh hubungan dengan peniaga dalam bukti', unclassified: 'Tarikh disahkan dalam bukti' }
    : { purchase: 'Purchase date in evidence', promised: 'Promised performance date in evidence', delivery: 'Delivery date in evidence', contact: 'Merchant contact date in evidence', unclassified: 'Confirmed date in evidence' }
  return labels[item.eventRole] ?? labels.unclassified
}

export function timelineSource(source: TimelineItem['source'], locale: Locale): string {
  if (locale === 'ms') return ({ 'confirmed case detail': 'butiran kes disahkan', 'user-described evidence': 'bukti yang diterangkan pengguna', 'confirmed extracted fact': 'fakta daripada bukti yang disahkan pengguna' })[source]
  return source
}

export function timelineDetail(item: TimelineItem, locale: Locale): string {
  if (item.source !== 'confirmed extracted fact') return item.detail
  return `${locale === 'ms' ? 'Bukti' : 'Evidence'}: ${item.detail}`
}

export function findTimelineWarnings(draft: CaseDraft, timeline: TimelineItem[]): string[] {
  const warnings: string[] = []
  const uncertainCount = timeline.filter((item) => !item.date).length
  if (uncertainCount) warnings.push(`${uncertainCount} ${uncertainCount === 1 ? 'record has' : 'records have'} an unknown event date.`)
  if (draft.purchaseDate && timeline.some((item) => item.id !== 'purchase' && item.date && item.date < draft.purchaseDate)) warnings.push('At least one evidence date is earlier than the recorded purchase date. Check the chronology.')
  return warnings
}

export function findFactConflicts(draft: CaseDraft, extractions: EvidenceExtraction[]): string[] {
  const confirmed = extractions.flatMap((record) => record.candidates.filter((item) => item.status === 'confirmed').map((item) => ({ ...item, evidenceId: record.evidenceId })))
  const conflicts: string[] = []
  const enteredAmount = Number(draft.amount)
  const amountsFor = (role: 'transaction' | 'refund') => [...new Set(confirmed.filter((item) => item.field === 'amount' && item.confirmedValue && (item.amountRole === role || (role === 'transaction' && item.amountRole === undefined))).map((item) => Number(item.confirmedValue)).filter(Number.isFinite).map((amount) => Math.round(amount * 100)))]
  const transactionAmounts = amountsFor('transaction')
  if (transactionAmounts.length > 1) conflicts.push('Confirmed evidence contains different transaction amounts.')
  if (enteredAmount > 0 && transactionAmounts.some((amount) => Math.abs(amount - Math.round(enteredAmount * 100)) >= 1)) conflicts.push(`A confirmed extracted amount differs from the entered transaction amount of MYR ${enteredAmount.toFixed(2)}.`)
  const refundAmounts = amountsFor('refund')
  if (refundAmounts.length > 1) conflicts.push('Confirmed evidence contains different refund amounts.')
  const requestedRefund = Number(draft.remedyAmount)
  if (draft.remedy === 'refund' && requestedRefund > 0 && refundAmounts.some((amount) => Math.abs(amount - Math.round(requestedRefund * 100)) >= 1)) conflicts.push(`A confirmed extracted refund amount differs from the entered requested refund amount of MYR ${requestedRefund.toFixed(2)}.`)
  const extractedReferences = [...new Set(confirmed.filter((item) => item.field === 'reference').map((item) => item.confirmedValue).filter(Boolean))]
  if (new Set(extractedReferences.map((reference) => reference?.trim().toLowerCase())).size > 1) conflicts.push('Confirmed evidence contains different order or reference numbers.')
  if (draft.orderReference && extractedReferences.some((reference) => reference?.trim().toLowerCase() !== draft.orderReference.trim().toLowerCase())) conflicts.push('A confirmed extracted reference differs from the entered order or reference number.')
  const datedFields = [
    { role: 'purchase', label: 'purchase', value: draft.purchaseDate },
    { role: 'promised', label: 'promised performance', value: draft.promisedDate },
    { role: 'delivery', label: 'delivery', value: null },
    { role: 'contact', label: 'merchant contact', value: draft.contactDate },
  ] as const
  for (const { role, label, value } of datedFields) {
    const eventDates = [...new Set(confirmed.filter((item) => item.field === 'date' && item.dateRole === role).map((item) => item.confirmedValue).filter(Boolean))]
    if (eventDates.length > 1) conflicts.push(`Confirmed evidence contains multiple dates labelled for ${label}.`)
    if (value && eventDates.some((date) => date !== value)) conflicts.push(`A confirmed date labelled for ${label} differs from the entered ${label} date of ${value}.`)
  }
  const datesFor = (role: NonNullable<EvidenceExtraction['candidates'][number]['dateRole']>) => [...new Set(confirmed.filter((item) => item.field === 'date' && item.dateRole === role).map((item) => item.confirmedValue).filter((date): date is string => Boolean(date)))]
  const purchaseDates = [...datesFor('purchase'), ...(draft.purchaseDate ? [draft.purchaseDate] : [])]
  const promisedDates = [...datesFor('promised'), ...(draft.promisedDate ? [draft.promisedDate] : [])]
  const deliveryDates = datesFor('delivery')
  const outOfOrder = (earlier: string[], later: string[]) => earlier.some((date) => later.some((otherDate) => date > otherDate))
  if (outOfOrder(purchaseDates, promisedDates)) conflicts.push('A confirmed promised performance date occurs before the recorded purchase date.')
  if (outOfOrder(purchaseDates, deliveryDates)) conflicts.push('A confirmed delivery date occurs before the recorded purchase date.')
  if (outOfOrder(promisedDates, deliveryDates)) conflicts.push('A confirmed delivery date occurs before the promised performance date.')
  const extractedRemedies = [...new Set(confirmed.filter((item) => item.field === 'remedy').map((item) => item.confirmedValue?.toLowerCase()).filter(Boolean))]
  if (extractedRemedies.length > 1) conflicts.push('Confirmed evidence contains different requested remedies.')
  if (draft.remedy && extractedRemedies.some((remedy) => remedy !== draft.remedy)) conflicts.push(`A confirmed extracted remedy differs from the entered requested remedy of ${draft.remedy}.`)
  const normaliseName = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase()
  const extractedNames = [...new Set(confirmed.filter((item) => item.field === 'name').map((item) => item.confirmedValue).filter(Boolean))]
  if (new Set(extractedNames.map((name) => normaliseName(name as string))).size > 1) conflicts.push('Confirmed evidence contains different consumer names.')
  if (draft.consumerName && extractedNames.some((name) => normaliseName(name as string) !== normaliseName(draft.consumerName))) conflicts.push('A confirmed extracted consumer name differs from the entered case name.')
  return conflicts
}
