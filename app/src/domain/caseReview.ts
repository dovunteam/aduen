import type { CaseDraft } from './case'
import type { EvidenceMetadata, EvidenceType } from './evidence'
import type { EvidenceExtraction } from './extraction'

export type CheckItem = { id: string; level: 'required' | 'useful'; label: string; reason: string; source: string; satisfied: boolean }
export type TimelineItem = { id: string; date: string | null; label: string; detail: string; source: 'confirmed case detail' | 'user-described evidence' }

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
    { id: 'transaction', level: 'required', label: 'Order, receipt, or transaction record', reason: 'Identifies the seller and purchase.', source: 'Tuntiva MVP – supported cohort', satisfied: has('receipt') },
    { id: 'payment', level: 'required', label: 'Payment evidence', reason: 'Supports the amount and payment method.', source: 'Tuntiva workflow – evidence capture', satisfied: has('payment') },
    ...(ISSUE_RULES[draft.issue] ?? []).map((rule) => {
      const firstMerchantRequest = rule.type === 'message' && draft.contactHistory === 'none'
      return {
        ...rule,
        level: firstMerchantRequest ? 'useful' as const : rule.level,
        reason: firstMerchantRequest ? 'Not required before the first written request; add the sent request to the record afterward.' : rule.reason,
        id: `${draft.issue}-${rule.type}`,
        source: `Tuntiva workflow – ${draft.issue.replaceAll('_', ' ')} variant`,
        satisfied: has(rule.type),
      }
    }),
  ]
  if (draft.remedy === 'refund') checks.push({ id: 'refund-amount', level: 'required', label: 'Exact refund amount', reason: 'A monetary remedy needs one clear amount.', source: 'Tuntiva MVP – remedy statement', satisfied: Number(draft.remedyAmount) > 0 })
  return checks
}

export function buildTimeline(draft: CaseDraft, evidence: EvidenceMetadata[]): TimelineItem[] {
  const items: TimelineItem[] = [
    { id: 'purchase', date: draft.purchaseDate || null, label: 'Purchase made', detail: `${draft.seller} · RM ${Number(draft.amount || 0).toFixed(2)}`, source: 'confirmed case detail' },
    ...(draft.promisedDate ? [{ id: 'promised', date: draft.promisedDate, label: 'Promised performance date', detail: 'Date recorded by the consumer', source: 'confirmed case detail' as const }] : []),
    ...(draft.contactHistory && draft.contactHistory !== 'none' ? [{ id: 'merchant-contact', date: draft.contactDate || null, label: 'Merchant contacted', detail: draft.contactHistory === 'responded' ? 'Merchant response recorded' : 'No response recorded', source: 'confirmed case detail' as const }] : []),
    ...evidence.map((item) => ({ id: item.id, date: item.eventDate, label: item.description || item.fileName, detail: item.sourceType.replaceAll('_', ' '), source: 'user-described evidence' as const })),
  ]
  return items.sort((a, b) => {
    if (!a.date) return 1
    if (!b.date) return -1
    return a.date.localeCompare(b.date)
  })
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
  const extractedAmounts = [...new Set(confirmed.filter((item) => item.field === 'amount').map((item) => Number(item.confirmedValue)))]
  if (enteredAmount > 0 && extractedAmounts.some((amount) => Number.isFinite(amount) && Math.abs(amount - enteredAmount) >= 0.01)) conflicts.push(`A confirmed extracted amount differs from the entered transaction amount of MYR ${enteredAmount.toFixed(2)}.`)
  const extractedReferences = [...new Set(confirmed.filter((item) => item.field === 'reference').map((item) => item.confirmedValue).filter(Boolean))]
  if (draft.orderReference && extractedReferences.some((reference) => reference?.toLowerCase() !== draft.orderReference.toLowerCase())) conflicts.push('A confirmed extracted reference differs from the entered order or reference number.')
  const extractedDates = [...new Set(confirmed.filter((item) => item.field === 'date').map((item) => item.confirmedValue).filter(Boolean))]
  if (extractedDates.length > 1) conflicts.push('Confirmed evidence contains multiple extracted dates. Check which event each date describes.')
  return conflicts
}
