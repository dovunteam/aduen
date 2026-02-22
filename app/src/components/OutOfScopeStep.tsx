import type { CaseDraft } from '../domain/case'
import type { ScopeAssessment } from '../domain/scope'
import { scopeHandoff } from '../domain/scopeHandoff'
import type { ScopeHandoff } from '../domain/scopeHandoff'
import type { Locale } from '../i18n'

export function OutOfScopeStep({ locale, draft, assessment, onEdit, onDelete }: { locale: Locale; draft: CaseDraft; assessment: ScopeAssessment; onEdit: () => void; onDelete: () => Promise<void> }) {
  const text = scopeText[locale]
  const handoff = scopeHandoff(draft.category)
  const handoffCopy = handoff ? handoffText(handoff.destination, locale, handoff.current) : null

  return <section className="page narrow-page scope-page">
    <div className="scope-mark">—</div><div className="eyebrow">{text.eyebrow}</div><h1>{text.title}</h1><p className="lede">{text.lede}</p>
    <div className="scope-reasons"><strong>{text.reasonsTitle}</strong><ul>{assessment.reasons.map((reason) => <li key={reason}>{scopeReason(reason, locale)}</li>)}</ul></div>
    <div className="notice"><div><span className="notice-mark">i</span><div><h2>{text.whatNext}</h2><p>{text.nextCopy}</p>{handoff && handoffCopy && <div className="official-links"><a href={handoff.url} target="_blank" rel="noreferrer">{handoffCopy.link}</a><p className="source-note">{handoffCopy.note(handoff.checked)}</p></div>}</div></div></div>
    <div className="actions split"><button className="secondary" onClick={() => void onDelete()}>{text.delete}</button><button className="primary" onClick={onEdit}>{text.review} <span>→</span></button></div>
  </section>
}

const scopeText = {
  en: { eyebrow: 'Outside the prototype scope', title: 'Aduen should not prepare this case.', lede: 'The current prototype is limited to ordinary personal or household purchases by consumers in Malaysia. It will not force this case into a route that may not apply.', reasonsTitle: 'Why the workflow stopped', whatNext: 'What you can do', nextCopy: 'Review the details in case the purpose, location, or category was entered incorrectly. Otherwise, use an authoritative source or qualified adviser for the relevant sector. Aduen has not collected evidence for this case.', delete: 'Delete draft', review: 'Review case details' },
  ms: { eyebrow: 'Di luar skop prototaip', title: 'Aduen tidak sepatutnya menyediakan kes ini.', lede: 'Prototaip semasa terhad kepada pembelian biasa peribadi atau isi rumah oleh pengguna di Malaysia. Ia tidak akan memaksa kes ini ke dalam laluan yang mungkin tidak terpakai.', reasonsTitle: 'Mengapa aliran kerja dihentikan', whatNext: 'Tindakan yang boleh anda ambil', nextCopy: 'Semak butiran sekiranya tujuan, lokasi, atau kategori dimasukkan dengan salah. Jika tidak, gunakan sumber berautoriti atau penasihat yang berkelayakan untuk sektor berkenaan. Aduen belum mengumpul bukti untuk kes ini.', delete: 'Padam draf', review: 'Semak butiran kes' },
} as const

function scopeReason(reason: string, locale: Locale) {
  if (locale === 'en') return reason
  if (reason === 'Claims arising from personal injury or death are excluded from TTPM jurisdiction.') return 'Tuntutan akibat kecederaan diri atau kematian dikecualikan daripada bidang kuasa TTPM.'
  if (reason === 'Wills, inheritance, and estate-rights disputes are excluded from TTPM jurisdiction.') return 'Pertikaian wasiat, pewarisan, dan hak harta pusaka dikecualikan daripada bidang kuasa TTPM.'
  if (reason === 'Franchise disputes are excluded from TTPM jurisdiction.') return 'Pertikaian francais dikecualikan daripada bidang kuasa TTPM.'
  if (reason === 'Goodwill, trade-secret, and intellectual-property disputes are excluded from TTPM jurisdiction.') return 'Pertikaian nama baik, rahsia perdagangan, dan harta intelek dikecualikan daripada bidang kuasa TTPM.'
  if (reason === 'This subject may belong to another tribunal and is outside the prototype’s supported scope.') return 'Perkara ini mungkin di bawah bidang kuasa tribunal lain dan di luar skop prototaip.'
  return ({ 'The purchase was for business or professional use.': 'Pembelian adalah untuk kegunaan perniagaan atau profesional.', 'The consumer is outside the prototype’s Malaysian scope.': 'Pengguna berada di luar skop Malaysia bagi prototaip ini.', 'Airline and airport matters need a current sector-specific process.': 'Hal syarikat penerbangan dan lapangan terbang memerlukan proses sektor khusus yang terkini.', 'Regulated financial-service complaints need a current provider and sector process.': 'Aduan perkhidmatan kewangan terkawal memerlukan proses penyedia dan sektor yang terkini.', 'Healthcare matters are excluded from this prototype.': 'Hal penjagaan kesihatan dikecualikan daripada prototaip ini.', 'Regulated professional services are excluded from this prototype.': 'Perkhidmatan profesional terkawal dikecualikan daripada prototaip ini.', 'Land and property matters are excluded from this prototype.': 'Hal tanah dan hartanah dikecualikan daripada prototaip ini.' } as Record<string, string>)[reason] ?? reason
}

function handoffText(destination: ScopeHandoff['destination'], locale: Locale, current: boolean) {
  if (destination === 'caam') return locale === 'ms'
    ? { link: current ? 'Buka panduan aduan CAAM/FlySmart' : 'Buka sumber rasmi CAAM', note: (checked: string) => current ? `Hubungi syarikat penerbangan, lapangan terbang atau penyedia dahulu. CAAM menyatakan aduan boleh dibuat melalui FlySmart jika tidak selesai selepas 30 hari. Sumber disemak ${checked}.` : `Semakan sumber ini sudah melebihi 180 hari. Semak proses semasa terus dengan CAAM. Sumber terakhir disemak ${checked}.` }
    : { link: current ? 'Open CAAM/FlySmart complaint guidance' : 'Open official CAAM source', note: (checked: string) => current ? `Contact the airline, airport, or provider first. CAAM says a FlySmart complaint may be made if it is unresolved after 30 days. Source checked ${checked}.` : `This source review is over 180 days old. Check the current process directly with CAAM. Last checked ${checked}.` }
  return locale === 'ms'
    ? { link: current ? 'Buka proses aduan Bank Negara Malaysia' : 'Buka sumber rasmi Bank Negara Malaysia', note: (checked: string) => current ? `Adu kepada Unit Aduan penyedia perkhidmatan kewangan terlebih dahulu. BNM menyatakan aduan yang belum dirujuk kepada penyedia tidak diterima. Jika tiada respons selepas 14 hari, anda boleh merujuk kes kepada BNMLINK; jika tidak berpuas hati dengan keputusan, rujuk saluran tebus rugi yang berkaitan. Sumber disemak ${checked}.` : `Semakan sumber ini sudah melebihi 180 hari. Semak proses semasa terus dengan BNM. Sumber terakhir disemak ${checked}.` }
    : { link: current ? 'Open Bank Negara Malaysia complaint process' : 'Open official Bank Negara Malaysia source', note: (checked: string) => current ? `Complain to the financial service provider’s Complaints Unit first. BNM says it will not accept complaints not first referred to the provider. If there is no response after 14 days, you may refer the case to BNMLINK; if you are dissatisfied with the decision, use the relevant redress channel. Source checked ${checked}.` : `This source review is over 180 days old. Check the current process directly with BNM. Last checked ${checked}.` }
}
