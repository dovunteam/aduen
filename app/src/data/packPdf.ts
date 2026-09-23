import { jsPDF } from 'jspdf'
import type { ComplaintPack } from '../domain/complaintPack'
import { confirmedFactLabel, packFileName } from '../domain/complaintPack'
import { timelineDetail, timelineLabel, timelineSource } from '../domain/caseReview'
import { recordAuditEvent } from './auditRepository'

export function downloadComplaintPackPdf(pack: ComplaintPack): void {
  if (!pack.approvedAt) throw new Error('Approve the pack before exporting it.')
  const pdf = createComplaintPackPdf(pack)
  pdf.save(packFileName(pack))
  recordAuditEvent('pack_exported', pack.id, `approved pack v${pack.version} PDF exported`)
}

export function createComplaintPackPdf(pack: ComplaintPack): jsPDF {
  if (!pack.approvedAt) throw new Error('Approve the pack before exporting it.')
  const ms = pack.locale === 'ms'
  const text = ms ? {
    title: 'PEK KES ADUEN', version: 'Versi', approved: 'Diluluskan', transaction: 'Transaksi', consumer: 'Pengguna', seller: 'Penjual', sellerLocation: 'Lokasi penjual', category: 'Kategori', platform: 'Platform', notProvided: 'Tidak diberikan', purchaseDate: 'Tarikh pembelian', amount: 'Jumlah', payment: 'Kaedah pembayaran', reference: 'Rujukan pesanan', problem: 'Masalah dan penyelesaian diminta', issue: 'Isu', remedy: 'Penyelesaian diminta', requestedAmount: 'Jumlah diminta', merchantRequest: 'Permintaan kepada peniaga', subject: 'Subjek', chronology: 'Kronologi', unknownDate: 'Tarikh tidak diketahui', evidence: 'Indeks bukti', sha: 'SHA-256', confirmedFacts: 'Fakta terbitan yang disahkan', extracted: 'Nilai diekstrak', evidenceId: 'ID bukti', route: 'Rekod laluan', ruleVersion: 'Versi peraturan', sourceChecked: 'Sumber disemak', source: 'Sumber', destinations: 'Destinasi rasmi yang mungkin', declaration: 'Pengakuan pengguna', notice: 'Makluman penting', missing: 'Tidak diberikan', issueValues: { non_delivery: 'barangan atau perkhidmatan tidak diterima', mismatch: 'barangan atau perkhidmatan berbeza daripada yang dipersetujui', missing_refund: 'bayaran balik belum diterima', cancellation: 'pembatalan atau bil belum diselesaikan', uncertain: 'isu transaksi belum diselesaikan' }, remedyValues: { delivery: 'penghantaran', replacement: 'penggantian', repair: 'pembaikan', cancellation: 'pembatalan', refund: 'bayaran balik' }, evidenceTypes: { receipt: 'resit', payment: 'rekod pembayaran', listing: 'iklan atau penyenaraian', message: 'mesej', merchant_response: 'respons peniaga', delivery: 'rekod penghantaran', policy: 'polisi', other: 'lain-lain' },
  } : {
    title: 'Aduen CASE PACK', version: 'Version', approved: 'Approved', transaction: 'Transaction', consumer: 'Consumer', seller: 'Seller', sellerLocation: 'Seller location', category: 'Category', platform: 'Platform', notProvided: 'Not provided', purchaseDate: 'Purchase date', amount: 'Amount', payment: 'Payment method', reference: 'Order reference', problem: 'Problem and requested remedy', issue: 'Issue', remedy: 'Requested remedy', requestedAmount: 'Requested amount', merchantRequest: 'Merchant request', subject: 'Subject', chronology: 'Chronology', unknownDate: 'Date unknown', evidence: 'Evidence index', sha: 'SHA-256', confirmedFacts: 'Confirmed derived facts', extracted: 'Extracted value', evidenceId: 'Evidence ID', route: 'Route record', ruleVersion: 'Rule version', sourceChecked: 'Source checked', source: 'Source', destinations: 'Possible official destinations', declaration: 'User declaration', notice: 'Important notice', missing: 'Not provided', issueValues: { non_delivery: 'goods or services not received', mismatch: 'goods or services differ from agreement', missing_refund: 'refund not received', cancellation: 'cancellation or billing unresolved', uncertain: 'transaction issue unresolved' }, remedyValues: { delivery: 'delivery', replacement: 'replacement', repair: 'repair', cancellation: 'cancellation', refund: 'refund' }, evidenceTypes: { receipt: 'receipt', payment: 'payment record', listing: 'listing', message: 'message', merchant_response: 'merchant response', delivery: 'delivery record', policy: 'policy', other: 'other' },
  }
  const issueValue = text.issueValues[pack.issue.replaceAll(' ', '_') as keyof typeof text.issueValues] ?? pack.issue
  const remedyValue = text.remedyValues[pack.remedy as keyof typeof text.remedyValues] ?? pack.remedy.replaceAll('_', ' ')
  const locale = ms ? 'ms-MY' : 'en-MY'
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const left = 18
  const width = 174
  let y = 20

  const line = (text: string, size = 10, bold = false) => {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal'); pdf.setFontSize(size)
    const rows = pdf.splitTextToSize(text || (ms ? 'Tidak diberikan' : 'Not provided'), width) as string[]
    if (y + rows.length * 5 > 278) { pdf.addPage(); y = 20 }
    pdf.text(rows, left, y); y += rows.length * 5 + 2
  }
  const heading = (text: string) => { y += 4; line(text.toUpperCase(), 11, true); pdf.setDrawColor(190); pdf.line(left, y - 1, 192, y - 1); y += 3 }

  pdf.setTextColor(23, 58, 54)
  line(text.title, 18, true)
  line(`${text.version} ${pack.version} | ${text.approved} ${new Date(pack.approvedAt).toLocaleString(locale)}`, 8)
  heading(text.transaction)
  line(`${text.consumer}: ${pack.consumerName}\n${text.seller}: ${pack.transaction.seller}`, 10, true)
  line(`${text.sellerLocation}: ${pack.transaction.sellerLocation}\n${text.category}: ${pack.transaction.category}\n${text.platform}: ${pack.transaction.platform || text.missing}\n${text.purchaseDate}: ${pack.transaction.purchaseDate}\n${text.amount}: ${pack.transaction.currency} ${Number(pack.transaction.amount).toFixed(2)}\n${text.payment}: ${pack.transaction.paymentMethod}\n${text.reference}: ${pack.transaction.orderReference || text.missing}`)
  heading(text.problem)
  line(`${text.issue}: ${issueValue}\n${text.remedy}: ${remedyValue}${pack.remedyAmount ? `\n${text.requestedAmount}: RM ${Number(pack.remedyAmount).toFixed(2)}` : ''}`)
  heading(text.merchantRequest)
  line(`${text.subject}: ${pack.merchantRequest.subject}`, 10, true)
  line(pack.merchantRequest.body)
  heading(text.chronology)
  pack.timeline.forEach((item) => line(`${item.date || text.unknownDate} | ${timelineLabel(item, pack.locale)}\n${timelineDetail(item, pack.locale)} (${timelineSource(item.source, pack.locale)})`))
  heading(text.evidence)
  pack.evidence.forEach((item, index) => line(`${index + 1}. ${item.fileName} | ${text.evidenceTypes[item.sourceType as keyof typeof text.evidenceTypes] ?? item.sourceType.replaceAll('_', ' ')} | ${item.eventDate || text.unknownDate}\n${text.sha}: ${item.sha256}`))
  if (pack.confirmedDerivedFacts.length) {
    heading(text.confirmedFacts)
    pack.confirmedDerivedFacts.forEach((item) => line(`${confirmedFactLabel(item, pack.locale)}: ${item.value}\n${text.extracted}: ${item.extractedValue} | ${text.evidenceId}: ${item.evidenceId} | ${item.extractorVersion}`))
  }
  heading(text.route)
  line(`${pack.route.routeName}\n${text.ruleVersion}: ${pack.route.ruleVersion}\n${text.sourceChecked}: ${pack.route.sourceChecked}\n${text.source}: ${pack.route.sourceUrl}`)
  if (pack.route.officialLinks?.length) line(`${text.destinations}:\n${pack.route.officialLinks.map((link) => `${link.label}: ${link.url}`).join('\n')}`)
  heading(text.declaration)
  line(pack.declaration)
  heading(text.notice)
  line(pack.disclaimer, 8)
  return pdf
}
