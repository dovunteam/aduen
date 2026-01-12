import JSZip from 'jszip'
import type { CaseDraft } from '../domain/case'
import type { SubmissionRecord } from '../domain/status'
import { getEvidenceOriginal, listEvidence } from './evidenceRepository'
import { readConsent } from './consentRepository'
import { readCase } from './caseRepository'
import { listPacks } from './packRepository'

export async function downloadCaseArchive(draft: CaseDraft, submission: SubmissionRecord): Promise<void> {
  const evidence = await listEvidence()
  const zip = new JSZip()
  const manifest = {
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    notice: 'User-controlled Tuntiva prototype export. Evidence originals have not been altered.',
    case: draft,
    caseRecord: readCase(),
    packVersions: listPacks(),
    consent: readConsent(),
    submission,
    evidence,
  }
  zip.file('case-record.json', JSON.stringify(manifest, null, 2))
  const originals = zip.folder('evidence-originals')
  for (const [index, item] of evidence.entries()) {
    const original = await getEvidenceOriginal(item.id)
    if (original) originals?.file(`${String(index + 1).padStart(2, '0')}-${safeFileName(item.fileName)}`, original)
  }
  const archive = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
  const url = URL.createObjectURL(archive)
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = `tuntiva-case-export-${new Date().toISOString().slice(0, 10)}.zip`; anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function safeFileName(name: string): string {
  const withoutControls = Array.from(name, (character) => character.charCodeAt(0) < 32 ? '_' : character).join('')
  return withoutControls.replace(/[<>:"/\\|?*]/g, '_').replace(/\.{2,}/g, '.').slice(0, 120) || 'evidence-file'
}
