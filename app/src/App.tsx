import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { CaseWorkspace } from './components/CaseWorkspace'
import { EvidenceStep } from './components/EvidenceStep'
import { ReviewStep } from './components/ReviewStep'
import { PackStep } from './components/PackStep'
import { StatusStep } from './components/StatusStep'
import { DataControls } from './components/DataControls'
import { AduenBrand } from './components/AduenBrand'
import { OutOfScopeStep } from './components/OutOfScopeStep'
import { ExtractionStep } from './components/ExtractionStep'
import { clearEvidence, listEvidence, listExtractions } from './data/evidenceRepository'
import { EMPTY_DRAFT } from './domain/case'
import type { CaseDraft } from './domain/case'
import type { EvidenceMetadata } from './domain/evidence'
import { createComplaintPack } from './domain/complaintPack'
import type { ComplaintPack } from './domain/complaintPack'
import { clearSubmission } from './data/statusRepository'
import { acceptConsent, clearConsent, readConsent } from './data/consentRepository'
import { clearCase, readCase, recordCaseTransition, saveCaseDraft, wasCaseRestored } from './data/caseRepository'
import { clearAuditEvents } from './data/auditRepository'
import { clearOperatorReviews } from './data/operatorReviewRepository'
import { clearPacks, listPacks, nextPackVersion, savePack } from './data/packRepository'
import { clearRetention, expireLocalDataIfDue } from './data/retentionRepository'
import { assessScope } from './domain/scope'
import type { ScopeAssessment } from './domain/scope'
import type { EvidenceExtraction } from './domain/extraction'
import { messages, readLocale, saveLocale } from './i18n'
import type { Locale } from './i18n'
import { CasePreview } from './components/CasePreview'
import { SafetySupport } from './components/SafetySupport'
import { safetyDescriptions } from './safetyMessages'
import { FeatureIcon } from './components/FeatureIcon'
import './App.css'
import './visual.css'
import './reference.css'

type Step = 'workspace' | 'welcome' | 'triage' | 'case' | 'scope' | 'saved' | 'evidence' | 'extraction' | 'review' | 'pack' | 'status' | 'data'
function App() {
  const [locale, setLocale] = useState<Locale>(readLocale)
  const [step, setStep] = useState<Step>(() => readCase() && readConsent() ? 'workspace' : 'welcome')
  const [consent, setConsent] = useState(() => Boolean(readConsent()))
  const [urgentReasons, setUrgentReasons] = useState<string[]>([])
  const [draft, setDraft] = useState<CaseDraft>(() => readCase()?.draft ?? EMPTY_DRAFT)
  const [caseSection, setCaseSection] = useState(0)
  const caseFormRef = useRef<HTMLFormElement>(null)
  const [caseRecovered, setCaseRecovered] = useState(wasCaseRestored)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [reviewEvidence, setReviewEvidence] = useState<EvidenceMetadata[]>([])
  const [complaintPack, setComplaintPack] = useState<ComplaintPack | null>(null)
  const [returnStep, setReturnStep] = useState<Step>('welcome')
  const [scopeAssessment, setScopeAssessment] = useState<ScopeAssessment | null>(null)
  const [extractions, setExtractions] = useState<EvidenceExtraction[]>([])
  const [storageError, setStorageError] = useState('')
  const [unsaved, setUnsaved] = useState(false)
  const [retentionReady, setRetentionReady] = useState(false)
  const isUrgent = urgentReasons.length > 0
  const text = messages[locale]
  const caseText = text.caseDetails
  const caseSectionCount = 5
  const caseSectionTitles = [caseText.transaction, locale === 'ms' ? 'Butiran transaksi' : 'Payment details', caseText.purposeProblem, caseText.remedyTitle, caseText.contactTitle]
  const caseSectionCopies = [caseText.transactionCopy, locale === 'ms' ? 'Tambah maklumat pembayaran dan pesanan.' : 'Add payment and order information.', caseText.purposeProblemCopy, caseText.remedyCopy, caseText.contactCopy]
  const progress = useMemo(() => ({ workspace: 0, welcome: 1, triage: 2, case: 3, scope: 3, saved: 3, evidence: 4, extraction: 5, review: 6, pack: 7, status: 8, data: 0 }[step]), [step])

  useEffect(() => {
    try { saveLocale(locale) } catch { /* Language can still be changed for this session. */ }
    document.documentElement.lang = locale
  }, [locale])

  useEffect(() => {
    void expireLocalDataIfDue().then((expired) => {
      if (!expired) return
      setDraft(EMPTY_DRAFT); setConsent(false); setCaseRecovered(false); setComplaintPack(null); setReviewEvidence([]); setExtractions([]); setScopeAssessment(null); setStep('welcome')
    }).catch(() => undefined).finally(() => setRetentionReady(true))
  }, [])

  useEffect(() => {
    const heading = document.querySelector<HTMLElement>('main h1')
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }) }
    window.scrollTo(0, 0)
    const navigation = document.querySelector<HTMLElement>('.progress')
    const current = navigation?.querySelector<HTMLElement>('[aria-current="step"]')
    if (navigation && current) navigation.scrollLeft += current.getBoundingClientRect().left - navigation.getBoundingClientRect().left - (navigation.clientWidth - current.clientWidth) / 2
  }, [step, locale])

  useEffect(() => {
    if (step !== 'case') return
    const currentCard = Array.from(document.querySelectorAll<HTMLElement>('.case-form > .form-section')).find((card) => card.getClientRects().length > 0)
    const heading = currentCard?.querySelector<HTMLElement>('h2')
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }) }
    window.scrollTo(0, 0)
  }, [caseSection, step])

  useEffect(() => {
    if (!unsaved) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [unsaved])

  function reportStorageError() {
    setStorageError(locale === 'ms' ? 'Data tidak dapat disimpan atau dibaca. Semak ruang storan dan kebenaran pelayar, kemudian cuba lagi. Kekalkan tab ini terbuka untuk menyimpan perubahan.' : 'Data could not be saved or read. Check browser storage space and permissions, then retry. Keep this tab open to preserve your changes.')
  }
  async function runAction(action: () => void | Promise<void>) {
    setStorageError('')
    try { await action() } catch { reportStorageError() }
  }
  function persistDraft(next: CaseDraft) {
    try { saveCaseDraft(next); setLastSaved(new Date()); setUnsaved(false); setStorageError(''); setCaseRecovered(false) }
    catch { setUnsaved(true); setLastSaved(null); reportStorageError() }
  }

  const toggleUrgent = (reason: string) => setUrgentReasons((current) => current.includes(reason) ? current.filter((item) => item !== reason) : [...current, reason])
  const updateDraft = <K extends keyof CaseDraft>(key: K, value: CaseDraft[K]) => {
    const next = { ...draft, [key]: value }
    setDraft(next); persistDraft(next)
  }
  function openCaseDetails() {
    setCaseSection(0)
    setStep('case')
  }
  function validateCaseSection() {
    const currentCard = Array.from(caseFormRef.current?.querySelectorAll<HTMLElement>('.form-section') ?? []).find((card) => card.getClientRects().length > 0)
    const invalidField = Array.from(currentCard?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea') ?? []).find((field) => field.getClientRects().length > 0 && !field.checkValidity())
    if (!invalidField) return true
    invalidField.reportValidity()
    return false
  }
  function advanceCaseSection() {
    if (validateCaseSection()) setCaseSection((current) => Math.min(current + 1, caseSectionCount - 1))
  }
  function saveCase(event: FormEvent) {
    event.preventDefault()
    if (caseSection < caseSectionCount - 1) {
      advanceCaseSection()
      return
    }
    if (!validateCaseSection()) return
    void runAction(() => {
      const assessment = assessScope(draft)
      recordCaseTransition(draft, assessment.result === 'unsupported' ? 'out_of_scope' : 'evidence_collection', assessment.result === 'unsupported' ? 'scope_exclusion_identified' : assessment.result === 'uncertain' ? 'manual_scope_review_needed' : 'case_details_confirmed')
      setCaseRecovered(false)
      setScopeAssessment(assessment); setLastSaved(new Date()); setUnsaved(false)
      setStep(assessment.result === 'unsupported' ? 'scope' : 'saved')
    })
  }
  async function startOver() {
    const prompt = locale === 'ms' ? 'Padam draf kes, setiap fail asal bukti, pek tersimpan, dan rekod status daripada pelayar ini? Tindakan ini tidak boleh dibatalkan.' : 'Delete the case draft, every evidence original, saved packs, and status record from this browser? This cannot be undone.'
    if (!window.confirm(prompt)) return
    await clearEvidence(); clearSubmission(); clearPacks(); clearOperatorReviews(); clearRetention(false); clearConsent(); clearAuditEvents(); clearCase()
    setUnsaved(false); setStorageError(''); setCaseRecovered(false)
    setDraft(EMPTY_DRAFT); setConsent(false); setUrgentReasons([]); setCaseSection(0); setLastSaved(null); setComplaintPack(null); setReviewEvidence([]); setExtractions([]); setScopeAssessment(null); setStep('welcome')
  }
  function openDataControls() { setReturnStep(step === 'data' ? 'welcome' : step); setStep('data') }
  async function resumeCase() {
    const record = readCase()
    if (!record) return
    if (!readConsent()) { if (!consent) return; acceptConsent() }
    setDraft(record.draft)
    if (record.status === 'out_of_scope') { setScopeAssessment(assessScope(record.draft)); setStep('scope'); return }
    if (record.status === 'draft') { openCaseDetails(); return }
    if (record.status === 'evidence_collection') { setStep('evidence'); return }
    if (record.status === 'confirmation') { setReviewEvidence(await listEvidence()); setExtractions(await listExtractions()); setStep('extraction'); return }
    if (record.status === 'review' || record.status === 'ready_for_pack') { setReviewEvidence(await listEvidence()); setExtractions(await listExtractions()); setStep('review'); return }
    if (['approved', 'handed_off', 'awaiting_response', 'resolved', 'closed'].includes(record.status)) {
      const [evidence, records] = await Promise.all([listEvidence(), listExtractions()])
      setReviewEvidence(evidence); setExtractions(records)
      const latest = listPacks().filter((pack) => pack.approvedAt).sort((a, b) => b.version - a.version)[0]
      setComplaintPack(latest ?? null)
      setStep(record.status === 'approved' ? (latest ? 'pack' : 'review') : 'status')
      return
    }
    setStep('saved')
  }

  if (!retentionReady) return <div className="app-shell is-welcome"><main><p className="lede">Loading Aduen...</p></main></div>

  return <div className={`app-shell ${step === 'welcome' || step === 'workspace' ? 'is-welcome' : 'is-workflow'}`}>
    <header className="topbar"><button className="wordmark" type="button" onClick={() => setStep('welcome')} aria-label={text.home}><AduenBrand /></button>{step === 'welcome' && <nav className="header-nav" aria-label={locale === 'ms' ? 'Navigasi utama' : 'Main navigation'}><a href="#how-it-works">{locale === 'ms' ? 'Cara ia berfungsi' : 'How it works'}</a><a href="#before-title">{locale === 'ms' ? 'Apa yang kami bantu' : 'What we cover'}</a></nav>}<div className="header-actions">{readCase() && readConsent() && step !== 'workspace' && <button className="data-link" onClick={() => setStep('workspace')}>{locale === 'ms' ? 'Kes saya' : 'My case'}</button>}<div className="locale-switch" aria-label="Language / Bahasa"><button type="button" aria-pressed={locale === 'en'} onClick={() => setLocale('en')}>EN</button><button type="button" aria-pressed={locale === 'ms'} onClick={() => setLocale('ms')}>BM</button></div><button className="data-link" type="button" onClick={openDataControls}>{text.dataControls}</button><div className="pilot-label"><span /> {text.prototype}</div></div></header>
    <main>
      {step !== 'data' && step !== 'workspace' && step !== 'welcome' && <nav className="progress" aria-label={text.progressLabel}>
        <div className="progress-mobile">
          <div><span>{locale === 'ms' ? `Langkah ${progress} daripada ${text.progress.length}` : `Step ${progress} of ${text.progress.length}`}</span><strong>{text.progress[progress - 1]}</strong></div>
          <progress value={progress} max={text.progress.length} aria-label={text.progressLabel} />
        </div>
        {text.progress.map((label, index) => <div aria-current={index + 1 === progress ? 'step' : undefined} className={index + 1 < progress ? 'progress-item completed' : index + 1 === progress ? 'progress-item active' : 'progress-item'} key={label}><span>{String(index + 1).padStart(2, '0')}</span>{label}</div>)}
      </nav>}
      {storageError && <div className="storage-error" role="alert"><p>{storageError}</p>{unsaved && <button type="button" className="secondary" onClick={() => persistDraft(draft)}>{locale === 'ms' ? 'Cuba simpan lagi' : 'Retry saving'}</button>}</div>}
      {caseRecovered && <div className="storage-error" role="status"><p>{locale === 'ms' ? 'Simpanan kes terdahulu dipulihkan kerana rekod terkini tidak dapat dibaca. Semak butiran kes yang dipulihkan sebelum meneruskan.' : 'A previous case autosave was restored because the latest record could not be read. Review the restored case details before continuing.'}</p><button type="button" className="secondary" onClick={() => setCaseRecovered(false)}>{locale === 'ms' ? 'Tutup' : 'Dismiss'}</button></div>}

      {step === 'workspace' && readCase() && <CaseWorkspace locale={locale} record={readCase()!} onResume={() => void runAction(resumeCase)} onEdit={openCaseDetails} onEvidence={() => setStep('evidence')} onData={openDataControls} />}

      {step === 'welcome' && <section className="page welcome-page">
        <div className="welcome-hero"><div className="hero-copy"><div className="eyebrow"><span />{text.welcome.eyebrow}</div><h1>{renderLines(text.welcome.title)}</h1>
        <p className="lede">{text.welcome.lede}</p><div className="hero-actions"><a className="primary hero-start" href="#before-title">{locale === 'ms' ? 'Susun kes anda' : 'Organise your case'}<span aria-hidden="true">&rarr;</span></a><a className="secondary hero-learn" href="#how-it-works">{locale === 'ms' ? 'Lihat cara Aduen membantu' : 'See how Aduen helps'} <span aria-hidden="true">&rarr;</span></a></div><div className="hero-footnote">{locale === 'ms' ? 'Untuk pembelian pengguna di Malaysia' : 'For consumer purchases in Malaysia'} <span aria-hidden="true">&middot;</span> {locale === 'ms' ? 'Disimpan dalam pelayar anda' : 'Stored in your browser'}</div></div><CasePreview locale={locale} /></div>
        <div className="section-intro" id="how-it-works"><span>{locale === 'ms' ? 'CARA ADUEN MEMBANTU' : 'HOW ADUEN HELPS'}</span></div>
        <div className="boundary-grid">{text.welcome.cards.map(([title, copy], index) => <article key={title}><div className="feature-card-top"><FeatureIcon index={index} /><span className="card-number">{String(index + 1).padStart(2, '0')}</span></div><h2>{title}</h2><p>{copy}</p></article>)}</div>
        <div className="welcome-consent"><aside className="notice" aria-labelledby="before-title"><div><span className="notice-mark">i</span><div><h2 id="before-title">{text.welcome.before}</h2><p>{text.welcome.notice}</p></div></div><label className="check-row"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>{text.welcome.consent}</span></label></aside>
        <div className="actions">{readCase() ? <button className="primary" disabled={!consent} onClick={() => void runAction(resumeCase)}>{text.welcome.resume} <span>→</span></button> : <button className="primary" disabled={!consent} onClick={() => void runAction(() => { acceptConsent(); setStep('triage') })}>{text.welcome.begin} <span>→</span></button>}<span className="consent-caption">{locale === 'ms' ? 'Semak dahulu. Kongsi apabila bersedia.' : 'Review first. Share when you’re ready.'}</span></div></div>
      </section>}

      {step === 'triage' && <section className="page safety-page"><div className="safety-main">
        <div className="eyebrow">{text.triage.eyebrow}</div><h1>{renderLines(text.triage.title)}</h1><p className="lede">{text.triage.lede}</p>
        <fieldset className="choice-list"><legend className="sr-only">{text.triage.legend}</legend>{text.triage.reasons.map(([value, label], index) => <label className="choice" key={value}><input type="checkbox" aria-label={label} aria-describedby={`safety-${value}`} checked={urgentReasons.includes(value)} onChange={() => toggleUrgent(value)} /><span className="choice-box" aria-hidden="true">✓</span><span className="choice-copy"><strong>{label}</strong><small id={`safety-${value}`}>{safetyDescriptions[locale][index]}</small></span><FeatureIcon index={index + 3} /></label>)}</fieldset>
        {isUrgent && <div className="urgent-panel" role="alert"><strong>{text.triage.pause}</strong><p>{text.triage.urgent}</p><div className="official-links"><a href="https://www.bnm.gov.my/faqs/scams" target="_blank" rel="noreferrer">{text.triage.bnm}</a><a href="https://nfcc.jpm.gov.my/index.php/en/about-nsrc" target="_blank" rel="noreferrer">{text.triage.nsrc}</a></div><p className="source-note">{text.triage.source}</p></div>}
        <div className="actions split"><button className="secondary" onClick={() => setStep('welcome')}>{text.triage.back}</button>{!isUrgent && <button className="primary" onClick={openCaseDetails}>{text.triage.continue} <span>→</span></button>}</div>
      </div><SafetySupport locale={locale} /></section>}

      {step === 'case' && <section className="page form-page">
        <div className="form-heading"><div className="form-heading-copy"><span className="receipt-decoration" aria-hidden="true"><FeatureIcon index={0} /></span><div className="eyebrow">{caseText.eyebrow}</div><h1>{caseText.title}</h1></div><div className="save-state"><span /> {unsaved ? (locale === 'ms' ? 'Belum disimpan' : 'Not saved') : lastSaved ? caseText.saved + ' ' + lastSaved.toLocaleTimeString(locale === 'ms' ? 'ms-MY' : 'en-MY', { hour: '2-digit', minute: '2-digit' }) : caseText.savedDevice}</div></div>
        <p className="lede">{caseText.lede}</p>
        <form ref={caseFormRef} id="case-form" className="case-form" data-section={caseSection} noValidate onSubmit={saveCase}>
          <div className="case-section-progress" role="group" aria-label={locale === 'ms' ? 'Kemajuan borang butiran kes' : 'Case details form progress'}>
            <div><span>{locale === 'ms' ? 'Bahagian ' + (caseSection + 1) + ' daripada ' + caseSectionCount : 'Section ' + (caseSection + 1) + ' of ' + caseSectionCount}</span><strong>{caseSectionTitles[caseSection]}</strong></div>
            <progress className="case-section-meter" value={caseSection + 1} max={caseSectionCount} aria-label={locale === 'ms' ? 'Kemajuan borang butiran kes' : 'Case details form progress'} />
          </div>
          <div className="form-section"><SectionTitle number={String(caseSection + 1).padStart(2, '0')} title={caseSectionTitles[caseSection]} copy={caseSectionCopies[caseSection]} tip={locale === 'ms' ? 'Gunakan butiran pada resit atau pengesahan pesanan anda.' : 'Keep your receipt or order confirmation nearby.'} /><div className="fields two-col"><label>{caseText.consumerName}<input required maxLength={500} value={draft.consumerName} onChange={(e) => updateDraft('consumerName', e.target.value)} placeholder={caseText.consumerNamePlaceholder} /></label><label>{caseText.consumerLocation}<select required value={draft.consumerLocation} onChange={(e) => updateDraft('consumerLocation', e.target.value as CaseDraft['consumerLocation'])}><option value="">{caseText.selectLocation}</option><option value="malaysia">{caseText.malaysia}</option><option value="outside">{caseText.outside}</option></select></label><label>{caseText.seller}<input required maxLength={500} value={draft.seller} onChange={(e) => updateDraft('seller', e.target.value)} placeholder={caseText.sellerPlaceholder} /></label><label>{caseText.sellerLocation}<select required value={draft.sellerLocation} onChange={(e) => updateDraft('sellerLocation', e.target.value as CaseDraft['sellerLocation'])}><option value="">{caseText.selectKnown}</option><option value="malaysia">{caseText.malaysia}</option><option value="outside">{caseText.outside}</option><option value="unknown">{caseText.unknown}</option></select></label><label>{caseText.platform} <span className="optional">{caseText.optional}</span><input maxLength={500} value={draft.platform} onChange={(e) => updateDraft('platform', e.target.value)} placeholder={caseText.platformPlaceholder} /></label><label>{caseText.purchaseDate}<input required type="date" value={draft.purchaseDate} onChange={(e) => updateDraft('purchaseDate', e.target.value)} /></label><label>{caseText.amount}<input required min="0" step="0.01" type="number" value={draft.amount} onChange={(e) => updateDraft('amount', e.target.value)} placeholder="0.00" /></label><label>{caseText.claimAmount} <span className="optional">{caseText.optional}</span><input min="0" step="0.01" type="number" value={draft.claimAmount} onChange={(e) => updateDraft('claimAmount', e.target.value)} placeholder="0.00" /></label><label>{caseText.claimAccruedDate} <span className="optional">{caseText.optional}</span><input type="date" value={draft.claimAccruedDate} onChange={(e) => updateDraft('claimAccruedDate', e.target.value)} /></label><label>{caseText.paymentMethod}<select required value={draft.paymentMethod} onChange={(e) => updateDraft('paymentMethod', e.target.value)}><option value="">{caseText.selectMethod}</option>{caseText.methods.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>{caseText.reference} <span className="optional">{caseText.optional}</span><input maxLength={500} value={draft.orderReference} onChange={(e) => updateDraft('orderReference', e.target.value)} placeholder={caseText.referencePlaceholder} /></label></div></div>
          <div className="form-section"><SectionTitle number="03" title={caseText.purposeProblem} copy={caseText.purposeProblemCopy} tip={locale === 'ms' ? 'Pilih pilihan yang paling sesuai dengan pembelian ini.' : 'Choose the options that best describe this purchase.'} /><div className="fields two-col"><label>{caseText.purpose}<select required value={draft.purpose} onChange={(e) => updateDraft('purpose', e.target.value as CaseDraft['purpose'])}><option value="">{caseText.selectPurpose}</option><option value="personal">{caseText.personal}</option><option value="business">{caseText.business}</option></select></label><label>{caseText.category}<select required value={draft.category} onChange={(e) => updateDraft('category', e.target.value as CaseDraft['category'])}><option value="">{caseText.selectCategory}</option>{caseText.categories.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>{caseText.issue}<select required value={draft.issue} onChange={(e) => updateDraft('issue', e.target.value as CaseDraft['issue'])}><option value="">{caseText.selectIssue}</option>{caseText.issues.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div></div>
          <div className="form-section"><SectionTitle number="04" title={caseText.remedyTitle} copy={caseText.remedyCopy} tip={locale === 'ms' ? 'Rekodkan penyelesaian yang anda ingin minta.' : 'Record the remedy you want to request.'} /><div className="fields two-col"><label>{caseText.remedy}<select required value={draft.remedy} onChange={(e) => updateDraft('remedy', e.target.value as CaseDraft['remedy'])}><option value="">{caseText.selectRemedy}</option>{caseText.remedies.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>{draft.remedy === 'refund' && <label>{caseText.refundAmount}<input required min="0" step="0.01" type="number" value={draft.remedyAmount} onChange={(e) => updateDraft('remedyAmount', e.target.value)} placeholder="0.00" /></label>}</div></div>
          <div className="form-section"><SectionTitle number="05" title={caseText.contactTitle} copy={caseText.contactCopy} tip={locale === 'ms' ? 'Gunakan tarikh daripada mesej anda jika tersedia.' : 'Use dates from your messages where available.'} /><div className="fields two-col"><label>{caseText.promisedDate} <span className="optional">{caseText.ifKnown}</span><input type="date" value={draft.promisedDate} onChange={(e) => updateDraft('promisedDate', e.target.value)} /></label><label>{caseText.merchantContact}<select required value={draft.contactHistory} onChange={(e) => updateDraft('contactHistory', e.target.value as CaseDraft['contactHistory'])}><option value="">{caseText.selectContact}</option>{caseText.contacts.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>{draft.contactHistory && draft.contactHistory !== 'none' && <label>{caseText.latestContact}<input required type="date" value={draft.contactDate} onChange={(e) => updateDraft('contactDate', e.target.value)} /></label>}</div></div>
          <div className="privacy-line"><strong>{caseText.privacyLead}</strong> {caseText.privacy}</div>
          <div className="actions split case-section-actions">
            {caseSection === 0 ? <button type="button" className="secondary" onClick={() => setStep('triage')}>{caseText.back}</button> : <button type="button" className="secondary" onClick={() => setCaseSection((current) => current - 1)}>{locale === 'ms' ? 'Bahagian sebelumnya' : 'Previous section'}</button>}
            {caseSection < caseSectionCount - 1 ? <button key="case-continue" type="button" className="primary" onClick={advanceCaseSection}>{locale === 'ms' ? 'Teruskan' : 'Continue'} <span aria-hidden="true">→</span></button> : <button key="case-save" className="primary" type="submit">{caseText.save} <span aria-hidden="true">→</span></button>}
          </div>
        </form>
      </section>}
      {step === 'saved' && <section className="page narrow-page saved-page"><div className="success-mark">✓</div><div className="eyebrow">{text.draftSaved.eyebrow}</div><h1>{renderLines(text.draftSaved.title)}</h1><p className="lede">{text.draftSaved.lede}</p><dl className="summary"><div><dt>{text.draftSaved.seller}</dt><dd>{draft.seller}</dd></div><div><dt>{text.draftSaved.amount}</dt><dd>RM {Number(draft.amount).toFixed(2)}</dd></div><div><dt>{text.draftSaved.issue}</dt><dd>{labelFor(caseText.issues, draft.issue)}</dd></div><div><dt>{text.draftSaved.remedy}</dt><dd>{labelFor(caseText.remedies, draft.remedy)}</dd></div></dl><div className="actions split"><button className="secondary" onClick={() => void runAction(startOver)}>{text.draftSaved.delete}</button><div className="button-group"><button className="secondary" onClick={openCaseDetails}>{text.draftSaved.edit}</button><button className="primary" onClick={() => setStep('evidence')}>{text.draftSaved.evidence} <span>→</span></button></div></div></section>}
      {step === 'scope' && scopeAssessment && <OutOfScopeStep locale={locale} draft={draft} assessment={scopeAssessment} onEdit={openCaseDetails} onDelete={() => runAction(startOver)} />}
      {step === 'evidence' && <EvidenceStep locale={locale} onChange={() => { recordCaseTransition(draft, 'evidence_collection', 'evidence_changed'); setComplaintPack(null) }} onBack={openCaseDetails} onContinue={(items) => { void runAction(async () => { const records = await listExtractions(); setReviewEvidence(items); setExtractions(records); if (records.some((record) => record.candidates.length > 0)) { recordCaseTransition(draft, 'confirmation', 'extracted_facts_review_requested'); setStep('extraction') } else { recordCaseTransition(draft, 'review', 'evidence_review_requested'); setStep('review') } }) }} />}
      {step === 'extraction' && <ExtractionStep locale={locale} initialExtractions={extractions} evidence={reviewEvidence} onBack={() => setStep('evidence')} onContinue={(records) => void runAction(() => { recordCaseTransition(draft, 'review', 'extracted_facts_reviewed'); setExtractions(records); setStep('review') })} />}
      {step === 'review' && <ReviewStep locale={locale} caseId={readCase()?.id ?? 'case'} draft={draft} evidence={reviewEvidence} extractions={extractions} onBack={() => setStep('evidence')} onPrepare={(route) => void runAction(() => { recordCaseTransition(draft, 'ready_for_pack', 'route_confirmed'); const pack = createComplaintPack(draft, reviewEvidence, route, new Date(), nextPackVersion(), extractions, locale); savePack(pack); setComplaintPack(pack); setStep('pack') })} />}
      {step === 'pack' && complaintPack && <PackStep locale={locale} initialPack={complaintPack} onBack={() => setStep('review')} onApproved={(approved) => { savePack(approved); recordCaseTransition(draft, 'approved', `pack_v${approved.version}_approved`); setComplaintPack(approved) }} onContinue={() => setStep('status')} />}
      {step === 'status' && <StatusStep locale={locale} onBack={() => setStep(complaintPack ? 'pack' : 'review')} onStatusChange={(status) => recordCaseTransition(draft, status, 'external_status_recorded')} />}
      {step === 'data' && <DataControls locale={locale} draft={draft} onBack={() => setStep(returnStep)} onDelete={startOver} />}
    </main>
    <footer><div className="footer-brand"><AduenBrand compact /><span>{locale === 'ms' ? 'Susun. Jelaskan. Ambil langkah seterusnya.' : 'Organise. Clarify. Take the next step.'}</span></div><p>{text.footer}</p></footer>
  </div>
}

function SectionTitle({ number, title, copy, tip }: { number: string; title: string; copy: string; tip?: string }) { return <div className="section-title"><span>{number}</span><div><h2>{title}</h2><p>{copy}</p>{tip && <div className="section-tip"><FeatureIcon index={0} /><p>{tip}</p></div>}</div></div> }
function renderLines(value: string) { return value.split('\n').map((line, index) => <span key={line}>{index > 0 && <br />}{line}</span>) }
function labelFor(options: ReadonlyArray<readonly [string, string]>, value: string) { return options.find(([key]) => key === value)?.[1] ?? value.replaceAll('_', ' ') }
export default App
