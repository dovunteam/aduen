import { useState } from 'react'
import type { FormEvent } from 'react'
import { readSubmission, saveSubmission } from '../data/statusRepository'
import { nextStatus, validateStatusTransition } from '../domain/status'
import type { SubmissionRecord } from '../domain/status'
import type { CaseRecordStatus } from '../domain/case'

export function StatusStep({ onBack, onStatusChange }: { onBack: () => void; onStatusChange: (status: CaseRecordStatus) => void }) {
  const [record, setRecord] = useState<SubmissionRecord>(readSubmission)
  const [message, setMessage] = useState('')
  const terminal = record.status === 'resolved' || record.status === 'closed'

  function update<K extends keyof SubmissionRecord>(key: K, value: SubmissionRecord[K]) { setRecord((current) => ({ ...current, [key]: value })) }
  function submit(event: FormEvent) {
    event.preventDefault(); setMessage('')
    const status = nextStatus(record)
    if (!validateStatusTransition(record.status, status)) { setMessage('A closed outcome cannot return to an active state.'); return }
    const saved = saveSubmission({ ...record, status }); setRecord(saved); onStatusChange(status === 'ready' ? 'approved' : status); setMessage('Status saved on this device.')
  }

  return <section className="page form-page status-page">
    <div className="status-heading"><div><div className="eyebrow">Buktiva Status</div><h1>Record what happens next.</h1><p className="lede">Buktiva does not monitor the merchant or submit on your behalf. Add external events here so the case record remains complete.</p></div><div className={`status-badge ${record.status}`}><span>Current status</span><strong>{record.status.replaceAll('_', ' ')}</strong></div></div>
    <form onSubmit={submit}>
      <div className="form-section"><SectionTitle number="01" title="Handoff" copy="Record where and when you sent the case." /><div className="fields two-col"><label>Recipient or channel<input disabled={terminal} required value={record.channel} onChange={(event) => update('channel', event.target.value)} placeholder="Merchant email, platform form, or other channel" /></label><label>Submission date<input disabled={terminal} required type="date" value={record.submissionDate} onChange={(event) => update('submissionDate', event.target.value)} /></label><label>External reference <span className="optional">If provided</span><input disabled={terminal} value={record.referenceNumber} onChange={(event) => update('referenceNumber', event.target.value)} placeholder="Ticket or complaint number" /></label><label>Next follow-up <span className="optional">Optional reminder</span><input disabled={terminal} type="date" min={record.submissionDate || undefined} value={record.nextFollowUpDate} onChange={(event) => update('nextFollowUpDate', event.target.value)} /></label></div></div>
      <div className="form-section"><SectionTitle number="02" title="Response" copy="Keep the merchant or recipient's wording factual." /><div className="fields"><label>Response summary <span className="optional">Optional</span><textarea disabled={terminal} value={record.response} maxLength={1200} onChange={(event) => update('response', event.target.value)} placeholder="What did the recipient say or do?" /></label></div></div>
      <div className="form-section"><SectionTitle number="03" title="Outcome" copy="Close the case only when the external result is known." /><div className="fields"><label>Recorded outcome<select disabled={terminal} value={record.outcome} onChange={(event) => update('outcome', event.target.value as SubmissionRecord['outcome'])}><option value="">No final outcome yet</option><optgroup label="Resolved"><option value="refund">Refund received</option><option value="replacement">Replacement received</option><option value="repair">Repair completed</option><option value="delivery">Delivery completed</option><option value="partial">Partial remedy received</option></optgroup><optgroup label="Closed without requested remedy"><option value="rejected">Rejected</option><option value="redirected">Redirected elsewhere</option><option value="withdrawn">Withdrawn by me</option><option value="unresolved">Unresolved</option></optgroup></select></label></div></div>
      {record.nextFollowUpDate && !terminal && <div className="follow-up"><span>Next follow-up</span><strong>{new Date(`${record.nextFollowUpDate}T00:00:00`).toLocaleDateString('en-MY', { day: '2-digit', month: 'long', year: 'numeric' })}</strong><p>This is stored as a record only; the prototype does not send notifications.</p></div>}
      {message && <p className="save-message" role="status">{message}</p>}
      <div className="actions split"><button type="button" className="secondary" onClick={onBack}>← Pack</button><button className="primary" disabled={terminal} type="submit">{terminal ? 'Case closed' : 'Save status'} <span>→</span></button></div>
    </form>
  </section>
}

function SectionTitle({ number, title, copy }: { number: string; title: string; copy: string }) { return <div className="section-title"><span>{number}</span><div><h2>{title}</h2><p>{copy}</p></div></div> }
