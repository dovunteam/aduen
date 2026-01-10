import { useState } from 'react'
import { approveComplaintPack } from '../domain/complaintPack'
import type { ComplaintPack } from '../domain/complaintPack'

type Props = { initialPack: ComplaintPack; onBack: () => void }

export function PackStep({ initialPack, onBack }: Props) {
  const [pack, setPack] = useState(initialPack)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')

  async function approveAndExport() {
    setError('')
    try {
      const approved = pack.approvedAt ? pack : approveComplaintPack(pack)
      setPack(approved)
      const { downloadComplaintPackPdf } = await import('../data/packPdf')
      downloadComplaintPackPdf(approved)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The PDF could not be generated.') }
  }

  return <section className="page form-page pack-page">
    <div className="eyebrow">Tuntiva Pack · Version {pack.version}</div><h1>Review before export.</h1>
    <p className="lede">This pack is a factual case summary for your review. It is not sent anywhere by Tuntiva, and exporting it does not submit a complaint.</p>
    <div className="pack-layout"><article className="pack-document">
      <header><span>TUNTIVA CASE PACK</span><small>Draft · {new Date(pack.createdAt).toLocaleString('en-MY')}</small></header>
      <PackSection title="Transaction"><dl><div><dt>Seller</dt><dd>{pack.transaction.seller}</dd></div><div><dt>Platform</dt><dd>{pack.transaction.platform || 'Not provided'}</dd></div><div><dt>Purchase date</dt><dd>{pack.transaction.purchaseDate}</dd></div><div><dt>Amount</dt><dd>RM {Number(pack.transaction.amount).toFixed(2)}</dd></div><div><dt>Payment</dt><dd>{pack.transaction.paymentMethod}</dd></div><div><dt>Reference</dt><dd>{pack.transaction.orderReference || 'Not provided'}</dd></div></dl></PackSection>
      <PackSection title="Problem and remedy"><p>Issue: <strong>{pack.issue}</strong></p><p>Requested remedy: <strong>{pack.remedy}{pack.remedyAmount ? ` — RM ${Number(pack.remedyAmount).toFixed(2)}` : ''}</strong></p></PackSection>
      <PackSection title="Chronology"><ol>{pack.timeline.map((item) => <li key={item.id}><time>{item.date || 'Date unknown'}</time><span><strong>{item.label}</strong><small>{item.detail} · {item.source}</small></span></li>)}</ol></PackSection>
      <PackSection title={`Evidence index · ${pack.evidence.length}`}><ol className="pack-evidence">{pack.evidence.map((item) => <li key={item.id}><strong>{item.fileName}</strong><small>{item.sourceType.replaceAll('_', ' ')} · {item.eventDate || 'Date unknown'} · SHA-256 {item.sha256.slice(0, 16)}…</small></li>)}</ol></PackSection>
      <PackSection title="Route record"><p><strong>{pack.route.routeName}</strong></p><small>Rule {pack.route.ruleVersion} · Source checked {pack.route.sourceChecked}</small></PackSection>
      <footer>{pack.disclaimer}</footer>
    </article>
    <aside className="approval-panel"><div className="eyebrow">Your approval</div><h2>Nothing leaves this device.</h2><p>Review names, dates, amounts, remedy, chronology, and the evidence index. Return to the case to correct anything that is wrong.</p><label className="check-row"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>I reviewed this pack and approve this version for export.</span></label>{pack.approvedAt && <p className="approval-time">Approved {new Date(pack.approvedAt).toLocaleString('en-MY')}</p>}{error && <p className="form-error" role="alert">{error}</p>}<button className="primary" disabled={!confirmed} onClick={approveAndExport}>Export PDF <span>↓</span></button><small>The evidence originals remain separate and are not embedded in this prototype PDF.</small></aside></div>
    <div className="actions split"><button className="secondary" onClick={onBack}>← Tuntiva Check</button></div>
  </section>
}

function PackSection({ title, children }: { title: string; children: React.ReactNode }) { return <section><h2>{title}</h2>{children}</section> }
