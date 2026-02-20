import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

export const PDF_TEXT_MAX_PAGES = 30
export const PDF_TEXT_MAX_CHARACTERS = 500_000

GlobalWorkerOptions.workerSrc = workerUrl

export async function extractPdfText(file: Blob): Promise<string> {
  const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  try {
    const document = await task.promise
    if (document.numPages > PDF_TEXT_MAX_PAGES) return ''
    const pages: string[] = []
    let length = 0
    for (let pageNumber = 1; pageNumber <= document.numPages && length < PDF_TEXT_MAX_CHARACTERS; pageNumber += 1) {
      const page = await document.getPage(pageNumber)
      const content = await page.getTextContent()
      const text = content.items.map((item) => 'str' in item ? item.str : '').join(' ')
      const boundedText = text.slice(0, PDF_TEXT_MAX_CHARACTERS - length)
      pages.push(boundedText)
      length += boundedText.length
    }
    return pages.join('\n').trim()
  } finally {
    await task.destroy()
  }
}
