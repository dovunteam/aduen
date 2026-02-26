import { useEffect, useState } from 'react'
import type { CaseRecord, CaseRecordStatus } from '../domain/case'
import type { EvidenceMetadata } from '../domain/evidence'
import type { ComplaintPack } from '../domain/complaintPack'
import { listEvidence } from '../data/evidenceRepository'
import { listPacks } from '../data/packRepository'
import { readSubmission } from '../data/statusRepository'
import { checkCompleteness } from '../domain/caseReview'
import { messages, type Locale } from '../i18n'
import './CaseWorkspace.css'

const stages: Record<CaseRecordStatus, number> = { draft: 0, out_of_scope: 0, evidence_collection: 1, confirmation: 2, review: 2, ready_for_pack: 3, approved: 3, handed_off: 4, awaiting_response: 4, resolved: 4, closed: 4 }
const statusLabels: Record<Locale, Record<CaseRecordStatus, string>> = {
  en: { draft: 'Draft in progress', out_of_scope: 'Outside supported scope', evidence_collection: 'Collecting evidence', confirmation: 'Confirm extracted facts', review: 'Ready for review', ready_for_pack: 'Preparing a pack', approved: 'Pack approved', handed_off: 'Handoff recorded', awaiting_response: 'Awaiting response', resolved: 'Resolution recorded', closed: 'Case closed' },
  ms: { draft: 'Draf sedang disediakan', out_of_scope: 'Di luar skop yang disokong', evidence_collection: 'Mengumpul bukti', confirmation: 'Sahkan fakta diekstrak', review: 'Sedia untuk semakan', ready_for_pack: 'Menyediakan pek', approved: 'Pek diluluskan', handed_off: 'Penyerahan direkodkan', awaiting_response: 'Menunggu maklum balas', resolved: 'Penyelesaian direkodkan', closed: 'Kes ditutup' },
}

export function CaseWorkspace({ locale, record, onResume, onEdit, onEvidence, onData }: { locale: Locale; record: CaseRecord; onResume: () => void; onEdit: () => void; onEvidence: () => void; onData: () => void }) {
  const ms = locale === 'ms'
  const [resources, setResources] = useState<{ evidence: EvidenceMetadata[]; packs: ComplaintPack[] } | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [search, setSearch] = useState('')
  useEffect(() => {
    let active = true
    void listEvidence().then((evidence) => {
      const packs = listPacks()
      if (active) setResources({ evidence, packs })
    }).catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [attempt, record.id])
  const submission = readSubmission()
  const stage = stages[record.status]
  const terminal = submission.status === 'closed' || submission.status === 'resolved'
  const date = (value: string) => new Intl.DateTimeFormat(ms ? 'ms-MY' : 'en-MY', { dateStyle: 'medium' }).format(new Date(value.length === 10 ? `${value}T12:00:00` : value))
  const today = new Date()
  const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const followUp = terminal ? '' : submission.nextFollowUpDate
  const due = followUp && followUp <= localDate
  const labels = ms ? ['Butiran pembelian', 'Kumpulkan bukti', 'Semak fakta', 'Sediakan pek', 'Jejak maklum balas'] : ['Purchase details', 'Collect evidence', 'Review facts', 'Prepare a pack', 'Track responses']
  const guidance = ms
    ? ['Lengkapkan butiran pembelian dan penyelesaian yang anda minta.', 'Tambah rekod asal untuk menyokong perkara yang berlaku.', 'Semak jurang dan sahkan fakta sebelum menyediakan pek.', 'Semak kandungan pek sebelum berkongsi sendiri.', 'Rekodkan perkembangan, maklum balas dan hasil yang anda terima.']
    : ['Complete the purchase details and the remedy you are requesting.', 'Add original records to support what happened.', 'Review gaps and confirm facts before preparing a pack.', 'Review the pack contents before sharing it yourself.', 'Record developments, responses, and outcomes you receive.']
  const required = resources ? checkCompleteness(record.draft, resources.evidence).filter((item) => item.level === 'required') : []
  const missing = required.filter((item) => !item.satisfied).length
  const files = resources?.evidence.filter((item) => `${item.fileName} ${item.description}`.toLocaleLowerCase(locale).includes(search.trim().toLocaleLowerCase(locale))) ?? []
  const choiceLabel = (options: ReadonlyArray<readonly [string, string]>, value: string) => options.find(([key]) => key === value)?.[1] ?? (ms ? 'Belum ditetapkan' : 'Not set yet')
  return <section className="page workspace-page">
    <div className="workspace-heading"><div><div className="eyebrow">{ms ? 'RUANG KERJA KES ANDA' : 'YOUR CASE WORKSPACE'}</div><h1>{record.draft.seller || (ms ? 'Kes baharu anda' : 'Your new case')}</h1><p className="lede">{choiceLabel(messages[locale].caseDetails.issues, record.draft.issue)}</p></div><span className="workspace-status">{statusLabels[locale][record.status]}</span></div>
    <div className="workspace-meta"><span>{ms ? 'Disimpan pada peranti ini' : 'Saved on this device'}</span><span>{ms ? 'Dikemas kini' : 'Updated'} {date(record.updatedAt)}</span></div>
    <div className="workspace-layout">
      <div className="workspace-main">
        <article className="workspace-next"><div className="eyebrow">{ms ? 'LANGKAH SETERUSNYA' : 'YOUR NEXT STEP'}</div><h2>{statusLabels[locale][record.status]}</h2><p>{record.status === 'out_of_scope' ? (ms ? 'Semak panduan skop sebelum mengambil tindakan selanjutnya.' : 'Review the scope guidance before taking further action.') : guidance[stage]}</p><button className="primary" onClick={onResume}>{messages[locale].welcome.resume} <span aria-hidden="true">→</span></button></article>
        <ol className="workspace-journey" aria-label={ms ? 'Peringkat kes' : 'Case stages'}>{labels.map((label, index) => <li key={label} aria-current={index === stage ? 'step' : undefined}><span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>{label}</li>)}</ol>
        {followUp && <article className={`workspace-followup ${due ? 'is-due' : ''}`}><div><h2>{due ? (ms ? 'Masa untuk tindakan susulan' : 'Time to follow up') : (ms ? 'Tindakan susulan dirancang' : 'Follow-up planned')}</h2><p>{date(followUp)} · {ms ? 'Peringatan pilihan anda, bukan tarikh akhir rasmi.' : 'Your chosen reminder, not an official deadline.'}</p></div><button className="secondary" onClick={onResume}>{ms ? 'Sambung kes' : 'Continue case'}</button></article>}
        <section className="workspace-panel" aria-labelledby="workspace-records"><h2 id="workspace-records">{ms ? 'Rekod kes anda' : 'Your case records'}</h2>
          {failed ? <div role="alert"><p>{ms ? 'Rekod tidak dapat dimuatkan. Cuba lagi.' : 'Records could not be loaded. Please retry.'}</p><button className="secondary" onClick={() => { setFailed(false); setResources(null); setAttempt((value) => value + 1) }}>{ms ? 'Cuba lagi' : 'Retry'}</button></div> : !resources ? <p role="status">{ms ? 'Memuatkan rekod…' : 'Loading records…'}</p> : <>
            <div className="workspace-stats"><div><strong>{resources.evidence.length}</strong><span>{ms ? 'Fail bukti asal' : 'Original evidence files'}</span></div><div><strong>{resources.evidence.filter((item) => item.includeInPack).length}</strong><span>{ms ? 'Dipilih untuk pek' : 'Selected for pack'}</span></div><div><strong>{resources.packs.length}</strong><span>{ms ? 'Versi pek tersimpan' : 'Saved pack versions'}</span></div></div>
            <p className="workspace-completeness">{ms ? `${missing} perkara wajib belum lengkap dalam semakan bukti.` : `${missing} required items missing from the evidence check.`} {ms ? 'Semakan penuh masih diperlukan sebelum menyediakan pek.' : 'A full review is still needed before preparing a pack.'}</p>
            {resources.evidence.length > 0 && <label className="workspace-search">{ms ? 'Cari bukti' : 'Search evidence'}<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={ms ? 'Nama fail atau keterangan' : 'File name or description'} /></label>}
            <div className="workspace-files">{resources.evidence.length ? files.length ? files.slice().reverse().map((item) => <div key={item.id}><span className="workspace-file-icon" aria-hidden="true">↳</span><div><strong>{item.fileName}</strong><span>{ms ? 'Bukti asal' : 'Original evidence'} · {date(item.uploadedAt)}</span></div><span>{item.includeInPack ? (ms ? 'Disertakan' : 'Included') : (ms ? 'Dikecualikan' : 'Excluded')}</span></div>) : <p role="status">{ms ? 'Tiada bukti sepadan dengan carian anda.' : 'No evidence matches your search.'}</p> : <p>{ms ? 'Mulakan dengan resit atau rekod pembayaran anda. Fail asal kekal berasingan daripada fakta yang diekstrak.' : 'Start with your receipt or payment record. Originals remain separate from extracted facts.'}</p>}</div>
            {resources.packs.length > 0 && <details className="workspace-packs"><summary>{ms ? 'Sejarah versi pek' : 'Pack version history'}</summary><p>{ms ? 'Versi tersimpan ialah rekod sejarah. Perubahan kes memerlukan semakan baharu.' : 'Saved versions are historical records. Case changes require a new review.'}</p><ul>{resources.packs.slice().sort((a, b) => b.version - a.version).map((pack) => <li key={pack.id}><strong>{ms ? 'Versi' : 'Version'} {pack.version}</strong><span>{date(pack.createdAt)} · {pack.approvedAt ? (ms ? 'Diluluskan oleh anda' : 'Approved by you') : (ms ? 'Belum diluluskan' : 'Not approved')}</span></li>)}</ul></details>}
          </>}
        </section>
        <section className="workspace-panel"><h2>{ms ? 'Aktiviti kes terkini' : 'Recent case activity'}</h2><p>{ms ? 'Sejarah aliran kerja tempatan; bukan garis masa bukti atau pengesahan rasmi.' : 'Local workflow history; separate from the evidence timeline and official confirmation.'}</p><ol className="workspace-activity">{record.history.slice(-5).reverse().map((event, index) => <li key={`${event.at}-${index}`}><span>{statusLabels[locale][event.status]}</span><time dateTime={event.at}>{date(event.at)}</time></li>)}</ol></section>
      </div>
      <aside className="workspace-sidebar"><section className="workspace-panel"><h2>{ms ? 'Ringkasan pembelian' : 'Purchase snapshot'}</h2><dl><div><dt>{ms ? 'Jumlah dibayar' : 'Amount paid'}</dt><dd>{record.draft.amount ? new Intl.NumberFormat(ms ? 'ms-MY' : 'en-MY', { style: 'currency', currency: 'MYR' }).format(Number(record.draft.amount)) : '—'}</dd></div><div><dt>{ms ? 'Tarikh pembelian' : 'Purchase date'}</dt><dd>{record.draft.purchaseDate ? date(record.draft.purchaseDate) : '—'}</dd></div><div><dt>{ms ? 'Penyelesaian diminta' : 'Requested remedy'}</dt><dd>{choiceLabel(messages[locale].caseDetails.remedies, record.draft.remedy)}</dd></div><div><dt>{ms ? 'Rujukan pesanan' : 'Order reference'}</dt><dd>{record.draft.orderReference || '—'}</dd></div></dl><button className="secondary" onClick={onEdit}>{ms ? 'Edit butiran kes' : 'Edit case details'}</button></section>
        <section className="workspace-panel workspace-tools"><h2>{ms ? 'Alat kes' : 'Case tools'}</h2>{record.status !== 'draft' && record.status !== 'out_of_scope' && <button className="secondary" onClick={onEvidence}>{ms ? 'Urus bukti' : 'Manage evidence'}</button>}<button className="secondary" onClick={onData}>{ms ? 'Eksport dan kawalan data' : 'Export and data controls'}</button><p>{ms ? 'Simpan salinan eksport untuk sandaran. Data pelayar boleh hilang jika storan laman dipadamkan.' : 'Keep an exported copy as a backup. Browser data can be lost if site storage is cleared.'}</p></section>
        <div className="workspace-note"><strong>{ms ? 'Anda mengawal langkah seterusnya.' : 'You control what happens next.'}</strong><p>{ms ? 'Aduen tidak menghantar kes anda. Status dan hasil direkodkan oleh anda.' : 'Aduen does not submit your case. Status and outcomes are recorded by you.'}</p></div>
      </aside>
    </div>
  </section>
}
