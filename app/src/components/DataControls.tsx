import { useEffect, useState } from 'react'
import type { CaseDraft } from '../domain/case'
import { listEvidence } from '../data/evidenceRepository'
import { readSubmission } from '../data/statusRepository'

type Props = { draft: CaseDraft; onBack: () => void; onDelete: () => Promise<void> }

export function DataControls({ draft, onBack, onDelete }: Props) {
  const [evidenceCount, setEvidenceCount] = useState(0)
  const [exporting, setExporting] = useState(false)
  const hasDraft = Boolean(draft.seller || draft.purchaseDate || draft.amount)
  useEffect(() => { listEvidence().then((items) => setEvidenceCount(items.length)).catch(() => setEvidenceCount(0)) }, [])

  async function exportData() {
    setExporting(true)
    try { const { downloadCaseArchive } = await import('../data/caseArchive'); await downloadCaseArchive(draft, readSubmission()) }
    finally { setExporting(false) }
  }

  async function deleteData() {
    if (!window.confirm('Delete the case draft, every evidence original, and its status record from this browser? This cannot be undone.')) return
    await onDelete()
  }

  return <section className="page narrow-page data-page">
    <div className="eyebrow">Privacy controls</div><h1>Your data stays<br />under your control.</h1>
    <p className="lede">This prototype stores information only in this browser. It has no account, cloud sync, analytics, or remote evidence processing.</p>
    <div className="data-inventory"><div><span>Case draft</span><strong>{hasDraft ? '1 saved' : 'None'}</strong></div><div><span>Evidence originals</span><strong>{evidenceCount}</strong></div><div><span>Storage</span><strong>This browser</strong></div></div>
    <section className="data-action"><div><h2>Export the complete case</h2><p>Download a ZIP containing the structured case record, evidence metadata and hashes, submission status, and every original evidence file.</p></div><button className="primary" disabled={!hasDraft || exporting} onClick={exportData}>{exporting ? 'Preparing archive…' : 'Export ZIP'} <span>↓</span></button></section>
    <section className="data-action destructive"><div><h2>Delete local case data</h2><p>Permanently removes the draft, evidence metadata, evidence originals, and status record from this browser.</p></div><button className="danger-button" disabled={!hasDraft && evidenceCount === 0} onClick={deleteData}>Delete all case data</button></section>
    <div className="actions split"><button className="secondary" onClick={onBack}>← Return to case</button></div>
  </section>
}
