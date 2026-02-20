import { useState } from 'react'
import { reviewExtractionCandidate } from '../data/evidenceRepository'
import type { EvidenceExtraction, ExtractionCandidate } from '../domain/extraction'
import { isValidCandidateValue } from '../domain/extraction'
import type { EvidenceMetadata } from '../domain/evidence'
import type { Locale } from '../i18n'

type Props = { locale: Locale; initialExtractions: EvidenceExtraction[]; evidence: EvidenceMetadata[]; onBack: () => void; onContinue: (records: EvidenceExtraction[]) => void }

export function ExtractionStep({ locale, initialExtractions, evidence, onBack, onContinue }: Props) {
  const text = extractionText[locale]
  const [records, setRecords] = useState(initialExtractions)
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const candidates = records.flatMap((record) => record.candidates.map((item) => ({ record, item })))
  const pending = candidates.filter(({ item }) => item.status === 'unconfirmed').length
  const extractorVersions = [...new Set(records.map((record) => record.extractorVersion))]
  const fileName = (evidenceId: string) => evidence.find((item) => item.id === evidenceId)?.fileName ?? text.evidenceFile

  async function decide(record: EvidenceExtraction, item: ExtractionCandidate, status: ExtractionCandidate['status']) {
    setBusyId(item.id)
    setError('')
    if (status === 'confirmed' && !isValidCandidateValue(item.field, (edits[item.id] ?? item.value).trim())) {
      setError(locale === 'ms' ? 'Masukkan jumlah dengan maksimum dua tempat perpuluhan, tarikh sah (YYYY-MM-DD), rujukan yang tidak kosong, nama, atau penyelesaian yang sah.' : 'Enter an amount with up to two decimal places, a valid date (YYYY-MM-DD), a non-empty reference, a name, or a valid remedy.')
      setBusyId(''); return
    }
    try {
      if (status === 'unconfirmed') setEdits((current) => ({ ...current, [item.id]: item.confirmedValue ?? item.value }))
      const updated = await reviewExtractionCandidate(record.id, item.id, status, edits[item.id])
      setRecords((current) => current.map((entry) => entry.id === updated.id ? updated : entry))
    } catch { setError(locale === 'ms' ? 'Keputusan tidak dapat disimpan. Cuba lagi.' : 'Your decision could not be saved. Please retry.') }
    finally { setBusyId('') }
  }

  return <section className="page form-page extraction-page">
    <div className="eyebrow">{text.eyebrow}</div><h1>{text.title}</h1>
    <p className="lede">{text.lede}</p>
    <div className="extraction-summary"><div><strong>{candidates.length}</strong><span>{text.candidates}</span></div><div><strong>{pending}</strong><span>{text.awaiting}</span></div><div><strong>{extractorVersions.join(', ') || 'plain-text-v4'}</strong><span>{text.version}</span></div></div>
    <div className="candidate-list">{candidates.map(({ record, item }) => <article className={`candidate ${item.status}`} key={item.id}>
      <div className="candidate-meta"><span>{fieldLabel(item.field, locale)}</span><strong>{fileName(record.evidenceId)}</strong><small>{record.extractorVersion} · {Math.round(item.confidence * 100)}% {text.confidence}</small></div>
      <div className="candidate-value"><label>{text.candidateValue}<input value={edits[item.id] ?? item.confirmedValue ?? item.value} disabled={item.status !== 'unconfirmed'} onChange={(event) => setEdits((current) => ({ ...current, [item.id]: event.target.value }))} /></label><blockquote>“…{item.sourceExcerpt}…”</blockquote>{item.status !== 'unconfirmed' && <p className="decision-label">{item.status === 'confirmed' ? text.confirmed(item.confirmedValue ?? item.value) : text.rejected}</p>}</div>
      <div className="candidate-actions"><button type="button" disabled={item.status !== 'unconfirmed' || busyId === item.id} onClick={() => void decide(record, item, 'confirmed')}>{text.confirm}{edits[item.id] && edits[item.id] !== item.value ? text.correction : ''}</button><button type="button" disabled={item.status !== 'unconfirmed' || busyId === item.id} onClick={() => void decide(record, item, 'rejected')}>{text.reject}</button></div>
      {item.status !== 'unconfirmed' && <button type="button" disabled={busyId === item.id} onClick={() => void decide(record, item, 'unconfirmed')}>{locale === 'ms' ? 'Semak semula keputusan' : 'Review decision again'}</button>}
      {!!item.reviewHistory?.length && <details><summary>{locale === 'ms' ? 'Sejarah keputusan' : 'Decision history'}</summary><ol>{item.reviewHistory.map((entry, index) => <li key={index}>{new Date(entry.at).toLocaleString(locale === 'ms' ? 'ms-MY' : 'en-MY')} · {entry.previousStatus}: {entry.previousValue ?? '—'} → {entry.status}: {entry.value ?? '—'}</li>)}</ol></details>}
    </article>)}</div>
    {error && <p role="alert" className="form-error">{error}</p>}
    <div className="privacy-line"><strong>{text.privacyLead}</strong> {text.privacy}</div>
    <div className="actions split"><button className="secondary" onClick={onBack}>{text.back}</button><button className="primary" disabled={pending > 0} onClick={() => onContinue(records)}>{text.continue} <span>→</span></button></div>
  </section>
}

const extractionText = {
  en: { eyebrow: 'Extracted-fact confirmation', title: 'Check every candidate.', lede: 'Aduen finds possible facts in plain text and searchable PDFs. Images and scanned PDF pages are read with on-device English and Bahasa Malaysia OCR. OCR can be wrong or miss content. Candidates are suggestions—not case facts—until you confirm or correct them.', candidates: 'candidates found', awaiting: 'awaiting your decision', version: 'extractor versions', evidenceFile: 'Evidence file', confidence: 'pattern confidence · unverified', candidateValue: 'Candidate value', confirmed: (value: string) => `Confirmed as ${value}`, rejected: 'Rejected — not used as a fact', confirm: 'Confirm', correction: ' correction', reject: 'Reject', privacyLead: 'Originals are unchanged.', privacy: 'Your decision is stored on the derived candidate with both the extracted value and any corrected value retained.', back: '← Evidence', continue: 'Continue to Aduen Check' },
  ms: { eyebrow: 'Pengesahan fakta diekstrak', title: 'Semak setiap calon.', lede: 'Aduen mencari kemungkinan fakta dalam teks biasa dan PDF yang boleh dicari. Imej dan halaman PDF yang diimbas dibaca dengan OCR Bahasa Malaysia dan Inggeris pada peranti ini. OCR boleh tersilap atau terlepas kandungan. Calon ialah cadangan—bukan fakta kes—sehingga anda mengesahkan atau membetulkannya.', candidates: 'calon ditemui', awaiting: 'menunggu keputusan anda', version: 'versi pengekstrak', evidenceFile: 'Fail bukti', confidence: 'keyakinan corak · belum disahkan', candidateValue: 'Nilai calon', confirmed: (value: string) => `Disahkan sebagai ${value}`, rejected: 'Ditolak — tidak digunakan sebagai fakta', confirm: 'Sahkan', correction: ' pembetulan', reject: 'Tolak', privacyLead: 'Fail asal tidak berubah.', privacy: 'Keputusan anda disimpan pada calon terbitan dengan nilai yang diekstrak dan sebarang nilai yang dibetulkan dikekalkan.', back: '← Bukti', continue: 'Teruskan ke Semakan Aduen' },
} as const

function fieldLabel(field: ExtractionCandidate['field'], locale: Locale) {
  const labels = locale === 'ms' ? { amount: 'Jumlah', date: 'Tarikh', reference: 'Rujukan', remedy: 'Penyelesaian', name: 'Nama' } : { amount: 'Amount', date: 'Date', reference: 'Reference', remedy: 'Remedy', name: 'Name' }
  return labels[field]
}
