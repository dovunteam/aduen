import { useEffect, useState } from 'react'
import type { CaseDraft } from '../domain/case'
import { listEvidence, listExtractions } from '../data/evidenceRepository'
import { readSubmission } from '../data/statusRepository'
import { readCase } from '../data/caseRepository'
import { readConsent } from '../data/consentRepository'
import { listPacks } from '../data/packRepository'
import { listAuditEvents } from '../data/auditRepository'
import type { LocalAuditEvent } from '../data/auditRepository'
import type { Locale } from '../i18n'

type Props = { locale: Locale; draft: CaseDraft; onBack: () => void; onDelete: () => Promise<void> }

export function DataControls({ locale, draft, onBack, onDelete }: Props) {
  const text = dataText[locale]
  const [evidenceCount, setEvidenceCount] = useState(0)
  const [candidateCount, setCandidateCount] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [inventoryFailed, setInventoryFailed] = useState(false)
  const auditEvents = listAuditEvents().slice().reverse()
  const hasDraft = Boolean(readCase()) || Object.entries(draft).some(([key, value]) => key !== 'currency' && Boolean(value))
  const packs = listPacks()
  const submission = readSubmission()
  const consent = readConsent()
  const hasData = hasDraft || evidenceCount > 0 || candidateCount > 0 || Boolean(consent) || packs.length > 0 || Boolean(submission.updatedAt)
  useEffect(() => {
    Promise.all([listEvidence(), listExtractions()]).then(([items, records]) => {
      setEvidenceCount(items.length)
      setCandidateCount(records.reduce((count, record) => count + record.candidates.length, 0))
    }).catch(() => setInventoryFailed(true))
  }, [])

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
    <div className="data-inventory"><div><span>{text.caseDraft}</span><strong>{hasDraft ? text.saved : text.none}</strong></div><div><span>{text.evidence}</span><strong>{inventoryFailed ? text.unavailable : evidenceCount}</strong></div><div><span>{text.candidates}</span><strong>{inventoryFailed ? text.unavailable : candidateCount}</strong></div><div><span>{text.packs}</span><strong>{packs.length}</strong></div><div><span>{text.submission}</span><strong>{submission.updatedAt ? text.saved : text.none}</strong></div><div><span>{text.consent}</span><strong>{consent ? text.accepted : text.none}</strong></div><div><span>{text.storage}</span><strong>{text.browser}</strong></div></div>
    <section className="data-action"><div><h2>{text.auditTitle}</h2><p>{text.auditCopy}</p></div>{auditEvents.length ? <details><summary>{text.auditView(auditEvents.length)}</summary><ol className="audit-list">{auditEvents.map((event) => <li key={event.id}><time>{new Date(event.at).toLocaleString(locale === 'ms' ? 'ms-MY' : 'en-MY')}</time><strong>{auditLabel(event, locale)}</strong><span>{event.detail}</span></li>)}</ol></details> : <p>{text.auditEmpty}</p>}</section>
    {error && <p className="form-error" role="alert">{error}</p>}
    <section className="data-action"><div><h2>{text.exportTitle}</h2><p>{text.exportCopy}</p></div><button className="primary" disabled={(!hasData && !inventoryFailed) || exporting || deleting} onClick={exportData}>{exporting ? text.preparing : text.export} <span>↓</span></button></section>
    <section className="data-action destructive"><div><h2>{text.deleteTitle}</h2><p>{text.deleteCopy}</p></div><button className="danger-button" disabled={(!hasData && !inventoryFailed) || deleting || exporting} onClick={deleteData}>{text.delete}</button></section>
    <div className="actions split"><button className="secondary" onClick={onBack}>{text.back}</button></div>
  </section>
}

const dataText = {
  en: { eyebrow: 'Privacy controls', title: <>Your data stays<br />under your control.</>, lede: 'This prototype stores information only in this browser. It has no account, cloud sync, analytics, or remote evidence processing.', caseDraft: 'Case draft', saved: '1 saved', none: 'None', evidence: 'Evidence originals', candidates: 'Derived fact candidates', packs: 'Complaint pack versions', submission: 'Submission status', consent: 'Privacy notice consent', accepted: 'Accepted', unavailable: 'Unavailable', storage: 'Storage', browser: 'This browser', auditTitle: 'Local activity history', auditCopy: 'Review recent sensitive actions recorded on this device. This is not a staff audit system.', auditEmpty: 'No sensitive actions recorded yet.', auditView: (count: number) => `View ${count} recorded ${count === 1 ? 'action' : 'actions'}`, exportTitle: 'Export the complete case', exportCopy: 'Download a ZIP containing the structured case record, evidence metadata and hashes, submission status, and every original evidence file.', preparing: 'Preparing archive…', export: 'Export ZIP', deleteTitle: 'Delete local case data', deleteCopy: 'Permanently removes the draft, evidence metadata, evidence originals, and status record from this browser.', delete: 'Delete all case data', back: '← Return to case', deleteConfirm: 'Delete the case draft, every evidence original, and its status record from this browser? This cannot be undone.' },
  ms: { eyebrow: 'Kawalan privasi', title: <>Data anda kekal<br />di bawah kawalan anda.</>, lede: 'Prototaip ini menyimpan maklumat hanya dalam pelayar ini. Ia tidak mempunyai akaun, penyegerakan awan, analitik, atau pemprosesan bukti jauh.', caseDraft: 'Draf kes', saved: '1 disimpan', none: 'Tiada', evidence: 'Fail asal bukti', candidates: 'Calon fakta terbitan', packs: 'Versi pek aduan', submission: 'Status penyerahan', consent: 'Persetujuan notis privasi', accepted: 'Diterima', unavailable: 'Tidak tersedia', storage: 'Storan', browser: 'Pelayar ini', auditTitle: 'Sejarah aktiviti setempat', auditCopy: 'Semak tindakan sensitif terkini yang direkodkan pada peranti ini. Ini bukan sistem audit kakitangan.', auditEmpty: 'Tiada tindakan sensitif direkodkan lagi.', auditView: (count: number) => `Lihat ${count} tindakan direkodkan`, exportTitle: 'Eksport kes lengkap', exportCopy: 'Muat turun ZIP yang mengandungi rekod kes berstruktur, metadata dan cincangan bukti, status penyerahan, serta setiap fail bukti asal.', preparing: 'Menyediakan arkib…', export: 'Eksport ZIP', deleteTitle: 'Padam data kes setempat', deleteCopy: 'Memadam draf, metadata bukti, fail asal bukti, dan rekod status daripada pelayar ini secara kekal.', delete: 'Padam semua data kes', back: '← Kembali ke kes', deleteConfirm: 'Padam draf kes, setiap fail asal bukti, dan rekod status daripada pelayar ini? Tindakan ini tidak boleh dibatalkan.' },
} as const

function auditLabel(event: LocalAuditEvent, locale: Locale): string {
  const labels = locale === 'ms'
    ? { consent_accepted: 'Terima notis privasi', case_created: 'Cipta kes', case_edited: 'Edit kes', case_recovered: 'Pulihkan simpanan kes terdahulu', submission_edited: 'Edit serahan', derived_fact_reviewed: 'Semakan fakta terbitan', request_copied: 'Salin permintaan', pack_viewed: 'Lihat pek', pack_approved: 'Luluskan pek', evidence_added: 'Tambah bukti', evidence_inclusion_changed: 'Tukar penyertaan bukti', evidence_previewed: 'Pratonton bukti', evidence_downloaded: 'Muat turun bukti asal', redacted_copy_exported: 'Eksport salinan redaksi', evidence_deleted: 'Padam bukti', case_transitioned: 'Peralihan kes', case_exported: 'Eksport kes', pack_exported: 'Eksport pek', handoff_exported: 'Eksport serahan', follow_up_exported: 'Eksport peringatan susulan' }
    : { consent_accepted: 'Privacy notice accepted', case_created: 'Case created', case_edited: 'Case edited', case_recovered: 'Previous case autosave restored', submission_edited: 'Submission edited', derived_fact_reviewed: 'Derived fact reviewed', request_copied: 'Request copied', pack_viewed: 'Pack viewed', pack_approved: 'Pack approved', evidence_added: 'Evidence added', evidence_inclusion_changed: 'Evidence inclusion changed', evidence_previewed: 'Evidence previewed', evidence_downloaded: 'Original evidence downloaded', redacted_copy_exported: 'Redacted copy exported', evidence_deleted: 'Evidence deleted', case_transitioned: 'Case transitioned', case_exported: 'Case exported', pack_exported: 'Pack exported', handoff_exported: 'Handoff exported', follow_up_exported: 'Follow-up reminder exported' }
  return labels[event.action]
}
