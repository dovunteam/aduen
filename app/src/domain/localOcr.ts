import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

export const OCR_MAX_IMAGE_PIXELS = 16_000_000
export const OCR_MAX_PDF_PAGES = 30
export const OCR_MAX_TEXT_CHARACTERS = 500_000

type TesseractWorker = { recognize(image: unknown): Promise<{ data: { text: string } }>; terminate(): Promise<unknown> }
type TesseractModule = { createWorker(languages: string, oem: number, options: { workerPath: string; workerBlobURL: false; corePath: string; langPath: string; gzip: true }): Promise<TesseractWorker> }

let tesseract: Promise<TesseractModule> | undefined
const textCache = new WeakMap<Blob, Promise<string>>()

async function getWorker() {
  tesseract ??= import('tesseract.js') as Promise<TesseractModule>
  const library = await tesseract
  return library.createWorker('eng+msa', 1, {
    workerPath: `${import.meta.env.BASE_URL}ocr-worker.js`,
    workerBlobURL: false,
    corePath: `${import.meta.env.BASE_URL}ocr/core`,
    langPath: `${import.meta.env.BASE_URL}ocr/lang`,
    gzip: true,
  })
}

async function recognize(source: Blob | HTMLCanvasElement, worker: TesseractWorker): Promise<string> {
  if (source instanceof Blob && 'createImageBitmap' in globalThis) {
    const bitmap = await createImageBitmap(source)
    try {
      const ratio = Math.min(1, Math.sqrt(OCR_MAX_IMAGE_PIXELS / (bitmap.width * bitmap.height)))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(bitmap.width * ratio))
      canvas.height = Math.max(1, Math.round(bitmap.height * ratio))
      canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      return (await worker.recognize(canvas)).data.text
    } finally { bitmap.close() }
  }
  return (await worker.recognize(source as HTMLCanvasElement)).data.text
}

async function extractImageText(image: Blob): Promise<string> {
  const worker = await getWorker()
  try { return (await recognize(image, worker)).slice(0, OCR_MAX_TEXT_CHARACTERS) }
  finally { await worker.terminate() }
}

async function extractScannedPdfText(file: Blob): Promise<string> {
  const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  try {
    const document = await task.promise
    if (document.numPages > OCR_MAX_PDF_PAGES) return ''
    const worker = await getWorker()
    try {
      const pages: string[] = []
      let total = 0
      for (let number = 1; number <= document.numPages && total < OCR_MAX_TEXT_CHARACTERS; number += 1) {
        const page = await document.getPage(number)
        const viewport = page.getViewport({ scale: 1 })
        const scale = Math.min(2, Math.sqrt(OCR_MAX_IMAGE_PIXELS / (viewport.width * viewport.height)))
        const sized = page.getViewport({ scale })
        const canvas = window.document.createElement('canvas')
        canvas.width = Math.max(1, Math.ceil(sized.width)); canvas.height = Math.max(1, Math.ceil(sized.height))
        await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport: sized }).promise
        const text = (await worker.recognize(canvas)).data.text.slice(0, OCR_MAX_TEXT_CHARACTERS - total)
        pages.push(text); total += text.length
        canvas.width = 0; canvas.height = 0
      }
      return pages.join('\n').trim()
    } finally { await worker.terminate() }
  } finally { await task.destroy() }
}

export function extractLocalOcrText(file: Blob, mimeType: string): Promise<string> {
  let result = textCache.get(file)
  if (!result) {
    result = (mimeType === 'application/pdf' ? extractScannedPdfText(file) : extractImageText(file)).catch(() => '')
    textCache.set(file, result)
  }
  return result
}
