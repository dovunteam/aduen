import type { CaseDraft } from '../domain/case'
import { buildTimeline, checkCompleteness, findFactConflicts, findTimelineWarnings } from '../domain/caseReview'
import { localizeFactConflict } from '../caseReviewMessages'
import type { EvidenceMetadata } from '../domain/evidence'
import { evaluateInitialRoute } from '../domain/routing'
import type { RouteEvaluation } from '../domain/routing'
import type { EvidenceExtraction } from '../domain/extraction'
import type { Locale } from '../i18n'

type Props = { locale: Locale; draft: CaseDraft; evidence: EvidenceMetadata[]; extractions: EvidenceExtraction[]; onBack: () => void; onPrepare: (route: RouteEvaluation) => void }

export function ReviewStep({ locale, draft, evidence, extractions, onBack, onPrepare }: Props) {
  const text = reviewText[locale]
  const checks = checkCompleteness(draft, evidence)
  const timeline = buildTimeline(draft, evidence)
  const warnings = findTimelineWarnings(draft, timeline)
  const conflicts = findFactConflicts(draft, extractions)
  const missingRequired = checks.filter((item) => item.level === 'required' && !item.satisfied).length
  const route = evaluateInitialRoute(draft, checks)
  const staleSourceReview = route.routeName === 'Manual source review'
  const routeName = locale === 'ms' && staleSourceReview ? 'Semakan sumber manual' : route.routeName
  const routeAction = locale === 'ms' && staleSourceReview ? 'Semakan sumber laluan ini sudah melebihi tempoh. Semak panduan rasmi semasa sebelum meneruskan.' : route.recommendedAction
  const scopeFactsMs: Record<string, string> = {
    'The purchase purpose needs confirmation.': 'Tujuan pembelian perlu disahkan.',
    'The consumer location needs confirmation.': 'Lokasi pengguna perlu disahkan.',
    'The purchase category needs confirmation.': 'Kategori pembelian perlu disahkan.',
    'The seller location needs confirmation.': 'Lokasi penjual perlu disahkan.',
  }
  const routeFacts = route.matchingFacts.map((fact) => locale === 'ms' ? scopeFactsMs[fact] ?? (staleSourceReview && fact.startsWith('Rule source last checked:') ? `Sumber peraturan terakhir disemak: ${route.sourceChecked}` : fact) : fact)
  const routePrerequisites = route.unmetPrerequisites.map((item) => locale === 'ms' && staleSourceReview && item === 'Review current route source' ? 'Semak sumber laluan semasa' : item)

  return <section className="page form-page">
    <div className="review-heading"><div><div className="eyebrow">{text.eyebrow}</div><h1>{text.title}</h1><p className="lede">{text.lede}</p></div><div className={`check-score ${missingRequired ? 'incomplete' : 'complete'}`}><strong>{missingRequired}</strong><span>{text.missing(missingRequired)}</span></div></div>

    <section className="review-section" aria-labelledby="check-title"><div className="section-title"><span>01</span><div><h2 id="check-title">{text.completeness}</h2><p>{text.completenessCopy}</p></div></div><div>{conflicts.length > 0 && <div className="conflict-panel" role="alert"><strong>{text.conflicts}</strong>{conflicts.map((conflict) => <p key={conflict}>! {localizeFactConflict(conflict, locale)}</p>)}</div>}<div className="check-list">{checks.map((item) => <article className={item.satisfied ? 'check-item satisfied' : 'check-item'} key={item.id}><span className="check-symbol" aria-hidden="true">{item.satisfied ? '✓' : '!'}</span><div><div className="check-label"><strong>{item.label}</strong><span>{item.level === 'required' ? text.required : text.useful}</span></div><p>{item.reason}</p><small>{text.source}: {item.source}</small></div></article>)}</div></div></section>

    <section className="review-section" aria-labelledby="timeline-title"><div className="section-title"><span>02</span><div><h2 id="timeline-title">{text.timeline}</h2><p>{text.timelineCopy}</p></div></div><div>{warnings.length > 0 && <div className="timeline-warnings">{warnings.map((warning) => <p key={warning}>! {warning}</p>)}</div>}<ol className="timeline">{timeline.map((item) => <li className={!item.date ? 'uncertain' : ''} key={item.id}><time>{item.date ? new Date(`${item.date}T00:00:00`).toLocaleDateString(locale === 'ms' ? 'ms-MY' : 'en-MY', { day: '2-digit', month: 'short', year: 'numeric' }) : text.dateUnknown}</time><div><strong>{item.label}</strong><p>{item.detail}</p><small>{item.source === 'confirmed case detail' ? text.confirmedDetail : text.userEvidence}</small></div></li>)}</ol></div></section>

    <section className={`route-preview ${route.confidence}`}><div className="eyebrow">{text.nextRoute} · {confidenceLabel(route.confidence, locale)}</div><h2>{routeName}</h2><p>{routeAction}</p><div className="route-details"><div><strong>{text.why}</strong><ul>{routeFacts.map((fact) => <li key={fact}>{fact}</li>)}</ul></div><div><strong>{text.stillNeeded}</strong>{routePrerequisites.length ? <ul>{routePrerequisites.map((item) => <li key={item}>{item}</li>)}</ul> : <p>{text.nothingNeeded}</p>}</div></div>{route.officialLinks?.length && <div className="official-links"><strong>{text.possibleDestinations}</strong>{route.officialLinks.map((link) => <a href={link.url} target="_blank" rel="noreferrer" key={link.url}>{link.label}</a>)}<small>{text.destinationNote}</small></div>}<small><a href={route.sourceUrl} target="_blank" rel="noreferrer">{text.viewSource(route.sourceType === 'official')}</a> · {route.source} · {text.version} {route.ruleVersion} · {text.checked} {route.sourceChecked}. {text.acceptance}</small></section>
    <div className="actions split"><button className="secondary" onClick={onBack}>{text.back}</button><button className="primary" onClick={() => onPrepare(route)} disabled={route.confidence !== 'supported' || missingRequired > 0 || conflicts.length > 0}>{conflicts.length > 0 ? text.resolveConflicts : missingRequired > 0 ? text.completeRequired : route.confidence === 'supported' ? text.prepareRequest : text.manualReview}</button></div>
  </section>
}

const reviewText = {
  en: { eyebrow: 'Aduen Check', title: 'Review the record.', lede: 'This check uses the selected case type and included evidence. It identifies gaps; it does not decide whether the claim will succeed.', missing: (count: number) => `required ${count === 1 ? 'item' : 'items'} missing`, completeness: 'Completeness', completenessCopy: 'Each prompt names the product rule that caused it.', conflicts: 'Confirmed facts need review', required: 'required', useful: 'useful', source: 'Source', timeline: 'Aduen Timeline', timelineCopy: 'Dates come only from confirmed case details or your evidence descriptions.', dateUnknown: 'Date unknown', confirmedDetail: 'confirmed case detail', userEvidence: 'user-described evidence', nextRoute: 'Next route', why: 'Why this result', stillNeeded: 'Still needed', nothingNeeded: 'Nothing for this initial route.', possibleDestinations: 'Possible official destinations', destinationNote: 'These links are starting points only. Check the current requirements and eligibility yourself.', viewSource: (official: boolean) => `View ${official ? 'official source' : 'versioned product rule'}`, version: 'Version', checked: 'Checked', acceptance: 'The receiving body determines acceptance.', back: '← Evidence', resolveConflicts: 'Resolve fact conflicts', completeRequired: 'Complete required items', prepareRequest: 'Prepare merchant request', manualReview: 'Manual review needed' },
  ms: { eyebrow: 'Semakan Aduen', title: 'Semak rekod.', lede: 'Semakan ini menggunakan jenis kes yang dipilih dan bukti yang disertakan. Ia mengenal pasti jurang; ia tidak menentukan sama ada tuntutan akan berjaya.', missing: (count: number) => `${count} perkara wajib belum lengkap`, completeness: 'Kelengkapan', completenessCopy: 'Setiap gesaan menamakan peraturan produk yang menyebabkannya.', conflicts: 'Fakta yang disahkan perlu disemak', required: 'wajib', useful: 'berguna', source: 'Sumber', timeline: 'Garis masa Aduen', timelineCopy: 'Tarikh datang hanya daripada butiran kes yang disahkan atau keterangan bukti anda.', dateUnknown: 'Tarikh tidak diketahui', confirmedDetail: 'butiran kes disahkan', userEvidence: 'bukti yang diterangkan pengguna', nextRoute: 'Laluan seterusnya', why: 'Mengapa hasil ini', stillNeeded: 'Masih diperlukan', nothingNeeded: 'Tiada untuk laluan awal ini.', possibleDestinations: 'Destinasi rasmi yang mungkin', destinationNote: 'Pautan ini hanyalah titik permulaan. Semak sendiri keperluan dan kelayakan semasa.', viewSource: (official: boolean) => `Lihat ${official ? 'sumber rasmi' : 'peraturan produk berversikan'}`, version: 'Versi', checked: 'Disemak', acceptance: 'Badan penerima menentukan penerimaan.', back: '← Bukti', resolveConflicts: 'Selesaikan konflik fakta', completeRequired: 'Lengkapkan perkara wajib', prepareRequest: 'Sediakan permintaan peniaga', manualReview: 'Semakan manual diperlukan' },
} as const

function confidenceLabel(confidence: RouteEvaluation['confidence'], locale: Locale) {
  const labels = locale === 'ms' ? { supported: 'disokong', uncertain: 'tidak pasti', unsupported: 'tidak disokong' } : { supported: 'supported', uncertain: 'uncertain', unsupported: 'unsupported' }
  return labels[confidence]
}
