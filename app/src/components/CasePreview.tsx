import type { Locale } from '../i18n'
import { AduenBrand } from './AduenBrand'
import { FeatureIcon } from './FeatureIcon'

export function CasePreview({ locale }: { locale: Locale }) {
  const ms = locale === 'ms'
  return <div className="case-preview" role="img" aria-label={ms ? 'Contoh ilustrasi ruang kerja kes Aduen, bukan kes sebenar' : 'Illustrative Aduen case workspace, not a real case'}>
    <div className="preview-shape preview-shape-one" aria-hidden="true" /><div className="preview-shape preview-shape-two" aria-hidden="true" />
    <div className="preview-workspace" aria-hidden="true">
      <div className="preview-topbar"><AduenBrand compact /><span>{ms ? 'CONTOH RUANG KERJA' : 'EXAMPLE WORKSPACE'}</span></div>
      <div className="preview-body"><div className="preview-nav"><FeatureIcon index={0} /><FeatureIcon index={1} /><FeatureIcon index={2} /></div>
        <div className="preview-content"><div className="preview-caption">{ms ? 'KES ANDA, TERSUSUN' : 'YOUR CASE, ORGANISED'}</div><h2>{ms ? 'Pembelian dalam talian' : 'An online purchase'}</h2><p>{ms ? 'Pesanan belum diterima' : 'Order not received'}</p>
          <div className="preview-purchase"><span>{ms ? 'Jumlah pembelian' : 'Purchase amount'}<strong>RM 240.00</strong></span><span>{ms ? 'Status kes' : 'Case status'}<strong>{ms ? 'Draf' : 'Draft'}</strong></span></div>
          <div className="preview-checklist"><div><span>01</span>{ms ? 'Butiran pembelian' : 'Purchase details'}<b>✓</b></div><div><span>02</span>{ms ? 'Kumpulkan bukti' : 'Collect evidence'}<b>✓</b></div><div><span>03</span>{ms ? 'Semak fakta' : 'Review the facts'}<b>→</b></div></div>
          <div className="preview-next"><FeatureIcon index={1} /><div><small>{ms ? 'LANGKAH SETERUSNYA' : 'UP NEXT'}</small><strong>{ms ? 'Semak rekod anda' : 'Review your records'}</strong><span>{ms ? 'Anda tentukan apa yang dikongsi.' : 'You decide what gets shared.'}</span></div></div>
        </div></div>
      <div className="preview-bottom"><span />{ms ? 'Disimpan dalam pelayar anda' : 'Saved in your browser'}</div>
    </div>
  </div>
}
