import type { CaseDraft } from './case'
import { buildTimeline } from './caseReview'
import type { EvidenceMetadata } from './evidence'
import type { RouteEvaluation } from './routing'

export type ComplaintPack = {
  id: string
  version: number
  createdAt: string
  approvedAt: string | null
  transaction: { seller: string; platform: string; purchaseDate: string; amount: string; paymentMethod: string; orderReference: string }
  issue: string
  remedy: string
  remedyAmount: string | null
  route: Pick<RouteEvaluation, 'routeName' | 'ruleVersion' | 'sourceChecked'>
  timeline: ReturnType<typeof buildTimeline>
  evidence: Array<Pick<EvidenceMetadata, 'id' | 'fileName' | 'sourceType' | 'eventDate' | 'description' | 'sha256'>>
  disclaimer: string
}

export function createComplaintPack(draft: CaseDraft, evidence: EvidenceMetadata[], route: RouteEvaluation, now = new Date()): ComplaintPack {
  const included = evidence.filter((item) => item.includeInPack)
  return {
    id: crypto.randomUUID(), version: 1, createdAt: now.toISOString(), approvedAt: null,
    transaction: { seller: draft.seller, platform: draft.platform, purchaseDate: draft.purchaseDate, amount: draft.amount, paymentMethod: draft.paymentMethod, orderReference: draft.orderReference },
    issue: draft.issue.replaceAll('_', ' '), remedy: draft.remedy, remedyAmount: draft.remedy === 'refund' ? draft.remedyAmount : null,
    route: { routeName: route.routeName, ruleVersion: route.ruleVersion, sourceChecked: route.sourceChecked },
    timeline: buildTimeline(draft, included),
    evidence: included.map(({ id, fileName, sourceType, eventDate, description, sha256 }) => ({ id, fileName, sourceType, eventDate, description, sha256 })),
    disclaimer: 'Prepared from user-confirmed details and selected evidence. Tuntiva provides case organisation and general routing information; it does not guarantee recovery or provide legal representation.',
  }
}

export function approveComplaintPack(pack: ComplaintPack, now = new Date()): ComplaintPack {
  return { ...pack, approvedAt: now.toISOString() }
}

export function packFileName(pack: ComplaintPack): string {
  const seller = pack.transaction.seller.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'case'
  return `tuntiva-${seller}-v${pack.version}.pdf`
}
