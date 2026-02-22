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
  const routeName = locale === 'ms' ? localizeRouteName(route.routeName) : route.routeName
  const routeAction = locale === 'ms' ? localizeRouteAction(route.recommendedAction) : route.recommendedAction
  const routeFacts = route.matchingFacts.map((fact) => locale === 'ms' ? localizeRouteFact(fact, route.sourceChecked) : fact)
  const routePrerequisites = route.unmetPrerequisites.map((item) => locale === 'ms' ? localizeRoutePrerequisite(item) : item)
  const routeSource = locale === 'ms' ? localizeRouteSource(route.source) : route.source

  return <section className="page form-page">
    <div className="review-heading"><div><div className="eyebrow">{text.eyebrow}</div><h1>{text.title}</h1><p className="lede">{text.lede}</p></div><div className={`check-score ${missingRequired ? 'incomplete' : 'complete'}`}><strong>{missingRequired}</strong><span>{text.missing(missingRequired)}</span></div></div>

    <section className="review-section" aria-labelledby="check-title"><div className="section-title"><span>01</span><div><h2 id="check-title">{text.completeness}</h2><p>{text.completenessCopy}</p></div></div><div>{conflicts.length > 0 && <div className="conflict-panel" role="alert"><strong>{text.conflicts}</strong>{conflicts.map((conflict) => <p key={conflict}>! {localizeFactConflict(conflict, locale)}</p>)}</div>}<div className="check-list">{checks.map((item) => <article className={item.satisfied ? 'check-item satisfied' : 'check-item'} key={item.id}><span className="check-symbol" aria-hidden="true">{item.satisfied ? '✓' : '!'}</span><div><div className="check-label"><strong>{item.label}</strong><span>{item.level === 'required' ? text.required : text.useful}</span></div><p>{item.reason}</p><small>{text.source}: {item.source}</small></div></article>)}</div></div></section>

    <section className="review-section" aria-labelledby="timeline-title"><div className="section-title"><span>02</span><div><h2 id="timeline-title">{text.timeline}</h2><p>{text.timelineCopy}</p></div></div><div>{warnings.length > 0 && <div className="timeline-warnings">{warnings.map((warning) => <p key={warning}>! {warning}</p>)}</div>}<ol className="timeline">{timeline.map((item) => <li className={!item.date ? 'uncertain' : ''} key={item.id}><time>{item.date ? new Date(`${item.date}T00:00:00`).toLocaleDateString(locale === 'ms' ? 'ms-MY' : 'en-MY', { day: '2-digit', month: 'short', year: 'numeric' }) : text.dateUnknown}</time><div><strong>{item.label}</strong><p>{item.detail}</p><small>{item.source === 'confirmed case detail' ? text.confirmedDetail : text.userEvidence}</small></div></li>)}</ol></div></section>

    <section className={`route-preview ${route.confidence}`}><div className="eyebrow">{text.nextRoute} · {confidenceLabel(route.confidence, locale)}</div><h2>{routeName}</h2><p>{routeAction}</p><div className="route-details"><div><strong>{text.why}</strong><ul>{routeFacts.map((fact) => <li key={fact}>{fact}</li>)}</ul></div><div><strong>{text.stillNeeded}</strong>{routePrerequisites.length ? <ul>{routePrerequisites.map((item) => <li key={item}>{item}</li>)}</ul> : <p>{text.nothingNeeded}</p>}</div></div>{route.officialLinks?.length && <div className="official-links"><strong>{text.possibleDestinations}</strong>{route.officialLinks.map((link) => <a href={link.url} target="_blank" rel="noreferrer" key={link.url}>{link.label}</a>)}<small>{text.destinationNote}</small></div>}<small><a href={route.sourceUrl} target="_blank" rel="noreferrer">{text.viewSource(route.sourceType === 'official')}</a> · {routeSource} · {text.version} {route.ruleVersion} · {text.checked} {route.sourceChecked}. {text.acceptance}</small></section>
    <div className="actions split"><button className="secondary" onClick={onBack}>{text.back}</button><button className="primary" onClick={() => onPrepare(route)} disabled={route.confidence !== 'supported' || missingRequired > 0 || conflicts.length > 0}>{conflicts.length > 0 ? text.resolveConflicts : missingRequired > 0 ? text.completeRequired : route.confidence === 'supported' ? text.prepareRequest : text.manualReview}</button></div>
  </section>
}

const reviewText = {
  en: { eyebrow: 'Aduen Check', title: 'Review the record.', lede: 'This check uses the selected case type and included evidence. It identifies gaps; it does not decide whether the claim will succeed.', missing: (count: number) => `required ${count === 1 ? 'item' : 'items'} missing`, completeness: 'Completeness', completenessCopy: 'Each prompt names the product rule that caused it.', conflicts: 'Confirmed facts need review', required: 'required', useful: 'useful', source: 'Source', timeline: 'Aduen Timeline', timelineCopy: 'Dates come only from confirmed case details or your evidence descriptions.', dateUnknown: 'Date unknown', confirmedDetail: 'confirmed case detail', userEvidence: 'user-described evidence', nextRoute: 'Next route', why: 'Why this result', stillNeeded: 'Still needed', nothingNeeded: 'Nothing for this initial route.', possibleDestinations: 'Possible official destinations', destinationNote: 'These links are starting points only. Check the current requirements and eligibility yourself.', viewSource: (official: boolean) => `View ${official ? 'official source' : 'versioned product rule'}`, version: 'Version', checked: 'Checked', acceptance: 'The receiving body determines acceptance.', back: '← Evidence', resolveConflicts: 'Resolve fact conflicts', completeRequired: 'Complete required items', prepareRequest: 'Prepare merchant request', manualReview: 'Manual review needed' },
  ms: { eyebrow: 'Semakan Aduen', title: 'Semak rekod.', lede: 'Semakan ini menggunakan jenis kes yang dipilih dan bukti yang disertakan. Ia mengenal pasti jurang; ia tidak menentukan sama ada tuntutan akan berjaya.', missing: (count: number) => `${count} perkara wajib belum lengkap`, completeness: 'Kelengkapan', completenessCopy: 'Setiap gesaan menamakan peraturan produk yang menyebabkannya.', conflicts: 'Fakta yang disahkan perlu disemak', required: 'wajib', useful: 'berguna', source: 'Sumber', timeline: 'Garis masa Aduen', timelineCopy: 'Tarikh datang hanya daripada butiran kes yang disahkan atau keterangan bukti anda.', dateUnknown: 'Tarikh tidak diketahui', confirmedDetail: 'butiran kes disahkan', userEvidence: 'bukti yang diterangkan pengguna', nextRoute: 'Laluan seterusnya', why: 'Mengapa hasil ini', stillNeeded: 'Masih diperlukan', nothingNeeded: 'Tiada untuk laluan awal ini.', possibleDestinations: 'Destinasi rasmi yang mungkin', destinationNote: 'Pautan ini hanyalah titik permulaan. Semak sendiri keperluan dan kelayakan semasa.', viewSource: (official: boolean) => `Lihat ${official ? 'sumber rasmi' : 'peraturan produk berversikan'}`, version: 'Versi', checked: 'Disemak', acceptance: 'Badan penerima menentukan penerimaan.', back: '← Bukti', resolveConflicts: 'Selesaikan konflik fakta', completeRequired: 'Lengkapkan perkara wajib', prepareRequest: 'Sediakan permintaan peniaga', manualReview: 'Semakan manual diperlukan' },
} as const

function localizeRouteName(value: string): string {
  return ({
    'Manual source review': 'Semakan sumber manual',
    'Manual review': 'Semakan manual',
    'Out of supported scope': 'Di luar skop yang disokong',
    'Sector route review': 'Semakan laluan sektor',
    'Manual scope review': 'Semakan skop manual',
    'Merchant or platform first': 'Hubungi peniaga atau platform dahulu',
    'Manual route review': 'Semakan laluan manual',
  } as Record<string, string>)[value] ?? value
}

function localizeRouteAction(value: string): string {
  return ({
    'This route source review is overdue. Check current official guidance before taking the next step.': 'Semakan sumber laluan ini sudah melebihi tempoh. Semak panduan rasmi semasa sebelum mengambil langkah seterusnya.',
    'This prototype supports personal, domestic, or household purchases only.': 'Prototaip ini hanya menyokong pembelian peribadi, domestik, atau isi rumah.',
    'This prototype is scoped to consumers in Malaysia.': 'Skop prototaip ini terhad kepada pengguna di Malaysia.',
    'This category needs an independent route and is not handled by the prototype.': 'Kategori ini memerlukan laluan tersendiri dan tidak dikendalikan oleh prototaip ini.',
    'A current sector-specific source must be checked before recommending the next channel.': 'Sumber khusus sektor yang terkini perlu disemak sebelum saluran seterusnya dicadangkan.',
    'Clarify the main transaction failure before selecting a route.': 'Jelaskan masalah utama transaksi sebelum memilih laluan.',
    'Clarify the category and seller jurisdiction before preparing a routed complaint.': 'Jelaskan kategori dan bidang kuasa penjual sebelum menyediakan aduan berlaluan.',
    'Confirm the transaction amount before selecting a route.': 'Sahkan jumlah transaksi sebelum memilih laluan.',
    'Confirm the missing case facts before selecting a route.': 'Sahkan fakta kes yang belum lengkap sebelum memilih laluan.',
    'Send a clear written request with the transaction identity, failure, requested remedy, and a request for response.': 'Hantar permintaan bertulis yang jelas dengan butiran transaksi, masalah, penyelesaian yang diminta, dan permintaan untuk mendapatkan jawapan.',
    'Review the merchant contact and response before choosing any external escalation channel.': 'Semak hubungan dan jawapan peniaga sebelum memilih mana-mana saluran eskalasi luar.',
  } as Record<string, string>)[value] ?? value
}

function localizeRouteFact(value: string, sourceChecked: string): string {
  const fixed: Record<string, string> = {
    'Purchase recorded as business or professional': 'Pembelian direkodkan untuk tujuan perniagaan atau profesional.',
    'Issue type is uncertain': 'Jenis masalah belum dipastikan.',
    'Transaction amount is missing or invalid': 'Jumlah transaksi tiada atau tidak sah.',
    'The case record is incomplete': 'Rekod kes belum lengkap.',
    'No urgent exception declared': 'Tiada pengecualian mendesak dinyatakan.',
    'Purchase recorded as personal or household': 'Pembelian direkodkan untuk kegunaan peribadi atau isi rumah.',
    'The purchase purpose needs confirmation.': 'Tujuan pembelian perlu disahkan.',
    'The consumer location needs confirmation.': 'Lokasi pengguna perlu disahkan.',
    'The purchase category needs confirmation.': 'Kategori pembelian perlu disahkan.',
    'The seller location needs confirmation.': 'Lokasi penjual perlu disahkan.',
    'The purchase category needs manual review.': 'Kategori pembelian perlu disemak secara manual.',
    'The seller’s location may limit available recovery routes.': 'Lokasi penjual mungkin mengehadkan laluan pemulihan yang tersedia.',
    'The purchase was for business or professional use.': 'Pembelian adalah untuk kegunaan perniagaan atau profesional.',
    'The consumer is outside the prototype’s Malaysian scope.': 'Pengguna berada di luar skop Malaysia bagi prototaip ini.',
    'Airline and airport matters need a current sector-specific process.': 'Hal syarikat penerbangan dan lapangan terbang memerlukan proses sektor khusus yang terkini.',
    'Regulated financial-service complaints need a current provider and sector process.': 'Aduan perkhidmatan kewangan terkawal memerlukan proses penyedia dan sektor yang terkini.',
    'Healthcare matters are excluded from this prototype.': 'Hal penjagaan kesihatan dikecualikan daripada prototaip ini.',
    'Regulated professional services are excluded from this prototype.': 'Perkhidmatan profesional terkawal dikecualikan daripada prototaip ini.',
    'Land and property matters are excluded from this prototype.': 'Hal tanah dan hartanah dikecualikan daripada prototaip ini.',
    'Claims arising from personal injury or death are excluded from TTPM jurisdiction.': 'Tuntutan akibat kecederaan diri atau kematian dikecualikan daripada bidang kuasa TTPM.',
    'Wills, inheritance, and estate-rights disputes are excluded from TTPM jurisdiction.': 'Pertikaian wasiat, pewarisan, dan hak harta pusaka dikecualikan daripada bidang kuasa TTPM.',
    'Franchise disputes are excluded from TTPM jurisdiction.': 'Pertikaian francais dikecualikan daripada bidang kuasa TTPM.',
    'Goodwill, trade-secret, and intellectual-property disputes are excluded from TTPM jurisdiction.': 'Pertikaian nama baik, rahsia perdagangan, dan harta intelek dikecualikan daripada bidang kuasa TTPM.',
    'This subject may belong to another tribunal and is outside the prototype’s supported scope.': 'Perkara ini mungkin di bawah bidang kuasa tribunal lain dan di luar skop prototaip.',
    'TTPM check: confirm the purchase purpose and category.': 'Semakan TTPM: sahkan tujuan dan kategori pembelian.',
    'TTPM check: business or professional purchase is outside the documented consumer scope.': 'Semakan TTPM: pembelian perniagaan atau profesional berada di luar skop pengguna yang didokumenkan.',
    'TTPM check: this recorded category is listed as excluded or assigned to a sector-specific process.': 'Semakan TTPM: kategori ini disenaraikan sebagai dikecualikan atau diberikan kepada proses khusus sektor.',
    'TTPM check: confirm the transaction amount.': 'Semakan TTPM: sahkan jumlah transaksi.',
    'TTPM applies the RM50,000 limit to the claim amount and its three-year limit to when the claim accrued. Aduen records transaction amount and purchase date only, so it cannot assess either limit; verify both with TTPM.': 'TTPM menetapkan had RM50,000 bagi jumlah tuntutan dan had tiga tahun dari tarikh tuntutan bermula. Aduen hanya merekodkan jumlah transaksi dan tarikh pembelian, maka kedua-dua had ini tidak dapat dinilai; sila sahkan dengan TTPM.',
  }
  if (fixed[value]) return fixed[value]
  if (value.startsWith('Consumer location: ')) return `Lokasi pengguna: ${{ malaysia: 'Malaysia', outside: 'di luar Malaysia', 'not confirmed': 'belum disahkan' }[value.slice('Consumer location: '.length)] ?? value.slice('Consumer location: '.length)}`
  if (value.startsWith('Purchase category: ')) {
    const category = value.slice('Purchase category: '.length).replaceAll('_', ' ')
    const categories: Record<string, string> = {
      'general goods': 'barangan umum', 'general services': 'perkhidmatan umum', aviation: 'penerbangan',
      'financial service': 'perkhidmatan kewangan', healthcare: 'penjagaan kesihatan',
      'professional service': 'perkhidmatan profesional', land: 'tanah',
      'personal injury': 'kecederaan diri', 'wills estates': 'wasiat dan harta pusaka',
      franchise: 'francais', 'goodwill ip': 'nama baik dan harta intelek',
      'other tribunal': 'tribunal lain', other: 'lain',
    }
    return `Kategori pembelian: ${categories[category] ?? category}`
  }
  if (value.startsWith('Requested remedy: ')) return `Penyelesaian yang diminta: ${{ delivery: 'penghantaran', replacement: 'penggantian', repair: 'pembaikan', cancellation: 'pembatalan', refund: 'bayaran balik' }[value.slice('Requested remedy: '.length)] ?? value.slice('Requested remedy: '.length)}`
  if (value.startsWith('Merchant contact recorded: ')) return `Hubungan dengan peniaga direkodkan: ${{ contacted: 'telah dihubungi', responded: 'telah menjawab' }[value.slice('Merchant contact recorded: '.length)] ?? value.slice('Merchant contact recorded: '.length)}`
  if (value.startsWith('Contact date: ')) return `Tarikh hubungan: ${value.slice('Contact date: '.length)}`
  if (value.startsWith('Rule source last checked: ')) return `Sumber peraturan terakhir disemak: ${sourceChecked}`
  return value
}

function localizeRoutePrerequisite(value: string): string {
  const fixed: Record<string, string> = {
    'Review current route source': 'Semak sumber laluan semasa',
    'Live official sector requirements': 'Keperluan rasmi sektor yang terkini',
    'Reviewed category and seller jurisdiction': 'Kategori dan bidang kuasa penjual yang telah disemak',
    'Transaction amount': 'Jumlah transaksi',
    'Purchase purpose': 'Tujuan pembelian',
    'Consumer location': 'Lokasi pengguna',
    'Purchase category': 'Kategori pembelian',
    'Seller location': 'Lokasi penjual',
    'Issue type': 'Jenis masalah',
    'Requested remedy': 'Penyelesaian yang diminta',
    'Date of merchant contact': 'Tarikh hubungan dengan peniaga',
    'TTPM claim amount and accrual date require official verification': 'Jumlah tuntutan dan tarikh tuntutan bermula bagi TTPM perlu disahkan melalui sumber rasmi',
    'Order, receipt, or transaction record': 'Rekod pesanan, resit, atau transaksi',
    'Payment evidence': 'Bukti pembayaran',
    'Promised delivery or performance': 'Janji penghantaran atau pelaksanaan',
    'Seller contact': 'Hubungan dengan penjual',
    'Delivery or tracking record': 'Rekod penghantaran atau penjejakan',
    'Original listing or specification': 'Iklan atau spesifikasi asal',
    'Record of the item received': 'Rekod barang yang diterima',
    'Refund promise or status': 'Janji atau status bayaran balik',
    'Payment record showing non-receipt': 'Rekod pembayaran yang menunjukkan bayaran belum diterima',
    'Cancellation request': 'Permintaan pembatalan',
    'Payment or billing record': 'Rekod pembayaran atau bil',
    'Exact refund amount': 'Jumlah bayaran balik yang tepat',
  }
  return fixed[value] ?? value
}

function localizeRouteSource(value: string): string {
  return value.startsWith('Aduen Case Routing Rules') ? 'Peraturan Penghalaan Aduen — R-010 Hubungi peniaga dahulu' : value
}

function confidenceLabel(confidence: RouteEvaluation['confidence'], locale: Locale) {
  const labels = locale === 'ms' ? { supported: 'disokong', uncertain: 'tidak pasti', unsupported: 'tidak disokong' } : { supported: 'supported', uncertain: 'uncertain', unsupported: 'unsupported' }
  return labels[confidence]
}
