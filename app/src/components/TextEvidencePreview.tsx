import { useState } from 'react'
import { getEvidenceOriginal } from '../data/evidenceRepository'
import type { Locale } from '../i18n'

const PREVIEW_BYTES = 64 * 1024

export function TextEvidencePreview({ evidenceId, locale }: { evidenceId: string; locale: Locale }) {
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState<string | null>(null)
  const [truncated, setTruncated] = useState(false)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  async function show() {
    setOpen(true)
    if (content !== null) return
    setLoading(true); setFailed(false)
    try {
      const original = await getEvidenceOriginal(evidenceId)
      if (!original) throw new Error('Missing original')
      setContent(await original.slice(0, PREVIEW_BYTES).text())
      setTruncated(original.size > PREVIEW_BYTES)
    } catch { setFailed(true) }
    finally { setLoading(false) }
  }

  return <div className="text-evidence-preview">
    <button type="button" className="secondary" aria-expanded={open} onClick={() => open ? setOpen(false) : void show()}>{locale === 'ms' ? (open ? 'Tutup pratonton teks' : 'Pratonton teks') : (open ? 'Close text preview' : 'Preview text')}</button>
    {open && <div>
      {loading && <p role="status">{locale === 'ms' ? 'Memuatkan…' : 'Loading…'}</p>}
      {failed && <p role="alert">{locale === 'ms' ? 'Fail tidak dapat dibaca. Tutup dan cuba lagi.' : 'The file could not be read. Close and retry.'}</p>}
      {content !== null && <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: '20rem', overflow: 'auto' }} tabIndex={0} aria-label={locale === 'ms' ? 'Kandungan bukti' : 'Evidence contents'}>{content}</pre>}
      {truncated && <p>{locale === 'ms' ? 'Pratonton dipendekkan. Muat turun fail asal untuk membaca keseluruhannya.' : 'Preview shortened. Download the original to read the entire file.'}</p>}
    </div>}
  </div>
}
