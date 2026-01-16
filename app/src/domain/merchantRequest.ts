import type { CaseDraft } from './case'

export type MerchantRequest = { subject: string; body: string; generatedFrom: Array<keyof CaseDraft> }

const ISSUE_SENTENCES: Record<Exclude<CaseDraft['issue'], ''>, string> = {
  non_delivery: 'The goods or services have not been received.',
  mismatch: 'What was received is materially different from the listing or agreed specification.',
  missing_refund: 'A refund was stated or agreed but has not been received.',
  cancellation: 'The cancellation or related billing issue remains unresolved.',
  uncertain: 'The transaction issue remains unresolved.',
}

const REMEDY_LABELS: Record<Exclude<CaseDraft['remedy'], ''>, string> = {
  delivery: 'delivery of the agreed goods or services', replacement: 'a replacement', repair: 'a repair', cancellation: 'cancellation', refund: 'a refund',
}

export function createMerchantRequest(draft: CaseDraft): MerchantRequest {
  const reference = draft.orderReference ? `order ${draft.orderReference}` : `the ${draft.purchaseDate || 'recorded'} transaction`
  const remedy = draft.remedy ? REMEDY_LABELS[draft.remedy] : 'the requested resolution'
  const amount = draft.remedy === 'refund' && Number(draft.remedyAmount) > 0 ? ` of MYR ${Number(draft.remedyAmount).toFixed(2)}` : ''
  const promised = draft.promisedDate ? ` The promised date was ${draft.promisedDate}.` : ''
  const body = [
    `Dear ${draft.seller || 'merchant'},`,
    `I am writing about ${reference}, purchased on ${draft.purchaseDate || 'the recorded purchase date'} for MYR ${Number(draft.amount || 0).toFixed(2)}.${promised}`,
    ISSUE_SENTENCES[draft.issue || 'uncertain'],
    `I am requesting ${remedy}${amount}. Please confirm in writing how this will be resolved.`,
    `Regards,\n${draft.consumerName || 'Consumer'}`,
  ].join('\n\n')
  return {
    subject: `Request for ${draft.remedy ? draft.remedy.replaceAll('_', ' ') : 'resolution'} — ${reference}`,
    body,
    generatedFrom: ['consumerName', 'seller', 'purchaseDate', 'amount', 'orderReference', 'promisedDate', 'issue', 'remedy', 'remedyAmount'],
  }
}
