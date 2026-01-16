import { useState } from 'react'
import { approveComplaintPack } from '../domain/complaintPack'
import type { ComplaintPack } from '../domain/complaintPack'

type Props = { initialPack: ComplaintPack; onBack: () => void; onContinue: () => void; onApproved: (pack: ComplaintPack) => void }

export function PackStep({ initialPack, onBack, onContinue, onApproved }: Props) {
  const [pack, setPack] = useState(initialPack)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  async function approveAndExport() {
    setError('')
    try {
      const approved = pack.approvedAt ? pack : approveComplaintPack(pack)
      setPack(approved); onApproved(approved)
      const { downloadComplaintPackPdf } = await import('../data/packPdf')
      downloadComplaintPackPdf(approved)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The PDF could not be generated.') }
  }

  async function copyRequest() {
    setError('')
    try { await navigator.clipboard.writeText(`Subject: ${pack.merchantRequest.subject}\n\n${pack.merchantRequest.body}`); setCopied(true) }
    catch { setError('The request could not be copied. Use the reviewed PDF instead.') }
  }

  return <section className="page form-page pack-page">
    <div className="eyebrow">Tuntiva Pack · Version {pack.version}</div><h1>Review before export.</h1>
    <p className="lede">This pack is a factual case summary for your review. It is not sent anywhere by Tuntiva, and exporting it does not submit a complaint.</p>
    <div className="pack-layout"><article className="pack-document">
      <header><span>TUNTIVA CASE PACK</span><small>Draft · {new Date(pack.createdAt).toLocaleString('en-MY')}</small></header>
      <PackSection title="Transaction"><dl><div><dt>Consumer</dt><dd>{pack.consumerName}</dd></div><div><dt>Seller</dt><dd>{pack.transaction.seller}</dd></div><div><dt>Seller location</dt><dd>{pack.transaction.sellerLocation}</dd></div><div><dt>Category</dt><dd>{pack.transaction.category}</dd></div><div><dt>Platform</dt><dd>{pack.transaction.platform || 'Not provided'}</dd></div><div><dt>Purchase date</dt><dd>{pack.transaction.purchaseDate}</dd></div><div><dt>Amount</dt><dd>{pack.transaction.currency} {Number(pack.transaction.amount).toFixed(2)}</dd></div><div><dt>Payment</dt><dd>{pack.transaction.paymentMethod}</dd></div><div><dt>Reference</dt><dd>{pack.transaction.orderReference || 'Not provided'}</dd></div></dl></PackSection>
      <PackSection title="Problem and remedy"><p>Issue: <strong>{pack.issue}</strong></p><p>Requested remedy: <strong>{pack.remedy}{pack.remedyAmount ? ` — RM ${Number(pack.remedyAmount).toFixed(2)}` : ''}</strong></p></PackSection>
      <PackSection title="Merchant request"><p><strong>Subject: {pack.merchantRequest.subject}</strong></p><pre className="request-preview">{pack.merchantRequest.body}</pre><small>Generated only from: {pack.merchantRequest.generatedFrom.join(', ')}</small></PackSection>
      <PackSection title="Chronology"><ol>{pack.timeline.map((item) => <li key={item.id}><time>{item.date || 'Date unknown'}</time><span><strong>{item.label}</strong><small>{item.detail} · {item.source}</small></span></li>)}</ol></PackSection>
      <PackSection title={`Evidence index · ${pack.evidence.length}`}><ol className="pack-evidence">{pack.evidence.map((item) => <li key={item.id}><strong>{item.fileName}</strong><small>{item.sourceType.replaceAll('_', ' ')} · {item.eventDate || 'Date unknown'} · SHA-256 {item.sha256.slice(0, 16)}…</small></li>)}</ol></PackSection>
      {pack.confirmedDerivedFacts.length > 0 && <PackSection title={`Confirmed derived facts · ${pack.confirmedDerivedFacts.length}`}><ol className="pack-evidence">{pack.confirmedDerivedFacts.map((item) => <li key={`${item.evidenceId}-${item.field}`}><strong>{item.field}: {item.value}</strong><small>Extracted as {item.extractedValue} · Evidence {item.evidenceId} · {item.extractorVersion}</small></li>)}</ol></PackSection>}
      <PackSection title="Route record"><p><strong>{pack.route.routeName}</strong></p><small>Rule {pack.route.ruleVersion} · Source checked {pack.route.sourceChecked} · <a href={pack.route.sourceUrl} target="_blank" rel="noreferrer">Source</a></small></PackSection>
      <PackSection title="User declaration"><p>{pack.declaration}</p></PackSection>
      <footer>{pack.disclaimer}</footer>
    </article>
    <aside className="approval-panel"><div className="eyebrow">Your approval</div><h2>Nothing leaves this device.</h2><p>Review names, dates, amounts, remedy, merchant request, chronology, and the evidence index. Return to the case to correct anything that is wrong.</p><label className="check-row"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>I reviewed this pack and approve this version for export.</span></label>{pack.approvedAt && <p className="approval-time">Approved {new Date(pack.approvedAt).toLocaleString('en-MY')}</p>}{error && <p className="form-error" role="alert">{error}</p>}<button className="primary" disabled={!confirmed} onClick={approveAndExport}>Approve and export PDF <span>↓</span></button><button className="copy-button" disabled={!pack.approvedAt} onClick={() => void copyRequest()}>{copied ? 'Request copied' : 'Copy approved request'}</button><small>The evidence originals remain separate and are not embedded in this prototype PDF. Copying does not send the request.</small></aside></div>
    <div className="actions split"><button className="secondary" onClick={onBack}>← Tuntiva Check</button><button className="primary" disabled={!pack.approvedAt} onClick={onContinue}>Track external status <span>→</span></button></div>
  </section>
}

function PackSection({ title, children }: { title: string; children: React.ReactNode }) { return <section><h2>{title}</h2>{children}</section> }
