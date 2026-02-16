import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import type { PDFPageProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { jsPDF } from 'jspdf'
import { getEvidenceOriginal } from '../data/evidenceRepository'
import { recordAuditEvent } from '../data/auditRepository'
import type { Locale } from '../i18n'

GlobalWorkerOptions.workerSrc = workerUrl

type Redaction = { x: number; y: number; width: number; height: number }
type PdfPage = { number: number; page: PDFPageProxy; scale: number }
const MAX_PAGES = 30
const MAX_RENDERED_PIXELS = 24_000_000
const MAX_PAGE_EDGE = 1600

export function PdfEvidencePreview({ evidenceId, locale }: { evidenceId: string; locale: Locale }) {
  const [open, setOpen] = useState(false)
  const [bytes, setBytes] = useState<Uint8Array | null>(null)
  const [pages, setPages] = useState<PdfPage[]>([])
  const [redactions, setRedactions] = useState<Record<number, Redaction[]>>({})
  const [draftRedaction, setDraftRedaction] = useState<{ page: number; rect: Redaction } | null>(null)
  const [failed, setFailed] = useState(false)
  const [tooManyPages, setTooManyPages] = useState(false)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportFailed, setExportFailed] = useState(false)
  const previewAudited = useRef(false)
  const canvasRefs = useRef(new Map<number, HTMLCanvasElement>())
  const pointerPage = useRef<number | null>(null)

  useEffect(() => {
    if (!open) return
    let disposed = false
    previewAudited.current = false
    void getEvidenceOriginal(evidenceId).then(async (original) => {
      if (!original) throw new Error('Missing original')
      const data = new Uint8Array(await original.arrayBuffer())
      if (!disposed) setBytes(data)
    }).catch(() => { if (!disposed) { setFailed(true); setLoading(false) } })
    return () => { disposed = true; setBytes(null) }
  }, [open, evidenceId])

  useEffect(() => {
    if (!open || !bytes) return
    let disposed = false
    const task = getDocument({ data: bytes })
    void task.promise.then(async (document) => {
      if (disposed) { await task.destroy(); return }
      if (document.numPages > MAX_PAGES) {
        setTooManyPages(true); setLoading(false); return
      }
      const sourcePages: Array<{ number: number; page: PDFPageProxy; width: number; height: number }> = []
      for (let number = 1; number <= document.numPages; number += 1) {
        sourcePages.push({ number, page: await document.getPage(number), width: 0, height: 0 })
        const current = sourcePages[sourcePages.length - 1]
        const viewport = current.page.getViewport({ scale: 1 })
        current.width = viewport.width; current.height = viewport.height
      }
      if (disposed) return
      const area = sourcePages.reduce((sum, page) => sum + page.width * page.height, 0)
      const largestEdge = Math.max(...sourcePages.flatMap((page) => [page.width, page.height]))
      const scale = Math.min(1.5, MAX_PAGE_EDGE / largestEdge, Math.sqrt(MAX_RENDERED_PIXELS / area))
      setPages(sourcePages.map(({ number, page }) => ({ number, page, scale })))
      setLoading(false)
      if (!previewAudited.current) {
        recordAuditEvent('evidence_previewed', evidenceId, 'PDF preview')
        previewAudited.current = true
      }
    }).catch(() => { if (!disposed) { setFailed(true); setLoading(false) } })
    return () => {
      disposed = true
      void task.destroy()
    }
  }, [open, bytes, evidenceId])

  function toggle() {
    setPages([]); setBytes(null); setFailed(false); setTooManyPages(false); setDraftRedaction(null)
    setRedactions({}); setExportFailed(false); previewAudited.current = false
    setLoading(!open); setOpen((current) => !current)
  }

  function pagePoint(event: ReactPointerEvent<HTMLDivElement>, page: number): { x: number; y: number } | null {
    const canvas = canvasRefs.current.get(page)
    const bounds = canvas?.getBoundingClientRect()
    if (!bounds || bounds.width === 0 || bounds.height === 0) return null
    return { x: clamp((event.clientX - bounds.left) / bounds.width), y: clamp((event.clientY - bounds.top) / bounds.height) }
  }

  function beginRedaction(event: ReactPointerEvent<HTMLDivElement>, page: number) {
    const start = pagePoint(event, page)
    if (!start) return
    pointerPage.current = page
    event.currentTarget.setPointerCapture(event.pointerId)
    setDraftRedaction({ page, rect: { x: start.x, y: start.y, width: 0, height: 0 } })
  }

  function moveRedaction(event: ReactPointerEvent<HTMLDivElement>, page: number) {
    if (pointerPage.current !== page || !draftRedaction) return
    const end = pagePoint(event, page)
    if (end) setDraftRedaction({ page, rect: makeRect(draftRedaction.rect.x, draftRedaction.rect.y, end.x, end.y) })
  }

  function finishRedaction(event: ReactPointerEvent<HTMLDivElement>, page: number) {
    if (pointerPage.current !== page || !draftRedaction) return
    pointerPage.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (draftRedaction.rect.width >= 0.01 && draftRedaction.rect.height >= 0.01) {
      setRedactions((current) => ({ ...current, [page]: [...(current[page] ?? []), draftRedaction.rect] }))
    }
    setDraftRedaction(null)
  }

  async function downloadRedactedCopy() {
    if (!pages.length || !pages.every(({ number }) => canvasRefs.current.has(number))) return
    setExporting(true); setExportFailed(false)
    try {
      const pdf = new jsPDF({ unit: 'pt', compress: true })
      pdf.setDocumentProperties({ title: 'Redacted evidence copy', subject: 'Flattened image-only copy prepared in Aduen' })
      pages.forEach(({ number }, index) => {
        const source = canvasRefs.current.get(number)
        if (!source) throw new Error('PDF page was not rendered')
        const output = document.createElement('canvas')
        output.width = source.width; output.height = source.height
        const context = output.getContext('2d')
        if (!context) throw new Error('Canvas is not available')
        context.fillStyle = '#fff'; context.fillRect(0, 0, output.width, output.height)
        context.drawImage(source, 0, 0)
        context.fillStyle = '#000'
        ;[...(redactions[number] ?? []), ...(draftRedaction?.page === number ? [draftRedaction.rect] : [])].forEach((rect) => {
          context.fillRect(rect.x * output.width, rect.y * output.height, rect.width * output.width, rect.height * output.height)
        })
        const image = output.toDataURL('image/jpeg', 0.92)
        const fit = 842 / Math.max(output.width, output.height)
        const width = output.width * fit; const height = output.height * fit
        if (index > 0) pdf.addPage([width, height])
        else pdf.setPage(1)
        pdf.internal.pageSize.width = width; pdf.internal.pageSize.height = height
        pdf.addImage(image, 'JPEG', 0, 0, width, height, undefined, 'FAST')
        output.width = 0; output.height = 0
      })
      const blob = pdf.output('blob')
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url; anchor.download = `redacted-evidence-${evidenceId}.pdf`; anchor.click()
      recordAuditEvent('redacted_copy_exported', evidenceId, 'flattened PDF copy')
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch { setExportFailed(true) }
    finally { setExporting(false) }
  }

  const copy = locale === 'ms' ? pdfText.ms : pdfText.en

  return <div className="pdf-evidence-preview">
    <button type="button" className="secondary" aria-expanded={open} onClick={toggle}>{open ? copy.close : copy.preview}</button>
    {open && <div>
      <p>{copy.explanation}</p>
      {loading && <p role="status">{copy.loading}</p>}
      {failed && <p role="alert">{copy.loadError}</p>}
      {tooManyPages && <p role="alert">{copy.pageLimit}</p>}
      {!loading && !failed && !tooManyPages && pages.length > 0 && <>
        <div className="risk-review"><strong>{copy.warningTitle}</strong><p>{copy.warning}</p></div>
        {pages.map(({ number, page, scale }) => {
          const currentRedactions = [...(redactions[number] ?? []), ...(draftRedaction?.page === number ? [draftRedaction.rect] : [])]
          return <section key={number} aria-label={`${copy.page} ${number}`} style={{ marginBlock: '1.5rem' }}>
            <h3>{copy.page} {number}</h3>
            <div onPointerDown={(event) => beginRedaction(event, number)} onPointerMove={(event) => moveRedaction(event, number)} onPointerUp={(event) => finishRedaction(event, number)} onPointerCancel={(event) => finishRedaction(event, number)} style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', touchAction: 'none', cursor: 'crosshair', border: '1px solid var(--line)' }}>
              <PdfPageCanvas page={page} scale={scale} canvasRef={(canvas) => { if (canvas) canvasRefs.current.set(number, canvas); else canvasRefs.current.delete(number) }} />
              {currentRedactions.map((rect, index) => <span aria-hidden="true" key={index} style={{ position: 'absolute', left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.width * 100}%`, height: `${rect.height * 100}%`, background: '#000', pointerEvents: 'none' }} />)}
            </div>
            <button type="button" className="secondary" onClick={() => setRedactions((current) => ({ ...current, [number]: [...(current[number] ?? []), { x: 0.25, y: 0.25, width: 0.5, height: 0.5 }] }))}>{copy.centralRedaction} · {number}</button>
            <button type="button" className="secondary" disabled={!redactions[number]?.length} onClick={() => setRedactions((current) => ({ ...current, [number]: [] }))}>{copy.clear} · {number}</button>
          </section>
        })}
        <button type="button" className="primary" disabled={!Object.values(redactions).some((items) => items.length > 0) || exporting} onClick={() => void downloadRedactedCopy()}>{exporting ? copy.exporting : copy.export}</button>
        {exportFailed && <p role="alert">{copy.exportError}</p>}
      </>}
    </div>}
  </div>
}

function PdfPageCanvas({ page, scale, canvasRef }: { page: PDFPageProxy; scale: number; canvasRef: (canvas: HTMLCanvasElement | null) => void }) {
  const internalRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = internalRef.current
    if (!canvas) return
    const viewport = page.getViewport({ scale })
    canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height)
    const context = canvas.getContext('2d')
    if (!context) return
    const task = page.render({ canvas, canvasContext: context, viewport })
    void task.promise.catch(() => {})
    return () => task.cancel()
  }, [page, scale])
  return <canvas ref={(canvas) => { internalRef.current = canvas; canvasRef(canvas) }} style={{ display: 'block', maxWidth: '100%', height: 'auto' }} />
}

function clamp(value: number): number { return Math.min(1, Math.max(0, value)) }

function makeRect(startX: number, startY: number, endX: number, endY: number): Redaction {
  return { x: Math.min(startX, endX), y: Math.min(startY, endY), width: Math.abs(endX - startX), height: Math.abs(endY - startY) }
}

const pdfText = {
  en: { preview: 'Preview and redact PDF', close: 'Close PDF preview', explanation: 'PDF pages are rendered on this device. Drag over sensitive information on each page, then download a flattened copy. The original stays unchanged and is never uploaded.', loading: 'Loading PDF pages…', loadError: 'The PDF could not be rendered. Download the original to inspect it.', pageLimit: `This preview supports up to ${MAX_PAGES} pages. Download the original and redact it with a trusted PDF tool.`, warningTitle: 'Review every page before sharing.', warning: 'The exported copy is image-only: text and vector detail are flattened and may be less sharp. Check every page at full size to confirm all sensitive information is covered. Redaction does not remove information that remains visible outside the black areas.', page: 'Page', centralRedaction: 'Add central redaction', clear: 'Clear redactions', export: 'Download flattened redacted PDF', exporting: 'Preparing PDF…', exportError: 'The redacted PDF could not be created. Try again.' },
  ms: { preview: 'Pratonton dan redaksi PDF', close: 'Tutup pratonton PDF', explanation: 'Halaman PDF dipaparkan pada peranti ini. Seret pada maklumat sensitif di setiap halaman, kemudian muat turun salinan yang diratakan. Fail asal tidak berubah dan tidak dimuat naik.', loading: 'Memuatkan halaman PDF…', loadError: 'PDF tidak dapat dipaparkan. Muat turun fail asal untuk menyemaknya.', pageLimit: `Pratonton ini menyokong sehingga ${MAX_PAGES} halaman. Muat turun fail asal dan redaksikannya dengan alat PDF yang dipercayai.`, warningTitle: 'Semak setiap halaman sebelum berkongsi.', warning: 'Salinan eksport hanya mengandungi imej: teks dan perincian vektor diratakan dan mungkin kurang jelas. Periksa setiap halaman pada saiz penuh untuk memastikan semua maklumat sensitif ditutup. Redaksi tidak membuang maklumat yang masih kelihatan di luar kawasan hitam.', page: 'Halaman', centralRedaction: 'Tambah redaksi tengah', clear: 'Kosongkan redaksi', export: 'Muat turun PDF redaksi yang diratakan', exporting: 'Menyediakan PDF…', exportError: 'PDF redaksi tidak dapat dibuat. Cuba lagi.' },
} as const
