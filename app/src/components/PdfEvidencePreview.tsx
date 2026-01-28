import { useEffect, useState } from 'react'
import { getEvidenceOriginal } from '../data/evidenceRepository'
import type { Locale } from '../i18n'
import { recordAuditEvent } from '../data/auditRepository'

export function PdfEvidencePreview({ evidenceId, locale }: { evidenceId: string; locale: Locale }) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!open) return
    let disposed = false
    let objectUrl = ''
    void getEvidenceOriginal(evidenceId).then((original) => {
      if (disposed) return
      if (!original) throw new Error('Missing original')
      objectUrl = URL.createObjectURL(original)
      recordAuditEvent('evidence_previewed', evidenceId, 'PDF preview')
      setUrl(objectUrl)
    }).catch(() => { if (!disposed) setFailed(true) })
    return () => { disposed = true; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [open, evidenceId])

  function toggle() {
    setUrl('')
    setFailed(false)
    setOpen((current) => !current)
  }

  return <div className="pdf-evidence-preview">
    <button type="button" className="secondary" aria-expanded={open} onClick={toggle}>{locale === 'ms' ? (open ? 'Tutup pratonton PDF' : 'Pratonton PDF') : (open ? 'Close PDF preview' : 'Preview PDF')}</button>
    {open && <div>
      {failed ? <p role="alert">{locale === 'ms' ? 'PDF tidak dapat dipaparkan. Muat turun fail asal untuk menyemaknya.' : 'The PDF could not be displayed. Download the original to inspect it.'}</p>
        : url ? <><p>{locale === 'ms' ? 'PDF tidak diimbas atau diredaksi dalam prototaip ini. Muat turun fail asal, redaksikan salinan di luar Buktiva, dan muat naik salinan itu sebagai bukti baharu jika perlu. Fail asal tidak berubah.' : 'This prototype does not scan or redact PDF content. Download the original, redact a copy outside Buktiva, and upload that copy as new evidence if needed. The original is unchanged.'}</p><iframe title={locale === 'ms' ? 'Pratonton bukti PDF' : 'Evidence PDF preview'} src={url} sandbox="" style={{ display: 'block', width: '100%', height: '32rem', border: '1px solid var(--line)', marginTop: '1rem' }} /></>
          : <p role="status">{locale === 'ms' ? 'Memuatkan…' : 'Loading…'}</p>}
    </div>}
  </div>
}
