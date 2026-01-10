import type { CaseDraft } from '../domain/case'
import { buildTimeline, checkCompleteness, findTimelineWarnings } from '../domain/caseReview'
import type { EvidenceMetadata } from '../domain/evidence'

type Props = { draft: CaseDraft; evidence: EvidenceMetadata[]; onBack: () => void }

export function ReviewStep({ draft, evidence, onBack }: Props) {
  const checks = checkCompleteness(draft, evidence)
  const timeline = buildTimeline(draft, evidence)
  const warnings = findTimelineWarnings(draft, timeline)
  const missingRequired = checks.filter((item) => item.level === 'required' && !item.satisfied).length

  return <section className="page form-page">
    <div className="review-heading"><div><div className="eyebrow">Tuntiva Check</div><h1>Review the record.</h1><p className="lede">This check uses the selected case type and included evidence. It identifies gaps; it does not decide whether the claim will succeed.</p></div><div className={`check-score ${missingRequired ? 'incomplete' : 'complete'}`}><strong>{missingRequired}</strong><span>required {missingRequired === 1 ? 'item' : 'items'} missing</span></div></div>

    <section className="review-section" aria-labelledby="check-title"><div className="section-title"><span>01</span><div><h2 id="check-title">Completeness</h2><p>Each prompt names the product rule that caused it.</p></div></div><div className="check-list">{checks.map((item) => <article className={item.satisfied ? 'check-item satisfied' : 'check-item'} key={item.id}><span className="check-symbol" aria-hidden="true">{item.satisfied ? '✓' : '!'}</span><div><div className="check-label"><strong>{item.label}</strong><span>{item.level}</span></div><p>{item.reason}</p><small>Source: {item.source}</small></div></article>)}</div></section>

    <section className="review-section" aria-labelledby="timeline-title"><div className="section-title"><span>02</span><div><h2 id="timeline-title">Tuntiva Timeline</h2><p>Dates come only from confirmed case details or your evidence descriptions.</p></div></div><div>{warnings.length > 0 && <div className="timeline-warnings">{warnings.map((warning) => <p key={warning}>! {warning}</p>)}</div>}<ol className="timeline">{timeline.map((item) => <li className={!item.date ? 'uncertain' : ''} key={item.id}><time>{item.date ? new Date(`${item.date}T00:00:00`).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Date unknown'}</time><div><strong>{item.label}</strong><p>{item.detail}</p><small>{item.source}</small></div></li>)}</ol></div></section>

    <section className="route-preview"><div className="eyebrow">Next route</div><h2>Routing is paused for review.</h2><p>The case does not yet record whether a clear written request has reached the merchant. Tuntiva will not guess. Add that fact before a route or complaint pack is prepared.</p><small>Rule considered: R-010 Merchant-first · Confidence: uncertain</small></section>
    <div className="actions split"><button className="secondary" onClick={onBack}>← Evidence</button><button className="primary" disabled>Routing not ready</button></div>
  </section>
}
