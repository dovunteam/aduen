import JSZip from 'jszip'
import type { CaseDraft } from '../domain/case'
import type { SubmissionRecord } from '../domain/status'
import { getEvidenceOriginal, listEvidence, listExtractions } from './evidenceRepository'
import { readConsent } from './consentRepository'
import { readCase } from './caseRepository'
import { listPacks } from './packRepository'

export async function buildCaseArchive(draft: CaseDraft, submission: SubmissionRecord): Promise<Uint8Array> {
  const evidence = await listEvidence()
  const extractions = await listExtractions()
  const zip = new JSZip()
  const manifest = {
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    notice: 'User-controlled Buktiva prototype export. Evidence originals have not been altered.',
    case: draft,
    caseRecord: readCase(),
    packVersions: listPacks(),
    consent: readConsent(),
    submission,
    evidence,
    extractions,
  }
  zip.file('case-record.json', JSON.stringify(manifest, null, 2))
  const originals = zip.folder('evidence-originals')
  for (const [index, item] of evidence.entries()) {
    const original = await getEvidenceOriginal(item.id)
    if (!original) throw new Error(`The complete export could not be created: original missing for ${item.fileName}. Your stored case data has not been changed.`)
    const bytes = await original.arrayBuffer()
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
    if (hash !== item.sha256) throw new Error(`The complete export could not be verified: original integrity check failed for ${item.fileName}. Your stored case data has not been changed.`)
    originals?.file(`${String(index + 1).padStart(2, '0')}-${safeFileName(item.fileName)}`, bytes)
  }
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } })
}

export async function downloadCaseArchive(draft: CaseDraft, submission: SubmissionRecord): Promise<void> {
  const bytes = await buildCaseArchive(draft, submission)
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/zip' }))
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = `buktiva-case-export-${new Date().toISOString().slice(0, 10)}.zip`; anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function safeFileName(name: string): string {
  const withoutControls = Array.from(name, (character) => character.charCodeAt(0) < 32 ? '_' : character).join('')
  return withoutControls.replace(/[<>:"/\\|?*]/g, '_').replace(/\.{2,}/g, '.').slice(0, 120) || 'evidence-file'
}
