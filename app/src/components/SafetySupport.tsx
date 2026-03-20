import type { Locale } from '../i18n'
import { FeatureIcon } from './FeatureIcon'
import { featureIconNames } from './featureIcons'

const benefits = {
  en: ['Identify risks that are still ongoing', 'Put immediate help first', 'Organise your case when it is safe to continue'],
  ms: ['Kenal pasti risiko yang masih berlaku', 'Utamakan bantuan segera', 'Susun kes apabila selamat untuk meneruskan'],
}

export function SafetySupport({ locale }: { locale: Locale }) {
  const ms = locale === 'ms'

  return (
    <aside className="safety-support">
      <div className="support-card">
        <FeatureIcon name="shield" />
        <div className="eyebrow">{ms ? 'KESELAMATAN DIDAHULUKAN' : 'SAFETY COMES FIRST'}</div>
        <h2>{ms ? 'Mengapa kami bertanya' : 'Why we ask this'}</h2>
        <p>
          {ms
            ? 'Situasi mendesak mungkin memerlukan bantuan segera daripada bank atau pihak berkuasa. Menyediakan aduan biasa boleh mengambil masa.'
            : 'Urgent situations may need immediate help from your bank or the relevant authorities. Preparing an ordinary complaint takes time.'}
        </p>
        <ul>
          {benefits[locale].map((line, index) => (
            <li key={line}>
              <FeatureIcon name={featureIconNames[index]} />
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <small>{ms ? 'Aduen bukan perkhidmatan kecemasan.' : 'Aduen is not an emergency service.'}</small>
      </div>
    </aside>
  )
}
