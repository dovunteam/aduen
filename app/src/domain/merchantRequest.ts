import type { CaseDraft } from './case'
import type { Locale } from '../i18n'

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

const ISSUE_SENTENCES_MS: Record<Exclude<CaseDraft['issue'], ''>, string> = {
  non_delivery: 'Barangan atau perkhidmatan tersebut masih belum diterima.',
  mismatch: 'Barangan atau perkhidmatan yang diterima berbeza dengan ketara daripada iklan atau spesifikasi yang dipersetujui.',
  missing_refund: 'Bayaran balik telah dinyatakan atau dipersetujui tetapi masih belum diterima.',
  cancellation: 'Isu pembatalan atau bil berkaitan masih belum diselesaikan.',
  uncertain: 'Isu transaksi ini masih belum diselesaikan.',
}

const REMEDY_LABELS_MS: Record<Exclude<CaseDraft['remedy'], ''>, string> = {
  delivery: 'penghantaran barangan atau perkhidmatan yang dipersetujui', replacement: 'penggantian', repair: 'pembaikan', cancellation: 'pembatalan', refund: 'bayaran balik',
}

export function createMerchantRequest(draft: CaseDraft, locale: Locale = 'en'): MerchantRequest {
  const ms = locale === 'ms'
  const reference = draft.orderReference ? (ms ? `pesanan ${draft.orderReference}` : `order ${draft.orderReference}`) : (ms ? `transaksi pada ${draft.purchaseDate || 'tarikh yang direkodkan'}` : `the ${draft.purchaseDate || 'recorded'} transaction`)
  const remedy = draft.remedy ? (ms ? REMEDY_LABELS_MS[draft.remedy] : REMEDY_LABELS[draft.remedy]) : (ms ? 'penyelesaian yang diminta' : 'the requested resolution')
  const amount = draft.remedy === 'refund' && Number(draft.remedyAmount) > 0 ? `${ms ? ' sebanyak RM' : ' of MYR '}${Number(draft.remedyAmount).toFixed(2)}` : ''
  const promised = draft.promisedDate ? (ms ? ` Tarikh yang dijanjikan ialah ${draft.promisedDate}.` : ` The promised date was ${draft.promisedDate}.`) : ''
  const greeting = ms ? `Tuan/Puan ${draft.seller || 'peniaga'},` : `Dear ${draft.seller || 'merchant'},`
  const purchaseLine = ms
    ? `Saya menulis berkenaan ${reference}, yang dibeli pada ${draft.purchaseDate || 'tarikh pembelian yang direkodkan'} dengan harga RM ${Number(draft.amount || 0).toFixed(2)}.${promised}`
    : `I am writing about ${reference}, purchased on ${draft.purchaseDate || 'the recorded purchase date'} for MYR ${Number(draft.amount || 0).toFixed(2)}.${promised}`
  const issue = ms ? ISSUE_SENTENCES_MS[draft.issue || 'uncertain'] : ISSUE_SENTENCES[draft.issue || 'uncertain']
  const requestLine = ms
    ? `Saya memohon ${remedy}${amount}. Sila sahkan secara bertulis cara perkara ini akan diselesaikan.`
    : `I am requesting ${remedy}${amount}. Please confirm in writing how this will be resolved.`
  const body = [
    greeting,
    purchaseLine,
    issue,
    requestLine,
    ms ? `Terima kasih,\n${draft.consumerName || 'Pengguna'}` : `Regards,\n${draft.consumerName || 'Consumer'}`,
  ].join('\n\n')
  return {
    subject: ms
      ? `Permohonan ${draft.remedy ? REMEDY_LABELS_MS[draft.remedy] : 'penyelesaian'} - ${reference}`
      : `Request for ${draft.remedy ? draft.remedy.replaceAll('_', ' ') : 'resolution'} - ${reference}`,
    body,
    generatedFrom: ['consumerName', 'seller', 'purchaseDate', 'amount', 'orderReference', 'promisedDate', 'issue', 'remedy', 'remedyAmount'],
  }
}
