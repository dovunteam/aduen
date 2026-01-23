import { useEffect, useState } from 'react'
import type { CaseDraft } from '../domain/case'
import { listEvidence } from '../data/evidenceRepository'
import { readSubmission } from '../data/statusRepository'
import type { Locale } from '../i18n'

type Props = { locale: Locale; draft: CaseDraft; onBack: () => void; onDelete: () => Promise<void> }

export function DataControls({ locale, draft, onBack, onDelete }: Props) {
  const text = dataText[locale]
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
    await onDelete()
  }

  return <section className="page narrow-page data-page">
    <div className="eyebrow">{text.eyebrow}</div><h1>{text.title}</h1>
    <p className="lede">{text.lede}</p>
    <div className="data-inventory"><div><span>{text.caseDraft}</span><strong>{hasDraft ? text.saved : text.none}</strong></div><div><span>{text.evidence}</span><strong>{evidenceCount}</strong></div><div><span>{text.storage}</span><strong>{text.browser}</strong></div></div>
    <section className="data-action"><div><h2>{text.exportTitle}</h2><p>{text.exportCopy}</p></div><button className="primary" disabled={!hasDraft || exporting} onClick={exportData}>{exporting ? text.preparing : text.export} <span>↓</span></button></section>
    <section className="data-action destructive"><div><h2>{text.deleteTitle}</h2><p>{text.deleteCopy}</p></div><button className="danger-button" disabled={!hasDraft && evidenceCount === 0} onClick={deleteData}>{text.delete}</button></section>
    <div className="actions split"><button className="secondary" onClick={onBack}>{text.back}</button></div>
  </section>
}

const dataText = {
  en: { eyebrow: 'Privacy controls', title: <>Your data stays<br />under your control.</>, lede: 'This prototype stores information only in this browser. It has no account, cloud sync, analytics, or remote evidence processing.', caseDraft: 'Case draft', saved: '1 saved', none: 'None', evidence: 'Evidence originals', storage: 'Storage', browser: 'This browser', exportTitle: 'Export the complete case', exportCopy: 'Download a ZIP containing the structured case record, evidence metadata and hashes, submission status, and every original evidence file.', preparing: 'Preparing archive…', export: 'Export ZIP', deleteTitle: 'Delete local case data', deleteCopy: 'Permanently removes the draft, evidence metadata, evidence originals, and status record from this browser.', delete: 'Delete all case data', back: '← Return to case', deleteConfirm: 'Delete the case draft, every evidence original, and its status record from this browser? This cannot be undone.' },
  ms: { eyebrow: 'Kawalan privasi', title: <>Data anda kekal<br />di bawah kawalan anda.</>, lede: 'Prototaip ini menyimpan maklumat hanya dalam pelayar ini. Ia tidak mempunyai akaun, penyegerakan awan, analitik, atau pemprosesan bukti jauh.', caseDraft: 'Draf kes', saved: '1 disimpan', none: 'Tiada', evidence: 'Fail asal bukti', storage: 'Storan', browser: 'Pelayar ini', exportTitle: 'Eksport kes lengkap', exportCopy: 'Muat turun ZIP yang mengandungi rekod kes berstruktur, metadata dan cincangan bukti, status penyerahan, serta setiap fail bukti asal.', preparing: 'Menyediakan arkib…', export: 'Eksport ZIP', deleteTitle: 'Padam data kes setempat', deleteCopy: 'Memadam draf, metadata bukti, fail asal bukti, dan rekod status daripada pelayar ini secara kekal.', delete: 'Padam semua data kes', back: '← Kembali ke kes', deleteConfirm: 'Padam draf kes, setiap fail asal bukti, dan rekod status daripada pelayar ini? Tindakan ini tidak boleh dibatalkan.' },
} as const
