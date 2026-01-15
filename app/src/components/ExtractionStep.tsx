import { useState } from 'react'
import { reviewExtractionCandidate } from '../data/evidenceRepository'
import type { EvidenceExtraction, ExtractionCandidate } from '../domain/extraction'
import type { EvidenceMetadata } from '../domain/evidence'

type Props = { initialExtractions: EvidenceExtraction[]; evidence: EvidenceMetadata[]; onBack: () => void; onContinue: (records: EvidenceExtraction[]) => void }

export function ExtractionStep({ initialExtractions, evidence, onBack, onContinue }: Props) {
  const [records, setRecords] = useState(initialExtractions)
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState('')
  const candidates = records.flatMap((record) => record.candidates.map((item) => ({ record, item })))
  const pending = candidates.filter(({ item }) => item.status === 'unconfirmed').length
  const fileName = (evidenceId: string) => evidence.find((item) => item.id === evidenceId)?.fileName ?? 'Evidence file'

  async function decide(record: EvidenceExtraction, item: ExtractionCandidate, status: 'confirmed' | 'rejected') {
    setBusyId(item.id)
    try {
      const updated = await reviewExtractionCandidate(record.id, item.id, status, edits[item.id])
      setRecords((current) => current.map((entry) => entry.id === updated.id ? updated : entry))
    } finally { setBusyId('') }
  }

  return <section className="page form-page extraction-page">
    <div className="eyebrow">Extracted-fact confirmation</div><h1>Check every candidate.</h1>
    <p className="lede">Tuntiva found possible facts in plain-text evidence. They are derived suggestions—not case facts—until you confirm or correct them.</p>
    <div className="extraction-summary"><div><strong>{candidates.length}</strong><span>candidates found</span></div><div><strong>{pending}</strong><span>awaiting your decision</span></div><div><strong>plain-text-v1</strong><span>extractor version</span></div></div>
    <div className="candidate-list">{candidates.map(({ record, item }) => <article className={`candidate ${item.status}`} key={item.id}>
      <div className="candidate-meta"><span>{item.field}</span><strong>{fileName(record.evidenceId)}</strong><small>{Math.round(item.confidence * 100)}% pattern confidence · unverified</small></div>
      <div className="candidate-value"><label>Candidate value<input value={edits[item.id] ?? item.confirmedValue ?? item.value} disabled={item.status !== 'unconfirmed'} onChange={(event) => setEdits((current) => ({ ...current, [item.id]: event.target.value }))} /></label><blockquote>“…{item.sourceExcerpt}…”</blockquote>{item.status !== 'unconfirmed' && <p className="decision-label">{item.status === 'confirmed' ? `Confirmed as ${item.confirmedValue}` : 'Rejected — not used as a fact'}</p>}</div>
      <div className="candidate-actions"><button type="button" disabled={item.status !== 'unconfirmed' || busyId === item.id} onClick={() => void decide(record, item, 'confirmed')}>Confirm{edits[item.id] && edits[item.id] !== item.value ? ' correction' : ''}</button><button type="button" disabled={item.status !== 'unconfirmed' || busyId === item.id} onClick={() => void decide(record, item, 'rejected')}>Reject</button></div>
    </article>)}</div>
    <div className="privacy-line"><strong>Originals are unchanged.</strong> Your decision is stored on the derived candidate with both the extracted value and any corrected value retained.</div>
    <div className="actions split"><button className="secondary" onClick={onBack}>← Evidence</button><button className="primary" disabled={pending > 0} onClick={() => onContinue(records)}>Continue to Tuntiva Check <span>→</span></button></div>
  </section>
}
