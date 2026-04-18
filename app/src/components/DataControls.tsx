import { useEffect, useState } from 'react'
import type { CaseDraft } from '../domain/case'
import { listEvidence } from '../data/evidenceRepository'
import { readSubmission } from '../data/statusRepository'
import { readCase } from '../data/caseRepository'
import { readConsent } from '../data/consentRepository'
import { listPacks } from '../data/packRepository'
import type { Locale } from '../i18n'

type Props = { locale: Locale; draft: CaseDraft; onBack: () => void; onDelete: () => Promise<void> }

export function DataControls({ locale, draft, onBack, onDelete }: Props) {
  const text = dataText[locale]
  const [evidenceCount, setEvidenceCount] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [inventoryFailed, setInventoryFailed] = useState(false)
  const hasDraft = Boolean(readCase()) || Object.entries(draft).some(([key, value]) => key !== 'currency' && Boolean(value))
  const hasData = hasDraft || evidenceCount > 0 || Boolean(readConsent()) || listPacks().length > 0 || Boolean(readSubmission().updatedAt)
  useEffect(() => { listEvidence().then((items) => setEvidenceCount(items.length)).catch(() => setInventoryFailed(true)) }, [])

  async function exportData() {
    setExporting(true); setError('')
    try { const { downloadCaseArchive } = await import('../data/caseArchive'); await downloadCaseArchive(draft, readSubmission()) }
    catch { setError(locale === 'ms' ? 'Eksport gagal. Fail asal mungkin hilang, rosak, atau tidak dapat dibaca. Data kes tidak berubah. Semak bukti dan cuba lagi.' : 'Export failed. An original may be missing, damaged, or unreadable. Your case data has not changed. Check the evidence and retry.') }
    finally { setExporting(false) }
  }

  async function deleteData() {
    setDeleting(true); setError('')
    try { await onDelete() }
    catch { setError(locale === 'ms' ? 'Pemadaman tidak selesai. Data mungkin masih disimpan. Cuba lagi.' : 'Deletion did not complete. Some data may remain stored. Please retry.') }
    finally { setDeleting(false) }
  }

  return <section className="page narrow-page data-page">
    <div className="eyebrow">{text.eyebrow}</div><h1>{text.title}</h1>
    <p className="lede">{text.lede}</p>
    <div className="data-inventory"><div><span>{text.caseDraft}</span><strong>{hasDraft ? text.saved : text.none}</strong></div><div><span>{text.evidence}</span><strong>{inventoryFailed ? (locale === 'ms' ? 'Tidak tersedia' : 'Unavailable') : evidenceCount}</strong></div><div><span>{text.storage}</span><strong>{text.browser}</strong></div></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <section className="data-action"><div><h2>{text.exportTitle}</h2><p>{text.exportCopy}</p></div><button className="primary" disabled={(!hasData && !inventoryFailed) || exporting || deleting} onClick={exportData}>{exporting ? text.preparing : text.export} <span>↓</span></button></section>
    <section className="data-action destructive"><div><h2>{text.deleteTitle}</h2><p>{text.deleteCopy}</p></div><button className="danger-button" disabled={(!hasData && !inventoryFailed) || deleting || exporting} onClick={deleteData}>{text.delete}</button></section>
    <div className="actions split"><button className="secondary" onClick={onBack}>{text.back}</button></div>
  </section>
}

const dataText = {
  en: { eyebrow: 'Privacy controls', title: <>Your data stays<br />under your control.</>, lede: 'This prototype stores information only in this browser. It has no account, cloud sync, analytics, or remote evidence processing.', caseDraft: 'Case draft', saved: '1 saved', none: 'None', evidence: 'Evidence originals', storage: 'Storage', browser: 'This browser', exportTitle: 'Export the complete case', exportCopy: 'Download a ZIP containing the structured case record, evidence metadata and hashes, submission status, and every original evidence file.', preparing: 'Preparing archive…', export: 'Export ZIP', deleteTitle: 'Delete local case data', deleteCopy: 'Permanently removes the draft, evidence metadata, evidence originals, and status record from this browser.', delete: 'Delete all case data', back: '← Return to case', deleteConfirm: 'Delete the case draft, every evidence original, and its status record from this browser? This cannot be undone.' },
  ms: { eyebrow: 'Kawalan privasi', title: <>Data anda kekal<br />di bawah kawalan anda.</>, lede: 'Prototaip ini menyimpan maklumat hanya dalam pelayar ini. Ia tidak mempunyai akaun, penyegerakan awan, analitik, atau pemprosesan bukti jauh.', caseDraft: 'Draf kes', saved: '1 disimpan', none: 'Tiada', evidence: 'Fail asal bukti', storage: 'Storan', browser: 'Pelayar ini', exportTitle: 'Eksport kes lengkap', exportCopy: 'Muat turun ZIP yang mengandungi rekod kes berstruktur, metadata dan cincangan bukti, status penyerahan, serta setiap fail bukti asal.', preparing: 'Menyediakan arkib…', export: 'Eksport ZIP', deleteTitle: 'Padam data kes setempat', deleteCopy: 'Memadam draf, metadata bukti, fail asal bukti, dan rekod status daripada pelayar ini secara kekal.', delete: 'Padam semua data kes', back: '← Kembali ke kes', deleteConfirm: 'Padam draf kes, setiap fail asal bukti, dan rekod status daripada pelayar ini? Tindakan ini tidak boleh dibatalkan.' },
} as const
