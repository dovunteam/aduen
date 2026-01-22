import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { EvidenceStep } from './components/EvidenceStep'
import { ReviewStep } from './components/ReviewStep'
import { PackStep } from './components/PackStep'
import { StatusStep } from './components/StatusStep'
import { DataControls } from './components/DataControls'
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
import { clearCase, readCase, recordCaseTransition, saveCaseDraft } from './data/caseRepository'
import { clearPacks, listPacks, nextPackVersion, savePack } from './data/packRepository'
import { assessScope } from './domain/scope'
import type { ScopeAssessment } from './domain/scope'
import type { EvidenceExtraction } from './domain/extraction'
import { messages, readLocale, saveLocale } from './i18n'
import type { Locale } from './i18n'
import './App.css'

type Step = 'welcome' | 'triage' | 'case' | 'scope' | 'saved' | 'evidence' | 'extraction' | 'review' | 'pack' | 'status' | 'data'
function App() {
  const [locale, setLocale] = useState<Locale>(readLocale)
  const [step, setStep] = useState<Step>('welcome')
  const [consent, setConsent] = useState(() => Boolean(readConsent()))
  const [urgentReasons, setUrgentReasons] = useState<string[]>([])
  const [draft, setDraft] = useState<CaseDraft>(() => readCase()?.draft ?? EMPTY_DRAFT)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [reviewEvidence, setReviewEvidence] = useState<EvidenceMetadata[]>([])
  const [complaintPack, setComplaintPack] = useState<ComplaintPack | null>(null)
  const [returnStep, setReturnStep] = useState<Step>('welcome')
  const [scopeAssessment, setScopeAssessment] = useState<ScopeAssessment | null>(null)
  const [extractions, setExtractions] = useState<EvidenceExtraction[]>([])
  const isUrgent = urgentReasons.length > 0
  const text = messages[locale]
  const caseText = text.caseDetails
  const progress = useMemo(() => ({ welcome: 1, triage: 2, case: 3, scope: 3, saved: 3, evidence: 4, extraction: 5, review: 6, pack: 7, status: 8, data: 0 }[step]), [step])

  useEffect(() => {
    if (step !== 'case') return
    const timer = window.setTimeout(() => { saveCaseDraft(draft); setLastSaved(new Date()) }, 400)
    return () => window.clearTimeout(timer)
  }, [draft, step])

  useEffect(() => {
    saveLocale(locale)
    document.documentElement.lang = locale
  }, [locale])

  const toggleUrgent = (reason: string) => setUrgentReasons((current) => current.includes(reason) ? current.filter((item) => item !== reason) : [...current, reason])
  const updateDraft = <K extends keyof CaseDraft>(key: K, value: CaseDraft[K]) => setDraft((current) => ({ ...current, [key]: value }))
  function saveCase(event: FormEvent) { event.preventDefault(); const assessment = assessScope(draft); setScopeAssessment(assessment); setLastSaved(new Date()); if (assessment.result === 'unsupported') { recordCaseTransition(draft, 'out_of_scope', 'scope_exclusion_identified'); setStep('scope') } else { recordCaseTransition(draft, 'evidence_collection', assessment.result === 'uncertain' ? 'manual_scope_review_needed' : 'case_details_confirmed'); setStep('saved') } }
  async function startOver() { clearCase(); clearSubmission(); clearConsent(); clearPacks(); await clearEvidence(); setDraft(EMPTY_DRAFT); setConsent(false); setUrgentReasons([]); setLastSaved(null); setComplaintPack(null); setStep('welcome') }
  function openDataControls() { setReturnStep(step === 'data' ? 'welcome' : step); setStep('data') }
  async function resumeCase() {
    const record = readCase()
    if (!record) return
    if (!readConsent()) { if (!consent) return; acceptConsent() }
    setDraft(record.draft)
    if (record.status === 'out_of_scope') { setScopeAssessment(assessScope(record.draft)); setStep('scope'); return }
    if (record.status === 'draft') { setStep('case'); return }
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

  return <div className="app-shell">
    <header className="topbar"><button className="wordmark" type="button" onClick={() => setStep('welcome')} aria-label={text.home}>BUKTIVA<span aria-hidden="true">/</span></button><div className="header-actions"><div className="locale-switch" aria-label="Language / Bahasa"><button type="button" aria-pressed={locale === 'en'} onClick={() => setLocale('en')}>EN</button><button type="button" aria-pressed={locale === 'ms'} onClick={() => setLocale('ms')}>BM</button></div><button className="data-link" type="button" onClick={openDataControls}>{text.dataControls}</button><div className="pilot-label"><span /> {text.prototype}</div></div></header>
    <main>
      <nav className="progress" aria-label={text.progressLabel}>{text.progress.map((label, index) => <div className={index + 1 <= progress ? 'progress-item active' : 'progress-item'} key={label}><span>{String(index + 1).padStart(2, '0')}</span>{label}</div>)}</nav>

      {step === 'welcome' && <section className="page welcome-page">
        <div className="eyebrow">{text.welcome.eyebrow}</div><h1>{renderLines(text.welcome.title)}</h1>
        <p className="lede">{text.welcome.lede}</p>
        <div className="boundary-grid">{text.welcome.cards.map(([title, copy], index) => <article key={title}><span className="card-number">{String(index + 1).padStart(2, '0')}</span><h2>{title}</h2><p>{copy}</p></article>)}</div>
        <aside className="notice" aria-labelledby="before-title"><div><span className="notice-mark">i</span><div><h2 id="before-title">{text.welcome.before}</h2><p>{text.welcome.notice}</p></div></div><label className="check-row"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>{text.welcome.consent}</span></label></aside>
        <div className="actions">{readCase() ? <button className="primary" disabled={!consent} onClick={() => void resumeCase()}>{text.welcome.resume} <span>→</span></button> : <button className="primary" disabled={!consent} onClick={() => { acceptConsent(); setStep('triage') }}>{text.welcome.begin} <span>→</span></button>}</div>
      </section>}

      {step === 'triage' && <section className="page narrow-page">
        <div className="eyebrow">{text.triage.eyebrow}</div><h1>{renderLines(text.triage.title)}</h1><p className="lede">{text.triage.lede}</p>
        <fieldset className="choice-list"><legend className="sr-only">{text.triage.legend}</legend>{text.triage.reasons.map(([value, label]) => <label className="choice" key={value}><input type="checkbox" checked={urgentReasons.includes(value)} onChange={() => toggleUrgent(value)} /><span className="choice-box" aria-hidden="true">✓</span><span>{label}</span></label>)}</fieldset>
        {isUrgent && <div className="urgent-panel" role="alert"><strong>{text.triage.pause}</strong><p>{text.triage.urgent}</p><div className="official-links"><a href="https://www.bnm.gov.my/faqs/scams" target="_blank" rel="noreferrer">{text.triage.bnm}</a><a href="https://nfcc.jpm.gov.my/index.php/en/about-nsrc" target="_blank" rel="noreferrer">{text.triage.nsrc}</a></div><p className="source-note">{text.triage.source}</p></div>}
        <div className="actions split"><button className="secondary" onClick={() => setStep('welcome')}>{text.triage.back}</button>{!isUrgent && <button className="primary" onClick={() => setStep('case')}>{text.triage.continue} <span>→</span></button>}</div>
      </section>}

      {step === 'case' && <section className="page form-page">
        <div className="form-heading"><div><div className="eyebrow">{caseText.eyebrow}</div><h1>{caseText.title}</h1></div><div className="save-state"><span /> {lastSaved ? `${caseText.saved} ${lastSaved.toLocaleTimeString(locale === 'ms' ? 'ms-MY' : 'en-MY', { hour: '2-digit', minute: '2-digit' })}` : caseText.savedDevice}</div></div><p className="lede">{caseText.lede}</p>
        <form onSubmit={saveCase}>
          <div className="form-section"><SectionTitle number="01" title={caseText.transaction} copy={caseText.transactionCopy} /><div className="fields two-col"><label>{caseText.consumerName}<input required value={draft.consumerName} onChange={(e) => updateDraft('consumerName', e.target.value)} placeholder={caseText.consumerNamePlaceholder} /></label><label>{caseText.consumerLocation}<select required value={draft.consumerLocation} onChange={(e) => updateDraft('consumerLocation', e.target.value as CaseDraft['consumerLocation'])}><option value="">{caseText.selectLocation}</option><option value="malaysia">{caseText.malaysia}</option><option value="outside">{caseText.outside}</option></select></label><label>{caseText.seller}<input required value={draft.seller} onChange={(e) => updateDraft('seller', e.target.value)} placeholder={caseText.sellerPlaceholder} /></label><label>{caseText.sellerLocation}<select required value={draft.sellerLocation} onChange={(e) => updateDraft('sellerLocation', e.target.value as CaseDraft['sellerLocation'])}><option value="">{caseText.selectKnown}</option><option value="malaysia">{caseText.malaysia}</option><option value="outside">{caseText.outside}</option><option value="unknown">{caseText.unknown}</option></select></label><label>{caseText.platform} <span className="optional">{caseText.optional}</span><input value={draft.platform} onChange={(e) => updateDraft('platform', e.target.value)} placeholder={caseText.platformPlaceholder} /></label><label>{caseText.purchaseDate}<input required type="date" value={draft.purchaseDate} onChange={(e) => updateDraft('purchaseDate', e.target.value)} /></label><label>{caseText.amount}<input required min="0" step="0.01" type="number" value={draft.amount} onChange={(e) => updateDraft('amount', e.target.value)} placeholder="0.00" /></label><label>{caseText.paymentMethod}<select required value={draft.paymentMethod} onChange={(e) => updateDraft('paymentMethod', e.target.value)}><option value="">{caseText.selectMethod}</option>{caseText.methods.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>{caseText.reference} <span className="optional">{caseText.optional}</span><input value={draft.orderReference} onChange={(e) => updateDraft('orderReference', e.target.value)} placeholder={caseText.referencePlaceholder} /></label></div></div>
          <div className="form-section"><SectionTitle number="02" title={caseText.purposeProblem} copy={caseText.purposeProblemCopy} /><div className="fields two-col"><label>{caseText.purpose}<select required value={draft.purpose} onChange={(e) => updateDraft('purpose', e.target.value as CaseDraft['purpose'])}><option value="">{caseText.selectPurpose}</option><option value="personal">{caseText.personal}</option><option value="business">{caseText.business}</option></select></label><label>{caseText.category}<select required value={draft.category} onChange={(e) => updateDraft('category', e.target.value as CaseDraft['category'])}><option value="">{caseText.selectCategory}</option>{caseText.categories.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>{caseText.issue}<select required value={draft.issue} onChange={(e) => updateDraft('issue', e.target.value as CaseDraft['issue'])}><option value="">{caseText.selectIssue}</option>{caseText.issues.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div></div>
          <div className="form-section"><SectionTitle number="03" title={caseText.remedyTitle} copy={caseText.remedyCopy} /><div className="fields two-col"><label>{caseText.remedy}<select required value={draft.remedy} onChange={(e) => updateDraft('remedy', e.target.value as CaseDraft['remedy'])}><option value="">{caseText.selectRemedy}</option>{caseText.remedies.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>{draft.remedy === 'refund' && <label>{caseText.refundAmount}<input required min="0" step="0.01" type="number" value={draft.remedyAmount} onChange={(e) => updateDraft('remedyAmount', e.target.value)} placeholder="0.00" /></label>}</div></div>
          <div className="form-section"><SectionTitle number="04" title={caseText.contactTitle} copy={caseText.contactCopy} /><div className="fields two-col"><label>{caseText.promisedDate} <span className="optional">{caseText.ifKnown}</span><input type="date" value={draft.promisedDate} onChange={(e) => updateDraft('promisedDate', e.target.value)} /></label><label>{caseText.merchantContact}<select required value={draft.contactHistory} onChange={(e) => updateDraft('contactHistory', e.target.value as CaseDraft['contactHistory'])}><option value="">{caseText.selectContact}</option>{caseText.contacts.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>{draft.contactHistory && draft.contactHistory !== 'none' && <label>{caseText.latestContact}<input required type="date" value={draft.contactDate} onChange={(e) => updateDraft('contactDate', e.target.value)} /></label>}</div></div>
          <div className="privacy-line"><strong>{caseText.privacyLead}</strong> {caseText.privacy}</div><div className="actions split"><button type="button" className="secondary" onClick={() => setStep('triage')}>{caseText.back}</button><button className="primary" type="submit">{caseText.save} <span>→</span></button></div>
        </form>
      </section>}

      {step === 'saved' && <section className="page narrow-page saved-page"><div className="success-mark">✓</div><div className="eyebrow">{text.draftSaved.eyebrow}</div><h1>{renderLines(text.draftSaved.title)}</h1><p className="lede">{text.draftSaved.lede}</p><dl className="summary"><div><dt>{text.draftSaved.seller}</dt><dd>{draft.seller}</dd></div><div><dt>{text.draftSaved.amount}</dt><dd>RM {Number(draft.amount).toFixed(2)}</dd></div><div><dt>{text.draftSaved.issue}</dt><dd>{labelFor(caseText.issues, draft.issue)}</dd></div><div><dt>{text.draftSaved.remedy}</dt><dd>{labelFor(caseText.remedies, draft.remedy)}</dd></div></dl><div className="actions split"><button className="secondary" onClick={() => void startOver()}>{text.draftSaved.delete}</button><div className="button-group"><button className="secondary" onClick={() => setStep('case')}>{text.draftSaved.edit}</button><button className="primary" onClick={() => setStep('evidence')}>{text.draftSaved.evidence} <span>→</span></button></div></div></section>}
      {step === 'scope' && scopeAssessment && <OutOfScopeStep locale={locale} draft={draft} assessment={scopeAssessment} onEdit={() => setStep('case')} onDelete={startOver} />}
      {step === 'evidence' && <EvidenceStep locale={locale} onBack={() => setStep('case')} onContinue={(items) => { void listExtractions().then((records) => { setReviewEvidence(items); setExtractions(records); if (records.some((record) => record.candidates.some((item) => item.status === 'unconfirmed'))) { recordCaseTransition(draft, 'confirmation', 'extracted_facts_require_confirmation'); setStep('extraction') } else { recordCaseTransition(draft, 'review', 'evidence_review_requested'); setStep('review') } }) }} />}
      {step === 'extraction' && <ExtractionStep locale={locale} initialExtractions={extractions} evidence={reviewEvidence} onBack={() => setStep('evidence')} onContinue={(records) => { setExtractions(records); recordCaseTransition(draft, 'review', 'extracted_facts_reviewed'); setStep('review') }} />}
      {step === 'review' && <ReviewStep locale={locale} draft={draft} evidence={reviewEvidence} extractions={extractions} onBack={() => setStep('evidence')} onPrepare={(route) => { recordCaseTransition(draft, 'ready_for_pack', 'route_confirmed'); const pack = createComplaintPack(draft, reviewEvidence, route, new Date(), nextPackVersion(), extractions); savePack(pack); setComplaintPack(pack); setStep('pack') }} />}
      {step === 'pack' && complaintPack && <PackStep locale={locale} initialPack={complaintPack} onBack={() => setStep('review')} onApproved={(approved) => { savePack(approved); recordCaseTransition(draft, 'approved', `pack_v${approved.version}_approved`) }} onContinue={() => setStep('status')} />}
      {step === 'status' && <StatusStep locale={locale} onBack={() => setStep(complaintPack ? 'pack' : 'review')} onStatusChange={(status) => recordCaseTransition(draft, status, 'external_status_recorded')} />}
      {step === 'data' && <DataControls locale={locale} draft={draft} onBack={() => setStep(returnStep)} onDelete={startOver} />}
    </main>
    <footer><p>Buktiva by DOVUN</p><p>{text.footer}</p></footer>
  </div>
}

function SectionTitle({ number, title, copy }: { number: string; title: string; copy: string }) { return <div className="section-title"><span>{number}</span><div><h2>{title}</h2><p>{copy}</p></div></div> }
function renderLines(value: string) { return value.split('\n').map((line, index) => <span key={line}>{index > 0 && <br />}{line}</span>) }
function labelFor(options: ReadonlyArray<readonly [string, string]>, value: string) { return options.find(([key]) => key === value)?.[1] ?? value.replaceAll('_', ' ') }
export default App
