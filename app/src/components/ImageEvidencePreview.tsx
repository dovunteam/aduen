import { useEffect, useState } from 'react'
import { getEvidenceOriginal } from '../data/evidenceRepository'
import type { Locale } from '../i18n'

export function ImageEvidencePreview({ evidenceId, fileName, locale }: { evidenceId: string; fileName: string; locale: Locale }) {
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
      setUrl(objectUrl)
    }).catch(() => { if (!disposed) setFailed(true) })
    return () => { disposed = true; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [open, evidenceId])

  return <div>
    <button type="button" className="secondary" aria-expanded={open} onClick={() => { setUrl(''); setFailed(false); setOpen(!open) }}>{locale === 'ms' ? (open ? 'Tutup pratonton imej' : 'Pratonton imej') : (open ? 'Close image preview' : 'Preview image')}</button>
    {open && <div>
      {failed ? <p role="alert">{locale === 'ms' ? 'Imej tidak dapat dipaparkan. Muat turun fail asal untuk menyemaknya.' : 'The image could not be displayed. Download the original to inspect it.'}</p>
        : url ? <img src={url} alt={fileName} onError={() => setFailed(true)} style={{ display: 'block', maxWidth: '100%', maxHeight: '32rem', objectFit: 'contain', marginTop: '1rem' }} />
          : <p role="status">{locale === 'ms' ? 'Memuatkan…' : 'Loading…'}</p>}
    </div>}
  </div>
}
