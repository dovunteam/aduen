import type { CaseDraft } from '../domain/case'
import { buildTimeline, checkCompleteness, findFactConflicts, findTimelineWarnings } from '../domain/caseReview'
import type { EvidenceMetadata } from '../domain/evidence'
import { evaluateInitialRoute } from '../domain/routing'
import type { RouteEvaluation } from '../domain/routing'
import type { EvidenceExtraction } from '../domain/extraction'

type Props = { draft: CaseDraft; evidence: EvidenceMetadata[]; extractions: EvidenceExtraction[]; onBack: () => void; onPrepare: (route: RouteEvaluation) => void }

export function ReviewStep({ draft, evidence, extractions, onBack, onPrepare }: Props) {
  const checks = checkCompleteness(draft, evidence)
  const timeline = buildTimeline(draft, evidence)
  const warnings = findTimelineWarnings(draft, timeline)
  const conflicts = findFactConflicts(draft, extractions)
  const missingRequired = checks.filter((item) => item.level === 'required' && !item.satisfied).length
  const route = evaluateInitialRoute(draft, checks)

  return <section className="page form-page">
    <div className="review-heading"><div><div className="eyebrow">Buktiva Check</div><h1>Review the record.</h1><p className="lede">This check uses the selected case type and included evidence. It identifies gaps; it does not decide whether the claim will succeed.</p></div><div className={`check-score ${missingRequired ? 'incomplete' : 'complete'}`}><strong>{missingRequired}</strong><span>required {missingRequired === 1 ? 'item' : 'items'} missing</span></div></div>

    <section className="review-section" aria-labelledby="check-title"><div className="section-title"><span>01</span><div><h2 id="check-title">Completeness</h2><p>Each prompt names the product rule that caused it.</p></div></div><div>{conflicts.length > 0 && <div className="conflict-panel" role="alert"><strong>Confirmed facts need review</strong>{conflicts.map((conflict) => <p key={conflict}>! {conflict}</p>)}</div>}<div className="check-list">{checks.map((item) => <article className={item.satisfied ? 'check-item satisfied' : 'check-item'} key={item.id}><span className="check-symbol" aria-hidden="true">{item.satisfied ? '✓' : '!'}</span><div><div className="check-label"><strong>{item.label}</strong><span>{item.level}</span></div><p>{item.reason}</p><small>Source: {item.source}</small></div></article>)}</div></div></section>

    <section className="review-section" aria-labelledby="timeline-title"><div className="section-title"><span>02</span><div><h2 id="timeline-title">Buktiva Timeline</h2><p>Dates come only from confirmed case details or your evidence descriptions.</p></div></div><div>{warnings.length > 0 && <div className="timeline-warnings">{warnings.map((warning) => <p key={warning}>! {warning}</p>)}</div>}<ol className="timeline">{timeline.map((item) => <li className={!item.date ? 'uncertain' : ''} key={item.id}><time>{item.date ? new Date(`${item.date}T00:00:00`).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Date unknown'}</time><div><strong>{item.label}</strong><p>{item.detail}</p><small>{item.source}</small></div></li>)}</ol></div></section>

    <section className={`route-preview ${route.confidence}`}><div className="eyebrow">Next route · {route.confidence}</div><h2>{route.routeName}</h2><p>{route.recommendedAction}</p><div className="route-details"><div><strong>Why this result</strong><ul>{route.matchingFacts.map((fact) => <li key={fact}>{fact}</li>)}</ul></div><div><strong>Still needed</strong>{route.unmetPrerequisites.length ? <ul>{route.unmetPrerequisites.map((item) => <li key={item}>{item}</li>)}</ul> : <p>Nothing for this initial route.</p>}</div></div><small><a href={route.sourceUrl} target="_blank" rel="noreferrer">View {route.sourceType === 'official' ? 'official source' : 'versioned product rule'}</a> · {route.source} · Version {route.ruleVersion} · Checked {route.sourceChecked}. The receiving body determines acceptance.</small></section>
    <div className="actions split"><button className="secondary" onClick={onBack}>← Evidence</button><button className="primary" onClick={() => onPrepare(route)} disabled={route.confidence !== 'supported' || missingRequired > 0 || conflicts.length > 0}>{conflicts.length > 0 ? 'Resolve fact conflicts' : missingRequired > 0 ? 'Complete required items' : route.confidence === 'supported' ? 'Prepare merchant request' : 'Manual review needed'}</button></div>
  </section>
}
