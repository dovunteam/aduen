import { useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { getEvidenceOriginal } from '../data/evidenceRepository'
import type { Locale } from '../i18n'
import { recordAuditEvent } from '../data/auditRepository'

type Redaction = { x: number; y: number; width: number; height: number }

export function ImageEvidencePreview({ evidenceId, fileName, locale }: { evidenceId: string; fileName: string; locale: Locale }) {
  const imageRef = useRef<HTMLImageElement>(null)
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [failed, setFailed] = useState(false)
  const previewAudited = useRef(false)
  const [redacting, setRedacting] = useState(false)
  const [redactions, setRedactions] = useState<Redaction[]>([])
  const [draftRedaction, setDraftRedaction] = useState<Redaction | null>(null)
  const [downloadBusy, setDownloadBusy] = useState(false)
  const [redactionFailed, setRedactionFailed] = useState(false)

  useEffect(() => {
    if (!open) return
    let disposed = false
    let objectUrl = ''
    previewAudited.current = false
    void getEvidenceOriginal(evidenceId).then((original) => {
      if (disposed) return
      if (!original) throw new Error('Missing original')
      objectUrl = URL.createObjectURL(original)
      setUrl(objectUrl)
    }).catch(() => { if (!disposed) setFailed(true) })
    return () => { disposed = true; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [open, evidenceId])

  function point(event: PointerEvent<HTMLImageElement>): { x: number; y: number } | null {
    const bounds = imageRef.current?.getBoundingClientRect()
    if (!bounds || bounds.width === 0 || bounds.height === 0) return null
    return { x: clamp((event.clientX - bounds.left) / bounds.width), y: clamp((event.clientY - bounds.top) / bounds.height) }
  }

  function beginRedaction(event: PointerEvent<HTMLImageElement>) {
    if (!redacting) return
    const start = point(event)
    if (!start) return
    imageRef.current?.setPointerCapture(event.pointerId)
    setDraftRedaction({ x: start.x, y: start.y, width: 0, height: 0 })
  }

  function moveRedaction(event: PointerEvent<HTMLImageElement>) {
    if (!draftRedaction) return
    const current = point(event)
    if (!current) return
    setDraftRedaction(makeRect(draftRedaction.x, draftRedaction.y, current.x, current.y))
  }

  function finishRedaction(event: PointerEvent<HTMLImageElement>) {
    if (!draftRedaction) return
    imageRef.current?.releasePointerCapture(event.pointerId)
    if (draftRedaction.width >= 0.01 && draftRedaction.height >= 0.01) setRedactions((current) => [...current, draftRedaction])
    setDraftRedaction(null)
  }

  async function downloadRedactedCopy() {
    if (!url || redactions.length === 0) return
    setDownloadBusy(true); setRedactionFailed(false)
    try {
      const source = new Image()
      await new Promise<void>((resolve, reject) => { source.onload = () => resolve(); source.onerror = () => reject(new Error('Image could not be loaded')); source.src = url })
      const canvas = document.createElement('canvas')
      canvas.width = source.naturalWidth; canvas.height = source.naturalHeight
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Canvas is not available')
      context.drawImage(source, 0, 0)
      context.fillStyle = '#000'
      redactions.forEach((redaction) => context.fillRect(redaction.x * canvas.width, redaction.y * canvas.height, redaction.width * canvas.width, redaction.height * canvas.height))
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Image could not be created')), 'image/png'))
      const copyUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = copyUrl; anchor.download = `redacted-${fileName.replace(/[^a-z0-9._-]/gi, '_').replace(/\.[^.]+$/, '')}.png`; anchor.click()
      recordAuditEvent('redacted_copy_exported', evidenceId, 'PNG image copy')
      window.setTimeout(() => URL.revokeObjectURL(copyUrl), 1000)
    } catch { setRedactionFailed(true) }
    finally { setDownloadBusy(false) }
  }

  function resetPreview() {
    setUrl(''); setFailed(false); setRedacting(false); setRedactions([]); setDraftRedaction(null); setRedactionFailed(false); setOpen((current) => !current)
  }

  return <div>
    <button type="button" className="secondary" aria-expanded={open} onClick={resetPreview}>{locale === 'ms' ? (open ? 'Tutup pratonton imej' : 'Pratonton imej') : (open ? 'Close image preview' : 'Preview image')}</button>
    {open && <div>
      {failed ? <p role="alert">{locale === 'ms' ? 'Imej tidak dapat dipaparkan. Muat turun fail asal untuk menyemaknya.' : 'The image could not be displayed. Download the original to inspect it.'}</p>
        : url ? <>
          <button type="button" className="secondary" onClick={() => { setRedacting((current) => !current); setRedactions([]); setDraftRedaction(null) }}>{locale === 'ms' ? (redacting ? 'Tutup redaksi imej' : 'Sediakan salinan redaksi imej') : (redacting ? 'Close image redaction' : 'Prepare redacted image copy')}</button>
          {redacting && <p>{locale === 'ms' ? 'Seret pada imej untuk menutup maklumat sensitif. Fail asal tidak berubah.' : 'Drag over the image to cover sensitive details. The original file is unchanged.'}</p>}
          <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', marginTop: '1rem' }}>
        <img ref={imageRef} src={url} alt={fileName} onLoad={() => { if (!previewAudited.current) { recordAuditEvent('evidence_previewed', evidenceId, 'image preview'); previewAudited.current = true } }} onError={() => setFailed(true)} onPointerDown={beginRedaction} onPointerMove={moveRedaction} onPointerUp={finishRedaction} style={{ display: 'block', maxWidth: '100%', maxHeight: '32rem', objectFit: 'contain', touchAction: 'none', cursor: redacting ? 'crosshair' : 'default' }} />
            {[...redactions, ...(draftRedaction ? [draftRedaction] : [])].map((redaction, index) => <span aria-hidden="true" key={index} style={{ position: 'absolute', left: `${redaction.x * 100}%`, top: `${redaction.y * 100}%`, width: `${redaction.width * 100}%`, height: `${redaction.height * 100}%`, background: '#000', pointerEvents: 'none' }} />)}
          </div>
          {redacting && <div><button type="button" className="secondary" onClick={() => setRedactions((current) => [...current, { x: 0.25, y: 0.25, width: 0.5, height: 0.5 }])}>{locale === 'ms' ? 'Tambah redaksi tengah' : 'Add central redaction'}</button><button type="button" className="primary" disabled={!redactions.length || downloadBusy} onClick={() => void downloadRedactedCopy()}>{downloadBusy ? (locale === 'ms' ? 'Menyediakan…' : 'Preparing…') : (locale === 'ms' ? 'Muat turun salinan imej diredaksi' : 'Download redacted image copy')}</button><button type="button" className="secondary" onClick={() => setRedactions([])}>{locale === 'ms' ? 'Kosongkan redaksi' : 'Clear redactions'}</button>{redactionFailed && <p role="alert">{locale === 'ms' ? 'Salinan redaksi tidak dapat dibuat. Cuba lagi.' : 'The redacted copy could not be created. Try again.'}</p>}</div>}
        </>
        : <p role="status">{locale === 'ms' ? 'Memuatkan…' : 'Loading…'}</p>}
    </div>}
  </div>
}

function clamp(value: number): number { return Math.min(1, Math.max(0, value)) }

function makeRect(startX: number, startY: number, endX: number, endY: number): Redaction {
  return { x: Math.min(startX, endX), y: Math.min(startY, endY), width: Math.abs(endX - startX), height: Math.abs(endY - startY) }
}
