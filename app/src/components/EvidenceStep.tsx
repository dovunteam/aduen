import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { addEvidence, deleteEvidence, getEvidenceOriginal, listEvidence, updateEvidenceInclusion } from '../data/evidenceRepository'
import { EVIDENCE_TYPES, formatFileSize } from '../domain/evidence'
import type { EvidenceMetadata, EvidenceType } from '../domain/evidence'
import { scanEvidenceFile } from '../domain/evidenceSafety'
import type { EvidenceRisk } from '../domain/evidenceSafety'
import type { Locale } from '../i18n'
import { TextEvidencePreview } from './TextEvidencePreview'
import { ImageEvidencePreview } from './ImageEvidencePreview'
import { PdfEvidencePreview } from './PdfEvidencePreview'
import { recordAuditEvent } from '../data/auditRepository'

type Props = { locale: Locale; onBack: () => void; onChange: () => void; onContinue: (evidence: EvidenceMetadata[]) => void }

export function EvidenceStep({ locale, onBack, onChange, onContinue }: Props) {
  const text = evidenceText[locale]
  const fileInput = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<EvidenceMetadata[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [sourceType, setSourceType] = useState<EvidenceType>('receipt')
  const [eventDate, setEventDate] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [risks, setRisks] = useState<EvidenceRisk[]>([])
  const [riskAccepted, setRiskAccepted] = useState(false)

  useEffect(() => { listEvidence().then(setItems).catch(() => setError(text.readError)) }, [text.readError])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!file) { setError(text.chooseFirst); return }
    setBusy(true); setError('')
    try {
      const detected = await scanEvidenceFile(file)
      if (detected.length && !riskAccepted) { setRisks(detected); return }
      onChange()
      const saved = await addEvidence(file, { sourceType, eventDate: eventDate || null, description })
      setItems((current) => [saved, ...current]); setFile(null); setEventDate(''); setDescription(''); setRisks([]); setRiskAccepted(false)
      if (fileInput.current) fileInput.current.value = ''
    } catch (cause) { setError(cause instanceof Error ? localizeEvidenceError(cause.message, locale) : text.saveError) }
    finally { setBusy(false) }
  }

  async function toggleInclusion(item: EvidenceMetadata) {
    setBusy(true); setError('')
    try {
      const next = !item.includeInPack
      onChange()
      await updateEvidenceInclusion(item.id, next)
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, includeInPack: next } : entry))
    } catch { setError(text.saveError) }
    finally { setBusy(false) }
  }

  async function remove(item: EvidenceMetadata) {
    if (!window.confirm(text.deleteConfirm(item.fileName))) return
    setBusy(true); setError('')
    try {
      onChange()
      await deleteEvidence(item.id)
      recordAuditEvent('evidence_deleted', item.id, item.fileName)
      setItems((current) => current.filter((entry) => entry.id !== item.id))
    } catch { setError(text.saveError) }
    finally { setBusy(false) }
  }

  async function downloadOriginal(item: EvidenceMetadata) {
    setError('')
    try {
    const original = await getEvidenceOriginal(item.id)
    if (!original) { setError(text.originalMissing(item.fileName)); return }
    const url = URL.createObjectURL(original)
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = item.fileName.replace(/[\\/]/g, '_'); anchor.click()
    recordAuditEvent('evidence_downloaded', item.id, item.fileName)
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch { setError(text.readError) }
  }

  return <section className="page form-page">
    <div className="eyebrow">{text.eyebrow}</div><h1>{text.title}</h1>
    <p className="lede">{text.lede}</p>
    <div className="evidence-warning"><strong>{text.warningTitle}</strong><span>{text.warning}</span></div>

    <form className="evidence-form" onSubmit={submit}>
      <SectionHeading number="01" title={text.addRecord} copy={text.formats} />
      <div className="fields two-col">
        <label className="file-field">{text.originalFile}<input ref={fileInput} required type="file" disabled={busy} accept=".pdf,.jpg,.jpeg,.png,.webp,.txt" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setRisks([]); setRiskAccepted(false) }} /><span>{file ? `${file.name} · ${formatFileSize(file.size)}` : text.chooseFile}</span></label>
        <label>{text.recordKind}<select value={sourceType} onChange={(event) => setSourceType(event.target.value as EvidenceType)}>{EVIDENCE_TYPES.map((type) => <option value={type} key={type}>{evidenceLabel(type, locale)}</option>)}</select></label>
        <label>{text.eventDate} <span className="optional">{text.ifKnown}</span><input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} /></label>
        <label>{text.description} <span className="optional">{text.optional}</span><input value={description} maxLength={240} onChange={(event) => setDescription(event.target.value)} placeholder={text.descriptionPlaceholder} /></label>
      </div>
      {risks.length > 0 && <div className="risk-review" role="alert"><strong>{text.riskTitle}</strong><ul>{risks.map((risk) => <li key={risk.code}>{riskLabel(risk, locale)}</li>)}</ul><p>{text.riskCopy}</p><label><input type="checkbox" checked={riskAccepted} onChange={(event) => setRiskAccepted(event.target.checked)} /> {text.riskConsent}</label></div>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="actions"><button className="primary" type="submit" disabled={busy || (risks.length > 0 && !riskAccepted)}>{busy ? text.saving : text.addEvidence} <span>+</span></button></div>
    </form>

    <div className="evidence-register">
      <SectionHeading number="02" title={text.register} copy={text.recordCount(items.length)} />
      {items.length === 0 ? <div className="empty-state"><strong>{text.emptyTitle}</strong><p>{text.emptyCopy}</p></div> : <div className="evidence-list">{items.map((item) => <article className="evidence-item" key={item.id}>
        <div className="file-icon" aria-hidden="true">DOC</div><div className="evidence-copy"><strong>{item.fileName}</strong><p>{evidenceLabel(item.sourceType, locale)} · {formatFileSize(item.size)}{item.eventDate ? ` · ${item.eventDate}` : ` · ${text.dateUnknown}`}</p>{item.description && <p className="evidence-description">{item.description}</p>}<code title={item.sha256}>SHA-256 {item.sha256.slice(0, 12)}…</code></div>
        <div className="evidence-controls"><label><input type="checkbox" disabled={busy} checked={item.includeInPack} onChange={() => toggleInclusion(item)} /> {text.include}</label><button className="download-link" type="button" onClick={() => void downloadOriginal(item)}>{text.download}</button><button type="button" disabled={busy} onClick={() => void remove(item)}>{text.delete}</button></div>
        {item.mimeType === 'text/plain' && <div style={{ gridColumn: '2 / -1' }}><TextEvidencePreview evidenceId={item.id} locale={locale} /></div>}
        {['image/jpeg', 'image/png', 'image/webp'].includes(item.mimeType) && <div style={{ gridColumn: '2 / -1' }}><ImageEvidencePreview evidenceId={item.id} fileName={item.fileName} locale={locale} /></div>}
        {item.mimeType === 'application/pdf' && <div style={{ gridColumn: '2 / -1' }}><PdfEvidencePreview evidenceId={item.id} locale={locale} /></div>}
      </article>)}</div>}
    </div>
    <div className="actions split"><button className="secondary" disabled={busy} onClick={onBack}>{text.back}</button><button className="primary" disabled={items.length === 0 || busy} onClick={() => onContinue(items)}>{text.review} <span>→</span></button></div>
  </section>
}

function SectionHeading({ number, title, copy }: { number: string; title: string; copy: string }) {
  return <div className="section-title"><span>{number}</span><div><h2>{title}</h2><p>{copy}</p></div></div>
}

const evidenceText = {
  en: {
    eyebrow: 'Evidence', title: 'Keep the originals.', lede: 'Add the records that show the transaction, promise, problem, and your attempts to resolve it. Every original stays separate from its description.', warningTitle: 'Check before adding a file.', warning: 'Remove passwords, PINs, OTPs, recovery codes, full card numbers, unrelated transactions, and unnecessary third-party details.',
    addRecord: 'Add one record', formats: 'PDF, JPG, PNG, WebP, or text — up to 10 MB.', originalFile: 'Original file', chooseFile: 'Choose a file from this device', recordKind: 'What kind of record?', eventDate: 'Event date', ifKnown: 'If known', description: 'Description', optional: 'Optional', descriptionPlaceholder: 'What this file shows', riskTitle: 'Review sensitive content before saving.', riskCopy: 'Buktiva does not remove or alter content automatically. Redact the original outside Buktiva where appropriate, or confirm that this file is necessary.', riskConsent: 'I reviewed these warnings and still need to include this original.', saving: 'Checking and saving…', addEvidence: 'Add evidence', register: 'Evidence register', recordCount: (count: number) => `${count} ${count === 1 ? 'record' : 'records'} stored on this device.`, emptyTitle: 'No evidence added yet.', emptyCopy: 'Add at least the order or payment record before continuing.', dateUnknown: 'Date unknown', include: 'Include in pack', download: 'Download original', delete: 'Delete', back: '← Case details', review: 'Review case', readError: 'Stored evidence could not be read on this device.', chooseFirst: 'Choose an evidence file first.', saveError: 'The evidence could not be saved.', deleteConfirm: (fileName: string) => `Delete “${fileName}” from this case? This cannot be undone.`, originalMissing: (fileName: string) => `The original for “${fileName}” could not be found.`,
  },
  ms: {
    eyebrow: 'Bukti', title: 'Simpan yang asal.', lede: 'Tambah rekod yang menunjukkan transaksi, janji, masalah, dan usaha anda untuk menyelesaikannya. Setiap fail asal kekal berasingan daripada keterangannya.', warningTitle: 'Semak sebelum menambah fail.', warning: 'Buang kata laluan, PIN, OTP, kod pemulihan, nombor kad penuh, transaksi yang tidak berkaitan, dan butiran pihak ketiga yang tidak perlu.',
    addRecord: 'Tambah satu rekod', formats: 'PDF, JPG, PNG, WebP, atau teks — sehingga 10 MB.', originalFile: 'Fail asal', chooseFile: 'Pilih fail daripada peranti ini', recordKind: 'Apakah jenis rekod?', eventDate: 'Tarikh peristiwa', ifKnown: 'Jika diketahui', description: 'Keterangan', optional: 'Pilihan', descriptionPlaceholder: 'Perkara yang ditunjukkan oleh fail ini', riskTitle: 'Semak kandungan sensitif sebelum menyimpan.', riskCopy: 'Buktiva tidak membuang atau mengubah kandungan secara automatik. Padamkan maklumat daripada fail asal di luar Buktiva jika sesuai, atau sahkan bahawa fail ini diperlukan.', riskConsent: 'Saya telah menyemak amaran ini dan masih perlu menyertakan fail asal ini.', saving: 'Menyemak dan menyimpan…', addEvidence: 'Tambah bukti', register: 'Daftar bukti', recordCount: (count: number) => `${count} rekod disimpan pada peranti ini.`, emptyTitle: 'Tiada bukti ditambah lagi.', emptyCopy: 'Tambah sekurang-kurangnya rekod pesanan atau pembayaran sebelum meneruskan.', dateUnknown: 'Tarikh tidak diketahui', include: 'Sertakan dalam pek', download: 'Muat turun fail asal', delete: 'Padam', back: '← Butiran kes', review: 'Semak kes', readError: 'Bukti yang disimpan tidak dapat dibaca pada peranti ini.', chooseFirst: 'Pilih fail bukti terlebih dahulu.', saveError: 'Bukti tidak dapat disimpan.', deleteConfirm: (fileName: string) => `Padam “${fileName}” daripada kes ini? Tindakan ini tidak boleh dibatalkan.`, originalMissing: (fileName: string) => `Fail asal untuk “${fileName}” tidak ditemui.`,
  },
} as const

function evidenceLabel(type: EvidenceType, locale: Locale) {
  const labels = locale === 'ms'
    ? { receipt: 'Resit atau pesanan', listing: 'Iklan atau janji', payment: 'Rekod pembayaran', delivery: 'Rekod penghantaran', message: 'Mesej atau hubungan', merchant_response: 'Respons peniaga', other: 'Bukti lain' }
    : { receipt: 'Receipt or order', listing: 'Listing or promise', payment: 'Payment record', delivery: 'Delivery record', message: 'Message or contact', merchant_response: 'Merchant response', other: 'Other evidence' }
  return labels[type]
}

function riskLabel(risk: EvidenceRisk, locale: Locale) {
  if (locale === 'en') return risk.message
  return ({ card_number: 'Nombor kad pembayaran penuh mungkin terdapat dalam fail ini.', authentication_secret: 'Fail ini menyebut kata laluan, PIN, OTP, kod pemulihan, atau rahsia serupa.', identity_number: 'Fail ini mungkin mengandungi nombor dokumen pengenalan.', third_party_data: 'Fail ini nampaknya menyebut maklumat orang lain. Semak sama ada ia perlu disertakan.', binary_unscanned: 'Imej atau PDF ini tidak diimbas untuk kandungan sensitif. Semak secara manual sebelum menyimpan atau berkongsi.' } as const)[risk.code]
}

function localizeEvidenceError(message: string, locale: Locale) {
  if (locale === 'en') return message
  return ({ 'The selected file is empty.': 'Fail yang dipilih kosong.', 'The file is larger than the 10 MB prototype limit.': 'Fail melebihi had prototaip 10 MB.', 'Use a PDF, JPG, PNG, WebP, or plain-text file.': 'Gunakan fail PDF, JPG, PNG, WebP, atau teks biasa.', 'The file contents do not match the selected file type.': 'Kandungan fail tidak sepadan dengan jenis fail yang dipilih.' } as Record<string, string>)[message] ?? message
}
