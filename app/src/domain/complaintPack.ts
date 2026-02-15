import type { CaseDraft } from './case'
import { buildTimeline } from './caseReview'
import type { EvidenceMetadata } from './evidence'
import type { RouteEvaluation } from './routing'
import type { EvidenceExtraction } from './extraction'
import { createMerchantRequest } from './merchantRequest'
import type { MerchantRequest } from './merchantRequest'
import type { Locale } from '../i18n'

export type ComplaintPack = {
  id: string
  version: number
  createdAt: string
  approvedAt: string | null
  consumerName: string
  transaction: { seller: string; sellerLocation: string; platform: string; purchaseDate: string; amount: string; currency: string; paymentMethod: string; orderReference: string; category: string }
  issue: string
  remedy: string
  remedyAmount: string | null
  route: Pick<RouteEvaluation, 'routeName' | 'ruleVersion' | 'sourceChecked' | 'sourceUrl' | 'officialLinks'>
  timeline: ReturnType<typeof buildTimeline>
  evidence: Array<Pick<EvidenceMetadata, 'id' | 'fileName' | 'sourceType' | 'eventDate' | 'description' | 'sha256'>>
  confirmedDerivedFacts: Array<{ field: string; value: string; extractedValue: string; evidenceId: string; extractorVersion: string }>
  merchantRequest: MerchantRequest
  disclaimer: string
  declaration: string
}

export function createComplaintPack(draft: CaseDraft, evidence: EvidenceMetadata[], route: RouteEvaluation, now = new Date(), version = 1, extractions: EvidenceExtraction[] = [], locale: Locale = 'en'): ComplaintPack {
  const included = evidence.filter((item) => item.includeInPack)
  return {
    id: crypto.randomUUID(), version, createdAt: now.toISOString(), approvedAt: null,
    consumerName: draft.consumerName,
    transaction: { seller: draft.seller, sellerLocation: draft.sellerLocation, platform: draft.platform, purchaseDate: draft.purchaseDate, amount: draft.amount, currency: draft.currency, paymentMethod: draft.paymentMethod, orderReference: draft.orderReference, category: draft.category.replaceAll('_', ' ') },
    issue: draft.issue.replaceAll('_', ' '), remedy: draft.remedy, remedyAmount: draft.remedy === 'refund' ? draft.remedyAmount : null,
    route: { routeName: route.routeName, ruleVersion: route.ruleVersion, sourceChecked: route.sourceChecked, sourceUrl: route.sourceUrl, officialLinks: route.officialLinks },
    timeline: buildTimeline(draft, included),
    evidence: included.map(({ id, fileName, sourceType, eventDate, description, sha256 }) => ({ id, fileName, sourceType, eventDate, description, sha256 })),
    confirmedDerivedFacts: extractions.filter((record) => included.some((item) => item.id === record.evidenceId)).flatMap((record) => record.candidates.filter((item) => item.status === 'confirmed' && item.confirmedValue).map((item) => ({ field: item.field, value: item.confirmedValue as string, extractedValue: item.value, evidenceId: record.evidenceId, extractorVersion: record.extractorVersion }))),
    merchantRequest: createMerchantRequest(draft, locale),
    disclaimer: 'Prepared from user-confirmed details and selected evidence. Aduen provides case organisation and general routing information; it does not guarantee recovery or provide legal representation.',
    declaration: `I, ${draft.consumerName || 'the consumer'}, confirm that the information in this pack is accurate to the best of my knowledge and that I am authorised to provide it.`,
  }
}

export function approveComplaintPack(pack: ComplaintPack, now = new Date()): ComplaintPack {
  return { ...pack, approvedAt: now.toISOString() }
}

export function packFileName(pack: ComplaintPack): string {
  const seller = pack.transaction.seller.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'case'
  return `Aduen-${seller}-v${pack.version}.pdf`
}
