import type { Locale } from '../i18n'

export function CasePreview({ locale }: { locale: Locale }) {
  const ms = locale === 'ms'
  return <div className="case-preview" aria-label={ms ? 'Contoh rekod kes tersusun' : 'Example of an organised case record'}>
    <div className="preview-orbit" aria-hidden="true" />
    <div className="preview-caption"><span className="tiny-dot" />{ms ? 'DARI BUKTI KEPADA TINDAKAN' : 'FROM EVIDENCE TO A NEXT STEP'}</div>
    <div className="preview-paper preview-paper-back" aria-hidden="true" />
    <div className="preview-paper preview-paper-front">
      <div className="preview-document-top"><span className="document-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M7 3h7l4 4v14H7V3Z" /><path d="M14 3v5h4M10 12h5m-5 4h5" /></svg></span><span>BUKTIVA CASE<span>{ms ? 'Contoh ilustrasi' : 'Illustrative example'}</span></span><span className="preview-document-menu" aria-hidden="true">···</span></div>
      <div className="preview-title">{ms ? 'Semuanya, di satu tempat.' : 'The whole story, together.'}</div>
      <p className="preview-subtitle">{ms ? 'Pesanan tidak diterima' : 'Order not received'}</p>
      <div className="preview-record"><span>{ms ? 'Rekod transaksi' : 'Transaction record'}</span><span className="preview-tag">{ms ? 'Tersusun' : 'Organised'}</span></div>
      <ol className="preview-timeline">
        <li><span className="preview-node">✓</span><div><strong>{ms ? 'Pembelian direkodkan' : 'Purchase recorded'}</strong><span>{ms ? 'Resit dan butiran pembayaran' : 'Receipt and payment details'}</span></div><span className="preview-date">01</span></li>
        <li><span className="preview-node">✓</span><div><strong>{ms ? 'Bukti dikumpulkan' : 'Evidence collected'}</strong><span>{ms ? 'Mesej, tarikh dan janji' : 'Messages, dates, and promises'}</span></div><span className="preview-date">02</span></li>
        <li><span className="preview-node preview-node-current">→</span><div><strong>{ms ? 'Langkah seterusnya jelas' : 'A clear next step'}</strong><span>{ms ? 'Sedia untuk semakan anda' : 'Ready for your review'}</span></div><span className="preview-date">03</span></li>
      </ol>
      <div className="preview-document-bottom"><span className="tiny-dot" />{ms ? 'Kes anda. Dalam kawalan anda.' : 'Your case. Your control.'}<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></div>
    </div>
    <div className="preview-note"><span className="preview-note-icon" aria-hidden="true">↗</span><div><strong>{ms ? 'Kejelasan bermula di sini.' : 'Clarity starts here.'}</strong><span>{ms ? 'Satu rekod pada satu masa.' : 'One record at a time.'}</span></div></div>
    <div className="preview-bottom-label">{ms ? 'SIMPAN. SEMAK. TERUSKAN.' : 'KEEP. CHECK. MOVE FORWARD.'}<span aria-hidden="true">↗</span></div>
  </div>
}
