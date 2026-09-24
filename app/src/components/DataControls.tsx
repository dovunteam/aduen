import { useEffect, useState } from 'react'
import type { CaseDraft } from '../domain/case'
import { listEvidence, listExtractions } from '../data/evidenceRepository'
import { readSubmission } from '../data/statusRepository'
import { readCase } from '../data/caseRepository'
import { readConsent } from '../data/consentRepository'
import { listPacks } from '../data/packRepository'
import { listAuditEvents } from '../data/auditRepository'
import type { LocalAuditEvent } from '../data/auditRepository'
import { clearRetention, readRetention, saveRetention } from '../data/retentionRepository'
import type { CasePage, StoredCase } from '../data/caseApi'
import { listOperatorReviews } from '../data/operatorReviewRepository'
import type { Locale } from '../i18n'

type Props = { locale: Locale; draft: CaseDraft; onBack: () => void; onDelete: () => Promise<void>; hostedConfigured: boolean; signedIn: boolean; identityError: boolean; onSignIn: () => void | Promise<void>; onSaveHosted: () => Promise<void>; onListHosted: (cursor?: string) => Promise<CasePage>; onDeleteHosted: (id: string, revision: number) => Promise<void>; onImportHosted: (item: StoredCase) => Promise<void> }

export function DataControls({ locale, draft, onBack, onDelete, hostedConfigured, signedIn, identityError, onSignIn, onSaveHosted, onListHosted, onDeleteHosted, onImportHosted }: Props) {
  const text = dataText[locale]
  const [evidenceCount, setEvidenceCount] = useState(0)
  const [candidateCount, setCandidateCount] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [inventoryFailed, setInventoryFailed] = useState(false)
  const [hostedConsent, setHostedConsent] = useState(false)
  const [hostedSaving, setHostedSaving] = useState(false)
  const [hostedResult, setHostedResult] = useState('')
  const [retentionChoice, setRetentionChoice] = useState(() => String(readRetention()?.days ?? ''))
  const auditEvents = listAuditEvents().slice().reverse()
  const hasDraft = Boolean(readCase()) || Object.entries(draft).some(([key, value]) => key !== 'currency' && Boolean(value))
  const packs = listPacks()
  const submission = readSubmission()
  const consent = readConsent()
  const hostedImportAvailable = Boolean(consent) && !hasDraft && !inventoryFailed && evidenceCount === 0 && candidateCount === 0 && packs.length === 0 && !submission.updatedAt && Object.keys(listOperatorReviews()).length === 0
  const retention = readRetention()
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

  async function saveHostedCopy() {
    setHostedSaving(true); setError(''); setHostedResult('')
    try {
      await onSaveHosted()
      setHostedResult(text.hostedSaved)
      setHostedConsent(false)
    } catch { setError(text.hostedFailed) }
    finally { setHostedSaving(false) }
  }

  function updateRetention(value: string) {
    setError('')
    try {
      if (!value) clearRetention()
      else if (value === '30' || value === '90' || value === '365') saveRetention(Number(value) as 30 | 90 | 365)
      else throw new Error('Invalid retention choice.')
      setRetentionChoice(value)
    } catch { setError(locale === 'ms' ? 'Tetapan tempoh simpanan tidak dapat disimpan.' : 'The retention setting could not be saved.') }
  }

  return <section className="page narrow-page data-page">
    <div className="eyebrow">{text.eyebrow}</div><h1>{text.title}</h1>
    <p className="lede">{text.lede}</p>
    <div className="data-inventory"><div><span>{text.caseDraft}</span><strong>{hasDraft ? text.saved : text.none}</strong></div><div><span>{text.evidence}</span><strong>{inventoryFailed ? text.unavailable : evidenceCount}</strong></div><div><span>{text.candidates}</span><strong>{inventoryFailed ? text.unavailable : candidateCount}</strong></div><div><span>{text.packs}</span><strong>{packs.length}</strong></div><div><span>{text.submission}</span><strong>{submission.updatedAt ? text.saved : text.none}</strong></div><div><span>{text.consent}</span><strong>{consent ? text.accepted : text.none}</strong></div><div><span>{text.storage}</span><strong>{text.browser}</strong></div></div>
    <section className="data-action"><div><h2>{text.retentionTitle}</h2><p>{retention ? text.retentionSet(new Date(retention.expiresAt).toLocaleDateString(locale === 'ms' ? 'ms-MY' : 'en-MY')) : text.retentionNone}</p></div><label>{text.retentionChoice}<select value={retentionChoice} onChange={(event) => updateRetention(event.target.value)}><option value="">{text.retentionOff}</option><option value="30">{text.retention30}</option><option value="90">{text.retention90}</option><option value="365">{text.retention365}</option></select></label></section>
    <section className="data-action"><div><h2>{text.auditTitle}</h2><p>{text.auditCopy}</p></div>{auditEvents.length ? <details><summary>{text.auditView(auditEvents.length)}</summary><ol className="audit-list">{auditEvents.map((event) => <li key={event.id}><time>{new Date(event.at).toLocaleString(locale === 'ms' ? 'ms-MY' : 'en-MY')}</time><strong>{auditLabel(event, locale)}</strong><span>{event.detail}</span></li>)}</ol></details> : <p>{text.auditEmpty}</p>}</section>
    <section className="data-action"><div><h2>{text.hostedTitle}</h2><p>{hostedConfigured ? text.hostedCopy : text.hostedUnavailable}</p>{identityError && <p className="form-error" role="alert">{text.identityFailed}</p>}{hostedResult && <p role="status">{hostedResult}</p>}{hostedConfigured && signedIn && <label className="check-row"><input type="checkbox" checked={hostedConsent} onChange={(event) => setHostedConsent(event.target.checked)} /><span>{text.hostedConsent}</span></label>}</div>{!hostedConfigured ? <button className="secondary" type="button" disabled>{text.hostedUnavailableButton}</button> : signedIn ? <button className="primary" type="button" disabled={!hostedConsent || !hasDraft || hostedSaving || exporting || deleting} onClick={() => void saveHostedCopy()}>{hostedSaving ? text.hostedSaving : text.hostedSave}</button> : <button className="secondary" type="button" onClick={() => void onSignIn()}>{text.hostedSignIn}</button>}</section>
    {hostedConfigured && signedIn && <HostedAccountControls locale={locale} busy={hostedSaving || exporting || deleting} canImport={hostedImportAvailable} onList={onListHosted} onDelete={onDeleteHosted} onImport={onImportHosted} />}
    {error && <p className="form-error" role="alert">{error}</p>}
    <section className="data-action"><div><h2>{text.exportTitle}</h2><p>{text.exportCopy}</p></div><button className="primary" disabled={(!hasData && !inventoryFailed) || exporting || deleting} onClick={exportData}>{exporting ? text.preparing : text.export} <span>↓</span></button></section>
    <section className="data-action destructive"><div><h2>{text.deleteTitle}</h2><p>{text.deleteCopy}</p></div><button className="danger-button" disabled={(!hasData && !inventoryFailed) || deleting || exporting} onClick={deleteData}>{text.delete}</button></section>
    <div className="actions split"><button className="secondary" onClick={onBack}>{text.back}</button></div>
  </section>
}

function HostedAccountControls({ locale, busy, canImport, onList, onDelete, onImport }: { locale: Locale; busy: boolean; canImport: boolean; onList: (cursor?: string) => Promise<CasePage>; onDelete: (id: string, revision: number) => Promise<void>; onImport: (item: StoredCase) => Promise<void> }) {
  const text = dataText[locale]
  const [cases, setCases] = useState<StoredCase[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const [importingId, setImportingId] = useState('')
  const [error, setError] = useState('')

  async function loadCopies(nextCursor?: string) {
    setLoading(true); setError('')
    try {
      const page = await onList(nextCursor)
      setCases((current) => nextCursor ? [...current, ...page.cases.filter((item) => !current.some((existing) => existing.record.id === item.record.id))] : page.cases)
      setCursor(page.nextCursor)
      setLoaded(true)
    } catch { setError(text.hostedListFailed) }
    finally { setLoading(false) }
  }

  async function deleteCopy(item: StoredCase) {
    if (!window.confirm(text.hostedDeleteConfirm)) return
    setDeletingId(item.record.id); setError('')
    try {
      await onDelete(item.record.id, item.revision)
      setCases((current) => current.filter((existing) => existing.record.id !== item.record.id))
    } catch { setError(text.hostedDeleteFailed) }
    finally { setDeletingId('') }
  }

  async function importCopy(item: StoredCase) {
    if (!window.confirm(text.hostedImportConfirm)) return
    setImportingId(item.record.id); setError('')
    try { await onImport(item) } catch { setError(text.hostedImportFailed) }
    finally { setImportingId('') }
  }

  return <section className="hosted-account" aria-labelledby="hosted-account-title"><div className="hosted-account-heading"><div><h2 id="hosted-account-title">{text.hostedAccountTitle}</h2><p>{text.hostedAccountCopy}</p></div><button className="secondary" type="button" disabled={loading || busy} onClick={() => void loadCopies()}>{loading ? text.hostedLoading : text.hostedLoad}</button></div>{error && <p className="form-error" role="alert">{error}</p>}{loaded && cases.length === 0 && <p role="status">{text.hostedEmpty}</p>}{cases.length > 0 && <ul className="hosted-case-list">{cases.map((item) => <li key={item.record.id}><div><strong>{item.record.draft.seller || text.hostedUnnamed}</strong><span>{text.hostedPurchase}: {item.record.draft.purchaseDate || text.unknownDate} · MYR {item.record.draft.amount || '0.00'}</span><span>{text.hostedStatus}: {item.record.status.replaceAll('_', ' ')}</span></div><div className="hosted-case-actions"><button className="secondary" type="button" aria-label={`${text.hostedImport}: ${item.record.draft.seller || text.hostedUnnamed}`} disabled={!canImport || Boolean(deletingId) || Boolean(importingId) || busy} onClick={() => void importCopy(item)}>{importingId === item.record.id ? text.hostedImporting : text.hostedImport}</button><button className="danger-button" type="button" aria-label={`${text.hostedDelete}: ${item.record.draft.seller || text.hostedUnnamed}`} disabled={Boolean(deletingId) || Boolean(importingId) || busy} onClick={() => void deleteCopy(item)}>{deletingId === item.record.id ? text.hostedDeleting : text.hostedDelete}</button></div></li>)}</ul>}{cursor && <button className="secondary hosted-more" type="button" disabled={loading || busy} onClick={() => void loadCopies(cursor)}>{loading ? text.hostedLoading : text.hostedLoadMore}</button>}</section>
}

const dataText = {
  en: { eyebrow: 'Privacy controls', title: <>Your data stays<br />under your control.</>, lede: 'This prototype keeps case evidence and working files in this browser. When hosted storage is configured, you can sign in and send a structured case record manually. No data is sent until you confirm each save.', caseDraft: 'Case draft', saved: '1 saved', none: 'None', evidence: 'Evidence originals', candidates: 'Derived fact candidates', packs: 'Complaint pack versions', submission: 'Submission status', consent: 'Privacy notice consent', accepted: 'Accepted', unavailable: 'Unavailable', storage: 'Storage', browser: 'This browser', retentionTitle: 'Automatic deletion', retentionChoice: 'Delete local data after', retentionOff: 'No automatic deletion', retention30: '30 days', retention90: '90 days', retention365: '12 months', retentionNone: 'No automatic deletion is scheduled.', retentionSet: (date: string) => 'Local data will be deleted when Aduen is next opened on or after ' + date + '.', auditTitle: 'Local activity history', auditCopy: 'Review recent sensitive actions recorded on this device. This is not a staff audit system.', auditEmpty: 'No sensitive actions recorded yet.', auditView: (count: number) => `View ${count} recorded ${count === 1 ? 'action' : 'actions'}`, hostedTitle: 'Save a structured copy to your account', hostedCopy: 'This sends the case name, purchase details, status, and case history to Aduen’s configured service. Evidence files, extracted text, and complaint packs stay in this browser. Each save replaces the hosted record with the current browser version. Local deletion does not delete the hosted copy; use the account list below to delete it separately.', hostedUnavailable: 'Hosted storage is not configured for this build.', hostedUnavailableButton: 'Not configured', hostedConsent: 'I agree to send or replace this case record in my Aduen account now.', hostedSave: 'Save hosted copy', hostedSaving: 'Saving…', hostedSaved: 'The hosted case record was saved.', hostedFailed: 'The hosted save failed. Your local case was not changed. Sign in again or retry later.', hostedSignIn: 'Sign in to Aduen', identityFailed: 'Sign-in did not complete. Retry or check the identity service settings.', hostedAccountTitle: 'Hosted copies in your account', hostedAccountCopy: 'A hosted copy contains only structured case details and history. Create a new local draft from it only after this browser has accepted its privacy notice and contains no case data; evidence, extracted text, packs, and submission details are not included. The hosted record stays unchanged.', hostedImport: 'Use as local draft', hostedImporting: 'Creating draft…', hostedImportConfirm: 'Copy these structured details and case history into a new local draft? Evidence files, extracted text, complaint packs, and submission details are not in the hosted copy. This will leave the hosted record unchanged and is available only when this browser has no case data.', hostedImportFailed: 'The hosted record could not be copied. This browser may already contain case data or require accepted privacy consent.', hostedLoad: 'Load hosted copies', hostedLoading: 'Loading?', hostedLoadMore: 'Load more', hostedEmpty: 'No hosted case copies were found.', hostedUnnamed: 'Case without a seller name', hostedPurchase: 'Purchase', hostedStatus: 'Status', unknownDate: 'Not recorded', hostedDelete: 'Delete hosted copy', hostedDeleting: 'Deleting?', hostedDeleteConfirm: 'Permanently delete this case record from your Aduen account? This does not delete the browser copy.', hostedListFailed: 'Hosted cases could not be loaded. Try again after checking your connection and sign-in.', hostedDeleteFailed: 'The hosted record was not deleted. Refresh the list and try again.', exportTitle: 'Export the complete case', exportCopy: 'Download a ZIP containing the structured case record, evidence metadata and hashes, submission status, and every original evidence file.', preparing: 'Preparing archive…', export: 'Export ZIP', deleteTitle: 'Delete local case data', deleteCopy: 'Permanently removes the draft, evidence metadata, evidence originals, and status record from this browser. Any hosted copy must be deleted separately.', delete: 'Delete all case data', back: '← Return to case', deleteConfirm: 'Delete the case draft, every evidence original, and its status record from this browser? This cannot be undone.' },
  ms: { eyebrow: 'Kawalan privasi', title: <>Data anda kekal<br />di bawah kawalan anda.</>, lede: 'Prototaip ini menyimpan bukti kes dan fail kerja dalam pelayar ini. Apabila storan dihoskan dikonfigurasikan, anda boleh log masuk dan menghantar rekod kes berstruktur secara manual. Tiada data dihantar sehingga anda mengesahkan setiap simpanan.', caseDraft: 'Draf kes', saved: '1 disimpan', none: 'Tiada', evidence: 'Fail asal bukti', candidates: 'Calon fakta terbitan', packs: 'Versi pek aduan', submission: 'Status penyerahan', consent: 'Persetujuan notis privasi', accepted: 'Diterima', unavailable: 'Tidak tersedia', storage: 'Storan', browser: 'Pelayar ini', retentionTitle: 'Pemadaman automatik', retentionChoice: 'Padam data setempat selepas', retentionOff: 'Tiada pemadaman automatik', retention30: '30 hari', retention90: '90 hari', retention365: '12 bulan', retentionNone: 'Tiada pemadaman automatik dijadualkan.', retentionSet: (date: string) => 'Data setempat akan dipadam apabila Aduen dibuka pada atau selepas ' + date + '.', auditTitle: 'Sejarah aktiviti setempat', auditCopy: 'Semak tindakan sensitif terkini yang direkodkan pada peranti ini. Ini bukan sistem audit kakitangan.', auditEmpty: 'Tiada tindakan sensitif direkodkan lagi.', auditView: (count: number) => `Lihat ${count} tindakan direkodkan`, hostedTitle: 'Simpan salinan berstruktur ke akaun anda', hostedCopy: 'Tindakan ini menghantar nama kes, butiran pembelian, status, dan sejarah kes kepada perkhidmatan Aduen yang dikonfigurasikan. Fail bukti, teks yang diekstrak, dan pek aduan kekal dalam pelayar ini. Setiap simpanan menggantikan rekod dihoskan dengan versi pelayar semasa. Pemadaman setempat tidak memadam salinan dihoskan; gunakan kawalan pemadaman akaun apabila tersedia.', hostedUnavailable: 'Storan dihoskan tidak dikonfigurasikan untuk binaan ini.', hostedUnavailableButton: 'Belum dikonfigurasikan', hostedConsent: 'Saya bersetuju untuk menghantar atau menggantikan rekod kes ini dalam akaun Aduen saya sekarang.', hostedSave: 'Simpan salinan dihoskan', hostedSaving: 'Menyimpan…', hostedSaved: 'Rekod kes dihoskan telah disimpan.', hostedFailed: 'Simpanan dihoskan gagal. Kes setempat anda tidak berubah. Log masuk semula atau cuba lagi kemudian.', hostedSignIn: 'Log masuk ke Aduen', identityFailed: 'Log masuk tidak selesai. Cuba lagi atau semak tetapan perkhidmatan identiti.', hostedAccountTitle: 'Salinan dihoskan dalam akaun anda', hostedAccountCopy: 'Salinan dihoskan mengandungi butiran kes berstruktur dan sejarah sahaja. Cipta draf setempat baharu daripadanya hanya selepas pelayar ini menerima notis privasi dan tiada data kes; bukti, teks diekstrak, pek dan butiran serahan tidak disertakan. Rekod dihoskan kekal tanpa perubahan.', hostedImport: 'Gunakan sebagai draf setempat', hostedImporting: 'Mencipta draf…', hostedImportConfirm: 'Salin butiran berstruktur dan sejarah kes ini ke dalam draf setempat baharu? Fail bukti, teks diekstrak, pek aduan dan butiran serahan tiada dalam salinan dihoskan. Rekod dihoskan kekal tanpa perubahan dan tindakan ini hanya tersedia jika pelayar ini tiada data kes.', hostedImportFailed: 'Rekod dihoskan tidak dapat disalin. Pelayar ini mungkin sudah mengandungi data kes atau memerlukan persetujuan notis privasi.', hostedLoad: 'Muat salinan dihoskan', hostedLoading: 'Memuatkan?', hostedLoadMore: 'Muat lagi', hostedEmpty: 'Tiada salinan kes dihoskan ditemui.', hostedUnnamed: 'Kes tanpa nama penjual', hostedPurchase: 'Pembelian', hostedStatus: 'Status', unknownDate: 'Tidak direkodkan', hostedDelete: 'Padam salinan dihoskan', hostedDeleting: 'Memadam?', hostedDeleteConfirm: 'Padam rekod kes ini daripada akaun Aduen anda secara kekal? Tindakan ini tidak memadam salinan dalam pelayar.', hostedListFailed: 'Kes dihoskan tidak dapat dimuatkan. Semak sambungan dan log masuk, kemudian cuba lagi.', hostedDeleteFailed: 'Rekod dihoskan tidak dipadam. Muat semula senarai dan cuba lagi.', exportTitle: 'Eksport kes lengkap', exportCopy: 'Muat turun ZIP yang mengandungi rekod kes berstruktur, metadata dan cincangan bukti, status penyerahan, serta setiap fail bukti asal.', preparing: 'Menyediakan arkib…', export: 'Eksport ZIP', deleteTitle: 'Padam data kes setempat', deleteCopy: 'Memadam draf, metadata bukti, fail asal bukti, dan rekod status daripada pelayar ini secara kekal. Sebarang salinan dihoskan mesti dipadam secara berasingan.', delete: 'Padam semua data kes', back: '← Kembali ke kes', deleteConfirm: 'Padam draf kes, setiap fail asal bukti, dan rekod status daripada pelayar ini? Tindakan ini tidak boleh dibatalkan.' },
} as const

function auditLabel(event: LocalAuditEvent, locale: Locale): string {
  if (event.action === 'hosted_case_saved') return locale === 'ms' ? 'Simpan rekod kes dihoskan' : 'Hosted case saved'
  if (event.action === 'hosted_case_deleted') return locale === 'ms' ? 'Padam rekod kes dihoskan' : 'Hosted case deleted'
  if (event.action === 'hosted_case_imported') return locale === 'ms' ? 'Salin rekod dihoskan ke draf setempat' : 'Hosted case copied to local draft'
  const labels = locale === 'ms'
    ? { consent_accepted: 'Terima notis privasi', case_created: 'Cipta kes', case_edited: 'Edit kes', case_recovered: 'Pulihkan simpanan kes terdahulu', submission_edited: 'Edit serahan', derived_fact_reviewed: 'Semakan fakta terbitan', request_copied: 'Salin permintaan', pack_viewed: 'Lihat pek', pack_approved: 'Luluskan pek', evidence_added: 'Tambah bukti', evidence_inclusion_changed: 'Tukar penyertaan bukti', evidence_previewed: 'Pratonton bukti', evidence_downloaded: 'Muat turun bukti asal', redacted_copy_exported: 'Eksport salinan redaksi', evidence_deleted: 'Padam bukti', case_transitioned: 'Peralihan kes', case_exported: 'Eksport kes', pack_exported: 'Eksport pek', handoff_exported: 'Eksport serahan', review_brief_exported: 'Eksport ringkasan semakan manual', operator_review_recorded: 'Rekod semakan operator', follow_up_exported: 'Eksport peringatan susulan', retention_updated: 'Kemas kini tempoh simpanan' }
    : { consent_accepted: 'Privacy notice accepted', case_created: 'Case created', case_edited: 'Case edited', case_recovered: 'Previous case autosave restored', submission_edited: 'Submission edited', derived_fact_reviewed: 'Derived fact reviewed', request_copied: 'Request copied', pack_viewed: 'Pack viewed', pack_approved: 'Pack approved', evidence_added: 'Evidence added', evidence_inclusion_changed: 'Evidence inclusion changed', evidence_previewed: 'Evidence previewed', evidence_downloaded: 'Original evidence downloaded', redacted_copy_exported: 'Redacted copy exported', evidence_deleted: 'Evidence deleted', case_transitioned: 'Case transitioned', case_exported: 'Case exported', pack_exported: 'Pack exported', handoff_exported: 'Handoff exported', review_brief_exported: 'Manual review brief exported', operator_review_recorded: 'Operator review recorded', follow_up_exported: 'Follow-up reminder exported', retention_updated: 'Retention setting updated' }
  return labels[event.action]
}
