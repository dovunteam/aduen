import type { Locale } from '../i18n'

const steps = [
  { icon: <><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v5h4M10 12h5m-5 4h5" /></> },
  { icon: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></> },
  { icon: <><path d="M4 12l5 5L20 6" /></> },
  { icon: <><path d="M4 12h16m-6-6 6 6-6 6" /></> },
]

export function CasePreview({ locale }: { locale: Locale }) {
  const ms = locale === 'ms'
  const labels = ms ? ['Bukti', 'Garis masa', 'Semakan Aduen', 'Langkah seterusnya'] : ['Evidence', 'Timeline', 'Aduen Check', 'Next step']
  return <div className="case-preview" role="img" aria-label={ms ? 'Ilustrasi langkah kes Aduen' : 'Illustration of Aduen case steps'}>
    <div className="preview-shape preview-shape-one" aria-hidden="true" />
    <div className="preview-shape preview-shape-two" aria-hidden="true" />
    <div className="preview-path" aria-hidden="true">
      {labels.map((label, index) => <div className="preview-step" key={label}>
        <span className={`preview-step-icon${index === 3 ? ' current' : ''}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{steps[index].icon}</svg></span>
        <span>{label}</span>
      </div>)}
    </div>
  </div>
}
