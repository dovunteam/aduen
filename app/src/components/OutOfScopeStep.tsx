import type { ScopeAssessment } from '../domain/scope'
import type { Locale } from '../i18n'

export function OutOfScopeStep({ locale, assessment, onEdit, onDelete }: { locale: Locale; assessment: ScopeAssessment; onEdit: () => void; onDelete: () => Promise<void> }) {
  const text = scopeText[locale]
  return <section className="page narrow-page scope-page"><div className="scope-mark">—</div><div className="eyebrow">{text.eyebrow}</div><h1>{text.title}</h1><p className="lede">{text.lede}</p><div className="scope-reasons"><strong>{text.reasonsTitle}</strong><ul>{assessment.reasons.map((reason) => <li key={reason}>{scopeReason(reason, locale)}</li>)}</ul></div><div className="notice"><div><span className="notice-mark">i</span><div><h2>{text.whatNext}</h2><p>{text.nextCopy}</p></div></div></div><div className="actions split"><button className="secondary" onClick={() => void onDelete()}>{text.delete}</button><button className="primary" onClick={onEdit}>{text.review} <span>→</span></button></div></section>
}

const scopeText = {
  en: { eyebrow: 'Outside the prototype scope', title: 'Buktiva should not prepare this case.', lede: 'The current prototype is limited to ordinary personal or household purchases by consumers in Malaysia. It will not force this case into a route that may not apply.', reasonsTitle: 'Why the workflow stopped', whatNext: 'What you can do', nextCopy: 'Review the details in case the purpose, location, or category was entered incorrectly. Otherwise, use an authoritative source or qualified adviser for the relevant sector. Buktiva has not collected evidence for this case.', delete: 'Delete draft', review: 'Review case details' },
  ms: { eyebrow: 'Di luar skop prototaip', title: 'Buktiva tidak sepatutnya menyediakan kes ini.', lede: 'Prototaip semasa terhad kepada pembelian biasa peribadi atau isi rumah oleh pengguna di Malaysia. Ia tidak akan memaksa kes ini ke dalam laluan yang mungkin tidak terpakai.', reasonsTitle: 'Mengapa aliran kerja dihentikan', whatNext: 'Tindakan yang boleh anda ambil', nextCopy: 'Semak butiran sekiranya tujuan, lokasi, atau kategori dimasukkan dengan salah. Jika tidak, gunakan sumber berautoriti atau penasihat yang berkelayakan untuk sektor berkenaan. Buktiva belum mengumpul bukti untuk kes ini.', delete: 'Padam draf', review: 'Semak butiran kes' },
} as const

function scopeReason(reason: string, locale: Locale) {
  if (locale === 'en') return reason
  return ({ 'The purchase purpose is business or professional.': 'Tujuan pembelian ialah perniagaan atau profesional.', 'The consumer is outside Malaysia.': 'Pengguna berada di luar Malaysia.', 'The purchase is in an excluded sector for this prototype.': 'Pembelian dalam sektor yang dikecualikan untuk prototaip ini.', 'The seller is outside Malaysia, so the current route needs manual review.': 'Penjual berada di luar Malaysia, jadi laluan semasa memerlukan semakan manual.' } as Record<string, string>)[reason] ?? reason
}
