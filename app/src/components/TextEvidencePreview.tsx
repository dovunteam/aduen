import { useState } from 'react'
import { getEvidenceOriginal } from '../data/evidenceRepository'
import type { Locale } from '../i18n'
import { recordAuditEvent } from '../data/auditRepository'

const PREVIEW_BYTES = 64 * 1024

export function TextEvidencePreview({ evidenceId, locale }: { evidenceId: string; locale: Locale }) {
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState<string | null>(null)
  const [truncated, setTruncated] = useState(false)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [redacting, setRedacting] = useState(false)
  const [redactionContent, setRedactionContent] = useState('')
  const [redactionLoading, setRedactionLoading] = useState(false)
  const [redactionFailed, setRedactionFailed] = useState(false)

  async function show() {
    setOpen(true)
    if (content !== null) return
    setLoading(true); setFailed(false)
    try {
      const original = await getEvidenceOriginal(evidenceId)
      if (!original) throw new Error('Missing original')
      recordAuditEvent('evidence_previewed', evidenceId, 'text preview')
      setContent(await original.slice(0, PREVIEW_BYTES).text())
      setTruncated(original.size > PREVIEW_BYTES)
    } catch { setFailed(true) }
    finally { setLoading(false) }
  }

  async function startRedaction() {
    setRedacting(true)
    if (redactionContent) return
    setRedactionLoading(true); setRedactionFailed(false)
    try {
      const original = await getEvidenceOriginal(evidenceId)
      if (!original) throw new Error('Missing original')
      setRedactionContent(await original.text())
    } catch { setRedactionFailed(true) }
    finally { setRedactionLoading(false) }
  }

  function downloadRedactedCopy() {
    const url = URL.createObjectURL(new Blob([redactionContent], { type: 'text/plain;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `redacted-evidence-${evidenceId}.txt`
    anchor.click()
    recordAuditEvent('redacted_copy_exported', evidenceId, 'text copy')
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return <div className="text-evidence-preview">
    <button type="button" className="secondary" aria-expanded={open} onClick={() => open ? setOpen(false) : void show()}>{locale === 'ms' ? (open ? 'Tutup pratonton teks' : 'Pratonton teks') : (open ? 'Close text preview' : 'Preview text')}</button>
    {open && <div>
      {loading && <p role="status">{locale === 'ms' ? 'Memuatkan…' : 'Loading…'}</p>}
      {failed && <p role="alert">{locale === 'ms' ? 'Fail tidak dapat dibaca. Tutup dan cuba lagi.' : 'The file could not be read. Close and retry.'}</p>}
      {content !== null && <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: '20rem', overflow: 'auto' }} tabIndex={0} aria-label={locale === 'ms' ? 'Kandungan bukti' : 'Evidence contents'}>{content}</pre>}
      {truncated && <p>{locale === 'ms' ? 'Pratonton dipendekkan. Muat turun fail asal untuk membaca keseluruhannya.' : 'Preview shortened. Download the original to read the entire file.'}</p>}
      <div className="text-preview-actions">
        <button type="button" className="secondary" onClick={() => void startRedaction()}>{locale === 'ms' ? (redacting ? 'Tutup salinan redaksi' : 'Sediakan salinan redaksi') : (redacting ? 'Close redacted copy' : 'Prepare redacted copy')}</button>
        {redacting && <div>
          <p>{locale === 'ms' ? 'Salinan ini baharu dan tidak mengubah fail asal. Padamkan maklumat sensitif sebelum memuat turun, kemudian tambah salinan sebagai bukti baharu jika perlu.' : 'This is a new copy and does not change the original. Remove sensitive details before downloading, then add the copy as new evidence if needed.'}</p>
          {redactionLoading && <p role="status">{locale === 'ms' ? 'Memuatkan salinan…' : 'Loading copy…'}</p>}
          {redactionFailed && <p role="alert">{locale === 'ms' ? 'Fail tidak dapat dibaca. Cuba lagi.' : 'The file could not be read. Try again.'}</p>}
          {!redactionLoading && !redactionFailed && <><textarea aria-label={locale === 'ms' ? 'Kandungan salinan redaksi' : 'Redacted copy contents'} value={redactionContent} onChange={(event) => setRedactionContent(event.target.value)} rows={12} style={{ display: 'block', width: '100%', marginTop: '1rem', fontFamily: 'inherit' }} /><button type="button" className="primary" disabled={!redactionContent} onClick={downloadRedactedCopy}>{locale === 'ms' ? 'Muat turun salinan redaksi' : 'Download redacted copy'}</button></>}
        </div>}
      </div>
    </div>}
  </div>
}
