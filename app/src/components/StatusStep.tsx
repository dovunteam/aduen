import { useState } from 'react'
import type { FormEvent } from 'react'
import { readSubmission, saveSubmission } from '../data/statusRepository'
import { downloadFollowUpCalendar } from '../data/followUpCalendar'
import { nextStatus, validateStatusTransition } from '../domain/status'
import type { SubmissionRecord } from '../domain/status'
import type { CaseRecordStatus } from '../domain/case'
import type { Locale } from '../i18n'

export function StatusStep({ locale, onBack, onStatusChange }: { locale: Locale; onBack: () => void; onStatusChange: (status: CaseRecordStatus) => void }) {
  const text = statusText[locale]
  const reminderText = locale === 'ms' ? 'Muat turun peringatan kalendar' : 'Download calendar reminder'
  const reminderError = locale === 'ms' ? 'Masukkan tarikh susulan yang sah sebelum memuat turun peringatan kalendar.' : 'Enter a valid follow-up date before downloading a calendar reminder.'
  const reminderBasis = locale === 'ms' ? 'Peringatan ini berdasarkan tarikh susulan yang anda masukkan, bukan tarikh akhir luaran.' : 'This reminder is based on the follow-up date you entered, not an external deadline.'
  const [record, setRecord] = useState<SubmissionRecord>(readSubmission)
  const [message, setMessage] = useState('')
  const terminal = record.status === 'resolved' || record.status === 'closed'

  function update<K extends keyof SubmissionRecord>(key: K, value: SubmissionRecord[K]) { setRecord((current) => ({ ...current, [key]: value })) }
  function submit(event: FormEvent) {
    event.preventDefault(); setMessage('')
    const status = nextStatus(record)
    if (!validateStatusTransition(record.status, status)) { setMessage(text.closedError); return }
    const saved = saveSubmission({ ...record, status }); setRecord(saved); onStatusChange(status === 'ready' ? 'approved' : status); setMessage(text.saved)
  }
  function downloadReminder() {
    if (!downloadFollowUpCalendar(record)) setMessage(reminderError)
  }

  return <section className="page form-page status-page">
    <div className="status-heading"><div><div className="eyebrow">{text.eyebrow}</div><h1>{text.title}</h1><p className="lede">{text.lede}</p></div><div className={`status-badge ${record.status}`}><span>{text.currentStatus}</span><strong>{statusLabel(record.status, locale)}</strong></div></div>
    <form onSubmit={submit}>
      <div className="form-section"><SectionTitle number="01" title={text.handoff} copy={text.handoffCopy} /><div className="fields two-col"><label>{text.recipient}<input disabled={terminal} required value={record.channel} onChange={(event) => update('channel', event.target.value)} placeholder={text.recipientPlaceholder} /></label><label>{text.submissionDate}<input disabled={terminal} required type="date" value={record.submissionDate} onChange={(event) => update('submissionDate', event.target.value)} /></label><label>{text.reference} <span className="optional">{text.ifProvided}</span><input disabled={terminal} value={record.referenceNumber} onChange={(event) => update('referenceNumber', event.target.value)} placeholder={text.referencePlaceholder} /></label><label>{text.followUp} <span className="optional">{text.optionalReminder}</span><input disabled={terminal} type="date" min={record.submissionDate || undefined} value={record.nextFollowUpDate} onChange={(event) => update('nextFollowUpDate', event.target.value)} /></label></div></div>
      <div className="form-section"><SectionTitle number="02" title={text.responseTitle} copy={text.responseCopy} /><div className="fields"><label>{text.responseSummary} <span className="optional">{text.optional}</span><textarea disabled={terminal} value={record.response} maxLength={1200} onChange={(event) => update('response', event.target.value)} placeholder={text.responsePlaceholder} /></label></div></div>
      <div className="form-section"><SectionTitle number="03" title={text.outcomeTitle} copy={text.outcomeCopy} /><div className="fields"><label>{text.recordedOutcome}<select disabled={terminal} value={record.outcome} onChange={(event) => update('outcome', event.target.value as SubmissionRecord['outcome'])}><option value="">{text.noOutcome}</option><optgroup label={text.resolved}><option value="refund">{text.refund}</option><option value="replacement">{text.replacement}</option><option value="repair">{text.repair}</option><option value="delivery">{text.delivery}</option><option value="partial">{text.partial}</option></optgroup><optgroup label={text.closedWithout}><option value="rejected">{text.rejected}</option><option value="redirected">{text.redirected}</option><option value="withdrawn">{text.withdrawn}</option><option value="unresolved">{text.unresolved}</option></optgroup></select></label></div></div>
      {record.nextFollowUpDate && !terminal && <div className="follow-up"><span>{text.followUp}</span><strong>{new Date(`${record.nextFollowUpDate}T00:00:00`).toLocaleDateString(locale === 'ms' ? 'ms-MY' : 'en-MY', { day: '2-digit', month: 'long', year: 'numeric' })}</strong><p>{text.followUpCopy}</p><p>{reminderBasis}</p><button type="button" className="copy-button" onClick={downloadReminder}>{reminderText}</button></div>}
      {message && <p className="save-message" role="status">{message}</p>}
      <div className="actions split"><button type="button" className="secondary" onClick={onBack}>{text.back}</button><button className="primary" disabled={terminal} type="submit">{terminal ? text.closed : text.save} <span>→</span></button></div>
    </form>
  </section>
}

function SectionTitle({ number, title, copy }: { number: string; title: string; copy: string }) { return <div className="section-title"><span>{number}</span><div><h2>{title}</h2><p>{copy}</p></div></div> }

const statusText = {
  en: { eyebrow: 'Buktiva Status', title: 'Record what happens next.', lede: 'Buktiva does not monitor the merchant or submit on your behalf. Add external events here so the case record remains complete.', currentStatus: 'Current status', handoff: 'Handoff', handoffCopy: 'Record where and when you sent the case.', recipient: 'Recipient or channel', recipientPlaceholder: 'Merchant email, platform form, or other channel', submissionDate: 'Submission date', reference: 'External reference', ifProvided: 'If provided', referencePlaceholder: 'Ticket or complaint number', followUp: 'Next follow-up', optionalReminder: 'Optional reminder', responseTitle: 'Response', responseCopy: "Keep the merchant or recipient's wording factual.", responseSummary: 'Response summary', optional: 'Optional', responsePlaceholder: 'What did the recipient say or do?', outcomeTitle: 'Outcome', outcomeCopy: 'Close the case only when the external result is known.', recordedOutcome: 'Recorded outcome', noOutcome: 'No final outcome yet', resolved: 'Resolved', refund: 'Refund received', replacement: 'Replacement received', repair: 'Repair completed', delivery: 'Delivery completed', partial: 'Partial remedy received', closedWithout: 'Closed without requested remedy', rejected: 'Rejected', redirected: 'Redirected elsewhere', withdrawn: 'Withdrawn by me', unresolved: 'Unresolved', followUpCopy: 'This is stored as a record only; the prototype does not send notifications.', back: '← Pack', closed: 'Case closed', save: 'Save status', saved: 'Status saved on this device.', closedError: 'A closed outcome cannot return to an active state.' },
  ms: { eyebrow: 'Status Buktiva', title: 'Catat perkara yang berlaku seterusnya.', lede: 'Buktiva tidak memantau peniaga atau membuat penyerahan bagi pihak anda. Tambah peristiwa luar di sini supaya rekod kes kekal lengkap.', currentStatus: 'Status semasa', handoff: 'Penyerahan', handoffCopy: 'Catat tempat dan masa anda menghantar kes.', recipient: 'Penerima atau saluran', recipientPlaceholder: 'E-mel peniaga, borang platform, atau saluran lain', submissionDate: 'Tarikh penyerahan', reference: 'Rujukan luar', ifProvided: 'Jika diberikan', referencePlaceholder: 'Nombor tiket atau aduan', followUp: 'Susulan seterusnya', optionalReminder: 'Peringatan pilihan', responseTitle: 'Respons', responseCopy: 'Pastikan perkataan peniaga atau penerima direkodkan secara fakta.', responseSummary: 'Ringkasan respons', optional: 'Pilihan', responsePlaceholder: 'Apakah yang penerima katakan atau lakukan?', outcomeTitle: 'Hasil', outcomeCopy: 'Tutup kes hanya apabila hasil luar diketahui.', recordedOutcome: 'Hasil direkodkan', noOutcome: 'Tiada hasil muktamad lagi', resolved: 'Selesai', refund: 'Bayaran balik diterima', replacement: 'Penggantian diterima', repair: 'Pembaikan selesai', delivery: 'Penghantaran selesai', partial: 'Penyelesaian sebahagian diterima', closedWithout: 'Ditutup tanpa penyelesaian diminta', rejected: 'Ditolak', redirected: 'Diarahkan ke tempat lain', withdrawn: 'Ditarik balik oleh saya', unresolved: 'Belum selesai', followUpCopy: 'Ini disimpan sebagai rekod sahaja; prototaip tidak menghantar pemberitahuan.', back: '← Pek', closed: 'Kes ditutup', save: 'Simpan status', saved: 'Status disimpan pada peranti ini.', closedError: 'Hasil yang ditutup tidak boleh kembali kepada keadaan aktif.' },
} as const

function statusLabel(status: SubmissionRecord['status'], locale: Locale) {
  const labels = locale === 'ms'
    ? { ready: 'Sedia', handed_off: 'Diserahkan', awaiting_response: 'Menunggu respons', resolved: 'Selesai', closed: 'Ditutup' }
    : { ready: 'Ready', handed_off: 'Handed off', awaiting_response: 'Awaiting response', resolved: 'Resolved', closed: 'Closed' }
  return labels[status]
}
