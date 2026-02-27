import { useEffect, useState } from 'react'
import { approveComplaintPack, confirmedFactLabel } from '../domain/complaintPack'
import { timelineDetail, timelineLabel, timelineSource } from '../domain/caseReview'
import type { ComplaintPack } from '../domain/complaintPack'
import type { Locale } from '../i18n'
import { recordAuditEvent } from '../data/auditRepository'
import { isCompleteOperatorReview, OPERATOR_REVIEW_CHECKS, readOperatorReview, saveOperatorReview } from '../data/operatorReviewRepository'
import type { OperatorReview, OperatorReviewCheck } from '../data/operatorReviewRepository'

type Props = { locale: Locale; initialPack: ComplaintPack; onBack: () => void; onContinue: () => void; onApproved: (pack: ComplaintPack) => void }

export function PackStep({ locale, initialPack, onBack, onContinue, onApproved }: Props) {
  const text = packText[locale]
  const operator = operatorText[locale]
  const [pack, setPack] = useState(initialPack)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [exportingArchive, setExportingArchive] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const existingReview = readOperatorReview(initialPack.id)
  const [reviewerCode, setReviewerCode] = useState(existingReview?.reviewerCode ?? '')
  const [reviewNotes, setReviewNotes] = useState(existingReview?.notes ?? '')
  const [reviewChecks, setReviewChecks] = useState<Record<OperatorReviewCheck, boolean>>(existingReview?.checks ?? { facts: false, route: false, deadlines: false, language: false, evidence: false })
  const [operatorReview, setOperatorReview] = useState<OperatorReview | null>(existingReview)

  useEffect(() => { recordAuditEvent('pack_viewed', pack.id, `pack v${pack.version} viewed`) }, [pack.id, pack.version])

  async function exportArchive() {
    setError(''); setExportingArchive(true)
    try {
      if (!isCompleteOperatorReview(operatorReview)) throw new Error(operator.reviewRequired)
      const { downloadHandoffArchive } = await import('../data/handoffArchive')
      await downloadHandoffArchive(pack)
    } catch (cause) { setError(cause instanceof Error ? cause.message : text.pdfError) }
    finally { setExportingArchive(false) }
  }

  async function approveAndExport() {
    setError(''); setExportingPdf(true)
    try {
      if (!isCompleteOperatorReview(operatorReview)) throw new Error(operator.reviewRequired)
      const approved = pack.approvedAt ? pack : approveComplaintPack(pack)
      onApproved(approved); setPack(approved)
      if (!pack.approvedAt) recordAuditEvent('pack_approved', approved.id, `pack v${approved.version} approved`)
      const { downloadComplaintPackPdf } = await import('../data/packPdf')
      downloadComplaintPackPdf(approved)
    } catch (cause) { setError(cause instanceof Error ? cause.message : text.pdfError) }
    finally { setExportingPdf(false) }
  }

  function recordOperatorReview() {
    if (!reviewerCode.trim() || !OPERATOR_REVIEW_CHECKS.every((check) => reviewChecks[check])) {
      setError(operator.reviewIncomplete)
      return
    }
    const review: OperatorReview = { reviewerCode: reviewerCode.trim(), reviewedAt: new Date().toISOString(), notes: reviewNotes.trim(), checks: reviewChecks }
    try { saveOperatorReview(pack.id, review); setOperatorReview(review); setError('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : operator.reviewError) }
  }

  async function copyRequest() {
    setError('')
    try { await navigator.clipboard.writeText(`Subject: ${pack.merchantRequest.subject}\n\n${pack.merchantRequest.body}`); recordAuditEvent('request_copied', pack.id, `approved pack v${pack.version} request copied`); setCopied(true) }
    catch { setError(text.copyError) }
  }

  return <section className="page form-page pack-page">
    <div className="eyebrow">{text.eyebrow} · {text.version} {pack.version}</div><h1>{text.title}</h1>
    <p className="lede">{text.lede}</p>
    <div className="pack-layout"><article className="pack-document">
      <header><span>Aduen CASE PACK</span><small>{pack.approvedAt ? text.approved : text.draft} · {new Date(pack.createdAt).toLocaleString(locale === 'ms' ? 'ms-MY' : 'en-MY')}</small></header>
      <PackSection title={text.transaction}><dl><div><dt>{text.consumer}</dt><dd>{pack.consumerName}</dd></div><div><dt>{text.seller}</dt><dd>{pack.transaction.seller}</dd></div><div><dt>{text.sellerLocation}</dt><dd>{pack.transaction.sellerLocation}</dd></div><div><dt>{text.category}</dt><dd>{pack.transaction.category}</dd></div><div><dt>{text.platform}</dt><dd>{pack.transaction.platform || text.notProvided}</dd></div><div><dt>{text.purchaseDate}</dt><dd>{pack.transaction.purchaseDate}</dd></div><div><dt>{text.amount}</dt><dd>{pack.transaction.currency} {Number(pack.transaction.amount).toFixed(2)}</dd></div><div><dt>{text.payment}</dt><dd>{pack.transaction.paymentMethod}</dd></div><div><dt>{text.reference}</dt><dd>{pack.transaction.orderReference || text.notProvided}</dd></div></dl></PackSection>
      <PackSection title={text.problemRemedy}><p>{text.issue}: <strong>{pack.issue}</strong></p><p>{text.requestedRemedy}: <strong>{pack.remedy}{pack.remedyAmount ? ` - RM ${Number(pack.remedyAmount).toFixed(2)}` : ''}</strong></p></PackSection>
      <PackSection title={text.merchantRequest}><p><strong>{text.subject}: {pack.merchantRequest.subject}</strong></p><pre className="request-preview">{pack.merchantRequest.body}</pre><small>{text.generatedOnly}: {pack.merchantRequest.generatedFrom.join(', ')}</small></PackSection>
      <PackSection title={text.chronology}><ol>{pack.timeline.map((item) => <li key={item.id}><time>{item.date || text.dateUnknown}</time><span><strong>{timelineLabel(item, locale)}</strong><small>{timelineDetail(item, locale)} · {timelineSource(item.source, locale)}</small></span></li>)}</ol></PackSection>
      <PackSection title={`${text.evidenceIndex} · ${pack.evidence.length}`}><ol className="pack-evidence">{pack.evidence.map((item) => <li key={item.id}><strong>{item.fileName}</strong><small>{item.sourceType.replaceAll('_', ' ')} · {item.eventDate || text.dateUnknown} · SHA-256 {item.sha256.slice(0, 16)}…</small></li>)}</ol></PackSection>
      {pack.confirmedDerivedFacts.length > 0 && <PackSection title={`${text.confirmedFacts} · ${pack.confirmedDerivedFacts.length}`}><ol className="pack-evidence">{pack.confirmedDerivedFacts.map((item, index) => <li key={item.candidateId ?? `${item.evidenceId}-${index}`}><strong>{confirmedFactLabel(item, locale)}: {item.value}</strong><small>{text.extractedAs} {item.extractedValue} · {text.evidence} {item.evidenceId} · {item.extractorVersion}</small></li>)}</ol></PackSection>}
      <PackSection title={text.routeRecord}><p><strong>{pack.route.routeName}</strong></p><small>{text.rule} {pack.route.ruleVersion} · {text.sourceChecked} {pack.route.sourceChecked} · <a href={pack.route.sourceUrl} target="_blank" rel="noreferrer">{text.source}</a></small>{pack.route.officialLinks?.length ? <div className="official-links"><strong>{text.destinations}</strong>{pack.route.officialLinks.map((link) => <a href={link.url} target="_blank" rel="noreferrer" key={link.url}>{link.label}</a>)}</div> : null}</PackSection>
      <PackSection title={text.declaration}><p>{pack.declaration}</p></PackSection>
      <footer>{pack.disclaimer}</footer>
    </article>
    <section className="operator-review-panel" aria-labelledby="operator-review-title"><div className="eyebrow">{operator.eyebrow}</div><h2 id="operator-review-title">{operator.title}</h2><p>{operator.copy}</p><label>{operator.reviewerCode}<input maxLength={120} value={reviewerCode} onChange={(event) => setReviewerCode(event.target.value)} placeholder={operator.reviewerPlaceholder} /></label><div className="choice-list">{OPERATOR_REVIEW_CHECKS.map((check) => <label className="choice" key={check}><input type="checkbox" checked={reviewChecks[check]} onChange={(event) => setReviewChecks((current) => ({ ...current, [check]: event.target.checked }))} /><span className="choice-box" aria-hidden="true">✓</span><span>{operator.checks[check]}</span></label>)}</div><label>{operator.notes}<textarea maxLength={1000} value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} placeholder={operator.notesPlaceholder} /></label><button className="secondary" disabled={!reviewerCode.trim() || !OPERATOR_REVIEW_CHECKS.every((check) => reviewChecks[check])} onClick={recordOperatorReview}>{operatorReview ? operator.recorded : operator.record}</button>{operatorReview && <p className="approval-time">{operator.recordedAt} {new Date(operatorReview.reviewedAt).toLocaleString(locale === 'ms' ? 'ms-MY' : 'en-MY')}</p>}<small>{operator.disclaimer}</small></section>
    <aside className="approval-panel"><div className="eyebrow">{text.approval}</div><h2>{text.nothingLeaves}</h2><p>{text.approvalCopy}</p><label className="check-row"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>{text.approveConsent}</span></label>{pack.approvedAt && <p className="approval-time">{text.approved} {new Date(pack.approvedAt).toLocaleString(locale === 'ms' ? 'ms-MY' : 'en-MY')}</p>}{error && <p className="form-error" role="alert">{error}</p>}<button className="primary" disabled={!confirmed || !operatorReview || exportingPdf} onClick={approveAndExport}>{text.approveExport} <span>↓</span></button><button className="copy-button" disabled={!pack.approvedAt} onClick={() => void copyRequest()}>{copied ? text.requestCopied : text.copyRequest}</button><small>{text.evidenceNote}</small></aside></div>
    <div className="actions"><button className="secondary" disabled={!pack.approvedAt || !operatorReview || exportingArchive} onClick={() => void exportArchive()}>{exportingArchive ? (locale === 'ms' ? 'Menyediakan ZIP…' : 'Preparing ZIP…') : (locale === 'ms' ? 'Eksport PDF dan bukti terpilih (ZIP)' : 'Export PDF and selected evidence (ZIP)')}</button></div>
    <div className="actions split"><button className="secondary" onClick={onBack}>{text.back}</button><button className="primary" disabled={!pack.approvedAt} onClick={onContinue}>{text.trackStatus} <span>→</span></button></div>
  </section>
}

function PackSection({ title, children }: { title: string; children: React.ReactNode }) { return <section><h2>{title}</h2>{children}</section> }

const operatorText = {
  en: { eyebrow: 'Operator review', title: 'Quality gate before release.', copy: 'A trained operator must check this pack during the pilot. This local control records a reviewer code; it is not authentication.', reviewerCode: 'Reviewer code', reviewerPlaceholder: 'Pilot operator code', checks: { facts: 'Transaction identity and amount match the evidence', route: 'Routing eligibility and uncertainty are reviewed', deadlines: 'Dates and deadline assumptions are checked', language: 'Unsupported allegations and conclusions are removed', evidence: 'Evidence selection and redaction are reviewed' }, notes: 'Operator notes', notesPlaceholder: 'Optional factual note or escalation reference', record: 'Record operator review', recorded: 'Operator review recorded', recordedAt: 'Recorded', disclaimer: 'The operator must review the originals and the approved preview separately. Aduen does not authenticate this reviewer.', reviewIncomplete: 'Complete every operator check before recording the review.', reviewRequired: 'Record the operator review before exporting this pack.', reviewError: 'The operator review could not be saved.' },
  ms: { eyebrow: 'Semakan operator', title: 'Pintu kualiti sebelum pelepasan.', copy: 'Operator terlatih mesti menyemak pek ini semasa perintis. Kawalan setempat ini merekodkan kod penyemak; ia bukan pengesahan identiti.', reviewerCode: 'Kod penyemak', reviewerPlaceholder: 'Kod operator perintis', checks: { facts: 'Identiti transaksi dan jumlah sepadan dengan bukti', route: 'Kelayakan dan ketidakpastian laluan disemak', deadlines: 'Tarikh dan andaian tarikh akhir disemak', language: 'Tuduhan dan kesimpulan tanpa sokongan dibuang', evidence: 'Pemilihan dan redaksi bukti disemak' }, notes: 'Nota operator', notesPlaceholder: 'Nota fakta atau rujukan eskalasi pilihan', record: 'Rekod semakan operator', recorded: 'Semakan operator direkodkan', recordedAt: 'Direkodkan', disclaimer: 'Operator mesti menyemak fail asal dan pratonton yang diluluskan secara berasingan. Aduen tidak mengesahkan identiti penyemak ini.', reviewIncomplete: 'Lengkapkan setiap semakan operator sebelum merekodkan semakan.', reviewRequired: 'Rekodkan semakan operator sebelum mengeksport pek ini.', reviewError: 'Semakan operator tidak dapat disimpan.' },
} as const

const packText = {
  en: { eyebrow: 'Aduen Pack', version: 'Version', title: 'Review before export.', lede: 'This pack is a factual case summary for your review. It is not sent anywhere by Aduen, and exporting it does not submit a complaint.', draft: 'Draft', transaction: 'Transaction', consumer: 'Consumer', seller: 'Seller', sellerLocation: 'Seller location', category: 'Category', platform: 'Platform', notProvided: 'Not provided', purchaseDate: 'Purchase date', amount: 'Amount', payment: 'Payment', reference: 'Reference', problemRemedy: 'Problem and remedy', issue: 'Issue', requestedRemedy: 'Requested remedy', merchantRequest: 'Merchant request', subject: 'Subject', generatedOnly: 'Generated only from', chronology: 'Chronology', dateUnknown: 'Date unknown', evidenceIndex: 'Evidence index', confirmedFacts: 'Confirmed derived facts', extractedAs: 'Extracted as', evidence: 'Evidence', routeRecord: 'Route record', destinations: 'Possible official destinations', rule: 'Rule', sourceChecked: 'Source checked', source: 'Source', declaration: 'User declaration', approval: 'Your approval', nothingLeaves: 'Nothing leaves this device.', approvalCopy: 'Review names, dates, amounts, remedy, merchant request, chronology, and the evidence index. Return to the case to correct anything that is wrong.', approveConsent: 'I reviewed this pack and approve this version for export.', approved: 'Approved', approveExport: 'Approve and export PDF', requestCopied: 'Request copied', copyRequest: 'Copy approved request', evidenceNote: 'The evidence originals remain separate and are not embedded in this prototype PDF. Copying does not send the request.', back: '← Aduen Check', trackStatus: 'Track external status', pdfError: 'The PDF could not be generated.', copyError: 'The request could not be copied. Use the reviewed PDF instead.' },
  ms: { eyebrow: 'Pek Aduen', version: 'Versi', title: 'Semak sebelum mengeksport.', lede: 'Pek ini ialah ringkasan kes berfakta untuk semakan anda. Ia tidak dihantar ke mana-mana oleh Aduen, dan mengeksportnya tidak menyerahkan aduan.', draft: 'Draf', transaction: 'Transaksi', consumer: 'Pengguna', seller: 'Penjual', sellerLocation: 'Lokasi penjual', category: 'Kategori', platform: 'Platform', notProvided: 'Tidak diberikan', purchaseDate: 'Tarikh pembelian', amount: 'Jumlah', payment: 'Pembayaran', reference: 'Rujukan', problemRemedy: 'Masalah dan penyelesaian', issue: 'Isu', requestedRemedy: 'Penyelesaian diminta', merchantRequest: 'Permintaan peniaga', subject: 'Subjek', generatedOnly: 'Dijana hanya daripada', chronology: 'Kronologi', dateUnknown: 'Tarikh tidak diketahui', evidenceIndex: 'Indeks bukti', confirmedFacts: 'Fakta terbitan disahkan', extractedAs: 'Diekstrak sebagai', evidence: 'Bukti', routeRecord: 'Rekod laluan', destinations: 'Destinasi rasmi yang mungkin', rule: 'Peraturan', sourceChecked: 'Sumber disemak', source: 'Sumber', declaration: 'Pengakuan pengguna', approval: 'Kelulusan anda', nothingLeaves: 'Tiada apa-apa meninggalkan peranti ini.', approvalCopy: 'Semak nama, tarikh, jumlah, penyelesaian, permintaan peniaga, kronologi, dan indeks bukti. Kembali ke kes untuk membetulkan apa-apa yang salah.', approveConsent: 'Saya telah menyemak pek ini dan meluluskan versi ini untuk dieksport.', approved: 'Diluluskan', approveExport: 'Luluskan dan eksport PDF', requestCopied: 'Permintaan disalin', copyRequest: 'Salin permintaan diluluskan', evidenceNote: 'Fail asal bukti kekal berasingan dan tidak dibenamkan dalam PDF prototaip ini. Menyalin tidak menghantar permintaan.', back: '← Semakan Aduen', trackStatus: 'Jejak status luar', pdfError: 'PDF tidak dapat dijana.', copyError: 'Permintaan tidak dapat disalin. Gunakan PDF yang telah disemak.' },
} as const
