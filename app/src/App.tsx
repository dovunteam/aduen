import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type Step = 'welcome' | 'triage' | 'case' | 'saved'
type CaseDraft = {
  seller: string; platform: string; purchaseDate: string; amount: string
  paymentMethod: string; orderReference: string
  purpose: 'personal' | 'business' | ''
  issue: 'non_delivery' | 'mismatch' | 'missing_refund' | 'cancellation' | 'uncertain' | ''
  remedy: 'delivery' | 'replacement' | 'repair' | 'cancellation' | 'refund' | ''
  remedyAmount: string
}
const EMPTY_DRAFT: CaseDraft = { seller: '', platform: '', purchaseDate: '', amount: '', paymentMethod: '', orderReference: '', purpose: '', issue: '', remedy: '', remedyAmount: '' }
const STORAGE_KEY = 'tuntiva.case-draft.v1'

function readDraft(): CaseDraft {
  try { const saved = localStorage.getItem(STORAGE_KEY); return saved ? { ...EMPTY_DRAFT, ...JSON.parse(saved) } : EMPTY_DRAFT }
  catch { return EMPTY_DRAFT }
}

function App() {
  const [step, setStep] = useState<Step>('welcome')
  const [consent, setConsent] = useState(false)
  const [urgentReasons, setUrgentReasons] = useState<string[]>([])
  const [draft, setDraft] = useState<CaseDraft>(readDraft)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const isUrgent = urgentReasons.length > 0
  const progress = useMemo(() => ({ welcome: 1, triage: 2, case: 3, saved: 3 }[step]), [step])

  useEffect(() => {
    if (step !== 'case') return
    const timer = window.setTimeout(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(draft)); setLastSaved(new Date()) }, 400)
    return () => window.clearTimeout(timer)
  }, [draft, step])

  const toggleUrgent = (reason: string) => setUrgentReasons((current) => current.includes(reason) ? current.filter((item) => item !== reason) : [...current, reason])
  const updateDraft = <K extends keyof CaseDraft>(key: K, value: CaseDraft[K]) => setDraft((current) => ({ ...current, [key]: value }))
  function saveCase(event: FormEvent) { event.preventDefault(); localStorage.setItem(STORAGE_KEY, JSON.stringify(draft)); setLastSaved(new Date()); setStep('saved') }
  function startOver() { localStorage.removeItem(STORAGE_KEY); setDraft(EMPTY_DRAFT); setConsent(false); setUrgentReasons([]); setLastSaved(null); setStep('welcome') }

  return <div className="app-shell">
    <header className="topbar"><button className="wordmark" type="button" onClick={() => setStep('welcome')} aria-label="Tuntiva home">TUNTIVA<span aria-hidden="true">/</span></button><div className="pilot-label"><span /> Private prototype</div></header>
    <main>
      <nav className="progress" aria-label="Case setup progress">{['Understand', 'Safety check', 'Case details'].map((label, index) => <div className={index + 1 <= progress ? 'progress-item active' : 'progress-item'} key={label}><span>{String(index + 1).padStart(2, '0')}</span>{label}</div>)}</nav>

      {step === 'welcome' && <section className="page welcome-page">
        <div className="eyebrow">A clearer recovery path</div><h1>Put a failed purchase<br />into order.</h1>
        <p className="lede">Tuntiva helps you organise what happened, what you can prove, and what to do next. You stay in control of every detail and every submission.</p>
        <div className="boundary-grid"><article><span className="card-number">01</span><h2>Build the record</h2><p>Keep transaction details, dates, messages, and evidence together.</p></article><article><span className="card-number">02</span><h2>Check what is missing</h2><p>See gaps and uncertainties before approaching a merchant or official channel.</p></article><article><span className="card-number">03</span><h2>Choose the next step</h2><p>Review a reasoned route. Nothing is sent without your approval.</p></article></div>
        <aside className="notice" aria-labelledby="before-title"><div><span className="notice-mark">i</span><div><h2 id="before-title">Before you begin</h2><p>Tuntiva provides case organisation and general routing information. It does not guarantee recovery or provide legal representation.</p></div></div><label className="check-row"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>I understand Tuntiva's role and confirm that I am authorised to provide the information in this case.</span></label></aside>
        <div className="actions"><button className="primary" disabled={!consent} onClick={() => setStep('triage')}>Begin safety check <span>→</span></button></div>
      </section>}

      {step === 'triage' && <section className="page narrow-page">
        <div className="eyebrow">Safety check</div><h1>Does anything need<br />immediate action?</h1><p className="lede">Select everything that applies. Urgent issues should not wait while you prepare an ordinary complaint.</p>
        <fieldset className="choice-list"><legend className="sr-only">Urgent issues</legend>{[
          ['unauthorised', 'A payment or transaction was not authorised by me'], ['account', 'Someone may still have access to my account or credentials'], ['scam', 'I am being asked to send more money in an active scam'], ['safety', 'There is an immediate safety risk'], ['deadline', 'I know of an official deadline that is about to expire'],
        ].map(([value, label]) => <label className="choice" key={value}><input type="checkbox" checked={urgentReasons.includes(value)} onChange={() => toggleUrgent(value)} /><span className="choice-box" aria-hidden="true">✓</span><span>{label}</span></label>)}</fieldset>
        {isUrgent && <div className="urgent-panel" role="alert"><strong>Pause ordinary case preparation.</strong><p>Contact your bank or payment provider through its official number now if money or account access may still be at risk. For immediate danger, contact Malaysian emergency services. Tuntiva is not an emergency service.</p><p className="source-note">Use only contact details from your bank's official app, card, or website. Do not share an OTP, PIN, password, or recovery code.</p></div>}
        <div className="actions split"><button className="secondary" onClick={() => setStep('welcome')}>← Back</button>{!isUrgent && <button className="primary" onClick={() => setStep('case')}>No urgent issue — continue <span>→</span></button>}</div>
      </section>}

      {step === 'case' && <section className="page form-page">
        <div className="form-heading"><div><div className="eyebrow">Case details</div><h1>Describe the purchase.</h1></div><div className="save-state"><span /> {lastSaved ? `Saved ${lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Saved on this device'}</div></div><p className="lede">Start with what you know. You can leave optional fields blank and return later.</p>
        <form onSubmit={saveCase}>
          <div className="form-section"><SectionTitle number="01" title="Transaction" copy="Identify the purchase and seller." /><div className="fields two-col"><label>Seller or merchant<input required value={draft.seller} onChange={(e) => updateDraft('seller', e.target.value)} placeholder="Business or seller name" /></label><label>Platform <span className="optional">Optional</span><input value={draft.platform} onChange={(e) => updateDraft('platform', e.target.value)} placeholder="Website, marketplace, or app" /></label><label>Purchase date<input required type="date" value={draft.purchaseDate} onChange={(e) => updateDraft('purchaseDate', e.target.value)} /></label><label>Amount paid (RM)<input required min="0" step="0.01" type="number" value={draft.amount} onChange={(e) => updateDraft('amount', e.target.value)} placeholder="0.00" /></label><label>Payment method<select required value={draft.paymentMethod} onChange={(e) => updateDraft('paymentMethod', e.target.value)}><option value="">Select a method</option><option>Card</option><option>Bank transfer</option><option>E-wallet</option><option>Cash on delivery</option><option>Other</option></select></label><label>Order or reference number <span className="optional">Optional</span><input value={draft.orderReference} onChange={(e) => updateDraft('orderReference', e.target.value)} placeholder="Order ID or receipt number" /></label></div></div>
          <div className="form-section"><SectionTitle number="02" title="Purpose and problem" copy="This affects which routes may apply." /><div className="fields two-col"><label>Purchase purpose<select required value={draft.purpose} onChange={(e) => updateDraft('purpose', e.target.value as CaseDraft['purpose'])}><option value="">Select a purpose</option><option value="personal">Personal, household, or domestic</option><option value="business">Business or professional</option></select></label><label>What went wrong?<select required value={draft.issue} onChange={(e) => updateDraft('issue', e.target.value as CaseDraft['issue'])}><option value="">Select the main issue</option><option value="non_delivery">Goods or services not received</option><option value="mismatch">Materially different from advertised</option><option value="missing_refund">Promised refund not received</option><option value="cancellation">Cancellation or billing problem</option><option value="uncertain">I am not sure</option></select></label></div></div>
          <div className="form-section"><SectionTitle number="03" title="Requested remedy" copy="Choose one clear outcome." /><div className="fields two-col"><label>Primary remedy<select required value={draft.remedy} onChange={(e) => updateDraft('remedy', e.target.value as CaseDraft['remedy'])}><option value="">Select a remedy</option><option value="delivery">Delivery</option><option value="replacement">Replacement</option><option value="repair">Repair</option><option value="cancellation">Cancellation</option><option value="refund">Refund</option></select></label>{draft.remedy === 'refund' && <label>Refund amount (RM)<input required min="0" step="0.01" type="number" value={draft.remedyAmount} onChange={(e) => updateDraft('remedyAmount', e.target.value)} placeholder="0.00" /></label>}</div></div>
          <div className="privacy-line"><strong>Stored locally for this prototype.</strong> Do not enter passwords, PINs, OTPs, recovery codes, full card details, or unrelated personal information.</div><div className="actions split"><button type="button" className="secondary" onClick={() => setStep('triage')}>← Back</button><button className="primary" type="submit">Save case draft <span>→</span></button></div>
        </form>
      </section>}

      {step === 'saved' && <section className="page narrow-page saved-page"><div className="success-mark">✓</div><div className="eyebrow">Draft saved</div><h1>Your case record<br />has started.</h1><p className="lede">The draft is stored only in this browser. Evidence upload, timeline checks, and routing will be added in later increments.</p><dl className="summary"><div><dt>Seller</dt><dd>{draft.seller}</dd></div><div><dt>Amount</dt><dd>RM {Number(draft.amount).toFixed(2)}</dd></div><div><dt>Issue</dt><dd>{draft.issue.replaceAll('_', ' ')}</dd></div><div><dt>Remedy</dt><dd>{draft.remedy}</dd></div></dl><div className="actions split"><button className="secondary" onClick={startOver}>Delete draft</button><button className="primary" onClick={() => setStep('case')}>Edit details <span>→</span></button></div></section>}
    </main>
    <footer><p>Tuntiva by DOVUN</p><p>Case organisation, not legal representation.</p></footer>
  </div>
}

function SectionTitle({ number, title, copy }: { number: string; title: string; copy: string }) { return <div className="section-title"><span>{number}</span><div><h2>{title}</h2><p>{copy}</p></div></div> }
export default App
