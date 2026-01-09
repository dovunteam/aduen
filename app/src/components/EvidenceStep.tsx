import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { addEvidence, deleteEvidence, listEvidence, updateEvidenceInclusion } from '../data/evidenceRepository'
import { EVIDENCE_TYPES, evidenceTypeLabel, formatFileSize } from '../domain/evidence'
import type { EvidenceMetadata, EvidenceType } from '../domain/evidence'

type Props = { onBack: () => void; onContinue: (evidence: EvidenceMetadata[]) => void }

export function EvidenceStep({ onBack, onContinue }: Props) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<EvidenceMetadata[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [sourceType, setSourceType] = useState<EvidenceType>('receipt')
  const [eventDate, setEventDate] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { listEvidence().then(setItems).catch(() => setError('Stored evidence could not be read on this device.')) }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!file) { setError('Choose an evidence file first.'); return }
    setBusy(true); setError('')
    try {
      const saved = await addEvidence(file, { sourceType, eventDate: eventDate || null, description })
      setItems((current) => [saved, ...current]); setFile(null); setEventDate(''); setDescription('')
      if (fileInput.current) fileInput.current.value = ''
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The evidence could not be saved.') }
    finally { setBusy(false) }
  }

  async function toggleInclusion(item: EvidenceMetadata) {
    const next = !item.includeInPack
    await updateEvidenceInclusion(item.id, next)
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, includeInPack: next } : entry))
  }

  async function remove(item: EvidenceMetadata) {
    if (!window.confirm(`Delete “${item.fileName}” from this case? This cannot be undone.`)) return
    await deleteEvidence(item.id)
    setItems((current) => current.filter((entry) => entry.id !== item.id))
  }

  return <section className="page form-page">
    <div className="eyebrow">Evidence</div><h1>Keep the originals.</h1>
    <p className="lede">Add the records that show the transaction, promise, problem, and your attempts to resolve it. Every original stays separate from its description.</p>
    <div className="evidence-warning"><strong>Check before adding a file.</strong><span>Remove passwords, PINs, OTPs, recovery codes, full card numbers, unrelated transactions, and unnecessary third-party details.</span></div>

    <form className="evidence-form" onSubmit={submit}>
      <SectionHeading number="01" title="Add one record" copy="PDF, JPG, PNG, WebP, or text — up to 10 MB." />
      <div className="fields two-col">
        <label className="file-field">Original file<input ref={fileInput} required type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.txt" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><span>{file ? `${file.name} · ${formatFileSize(file.size)}` : 'Choose a file from this device'}</span></label>
        <label>What kind of record?<select value={sourceType} onChange={(event) => setSourceType(event.target.value as EvidenceType)}>{EVIDENCE_TYPES.map((type) => <option value={type} key={type}>{evidenceTypeLabel(type)}</option>)}</select></label>
        <label>Event date <span className="optional">If known</span><input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} /></label>
        <label>Description <span className="optional">Optional</span><input value={description} maxLength={240} onChange={(event) => setDescription(event.target.value)} placeholder="What this file shows" /></label>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="actions"><button className="primary" type="submit" disabled={busy}>{busy ? 'Checking and saving…' : 'Add evidence'} <span>+</span></button></div>
    </form>

    <div className="evidence-register">
      <SectionHeading number="02" title="Evidence register" copy={`${items.length} ${items.length === 1 ? 'record' : 'records'} stored on this device.`} />
      {items.length === 0 ? <div className="empty-state"><strong>No evidence added yet.</strong><p>Add at least the order or payment record before continuing.</p></div> : <div className="evidence-list">{items.map((item) => <article className="evidence-item" key={item.id}>
        <div className="file-icon" aria-hidden="true">DOC</div><div className="evidence-copy"><strong>{item.fileName}</strong><p>{evidenceTypeLabel(item.sourceType)} · {formatFileSize(item.size)}{item.eventDate ? ` · ${item.eventDate}` : ' · Date unknown'}</p>{item.description && <p className="evidence-description">{item.description}</p>}<code title={item.sha256}>SHA-256 {item.sha256.slice(0, 12)}…</code></div>
        <div className="evidence-controls"><label><input type="checkbox" checked={item.includeInPack} onChange={() => toggleInclusion(item)} /> Include in pack</label><button type="button" onClick={() => remove(item)}>Delete</button></div>
      </article>)}</div>}
    </div>
    <div className="actions split"><button className="secondary" onClick={onBack}>← Case details</button><button className="primary" disabled={items.length === 0} onClick={() => onContinue(items)}>Review case <span>→</span></button></div>
  </section>
}

function SectionHeading({ number, title, copy }: { number: string; title: string; copy: string }) {
  return <div className="section-title"><span>{number}</span><div><h2>{title}</h2><p>{copy}</p></div></div>
}
