import JSZip from 'jszip'
import type { ComplaintPack } from '../domain/complaintPack'
import { packFileName } from '../domain/complaintPack'
import { getEvidenceOriginal } from './evidenceRepository'
import { createComplaintPackPdf } from './packPdf'
import { safeFileName } from './caseArchive'
import { createAuditEvent, listAuditEvents, persistAuditEvent } from './auditRepository'
import type { LocalAuditEvent } from './auditRepository'
import { isCompleteOperatorReview, readOperatorReview } from './operatorReviewRepository'

export async function buildHandoffArchive(pack: ComplaintPack, additionalAuditEvents: LocalAuditEvent[] = []): Promise<Uint8Array> {
  if (!pack.approvedAt) throw new Error('Approve the pack before exporting it.')
  const operatorReview = readOperatorReview(pack.id)
  if (!isCompleteOperatorReview(operatorReview)) throw new Error('Record the operator review before exporting the handoff.')
  const zip = new JSZip()
  zip.file(packFileName(pack), createComplaintPackPdf(pack).output('arraybuffer'))
  const evidenceFolder = zip.folder('selected-evidence')
  const manifestEvidence = []
  for (const [index, item] of pack.evidence.entries()) {
    const original = await getEvidenceOriginal(item.id)
    if (!original) throw new Error(`Original missing: ${item.fileName}. Return to evidence before exporting this pack.`)
    const bytes = await original.arrayBuffer()
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
    if (hash !== item.sha256) throw new Error(`Original integrity check failed: ${item.fileName}.`)
    const fileName = `${String(index + 1).padStart(2, '0')}-${safeFileName(item.fileName)}`
    evidenceFolder?.file(fileName, bytes)
    manifestEvidence.push({ ...item, archivePath: `selected-evidence/${fileName}` })
  }
  zip.file('manifest.json', JSON.stringify({
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    notice: 'User-approved Aduen handoff archive. It contains the approved pack and only the evidence selected for that pack.',
    pack: { id: pack.id, version: pack.version, approvedAt: pack.approvedAt, route: pack.route, operatorReview },
    auditLog: [...listAuditEvents(), ...additionalAuditEvents],
    evidence: manifestEvidence,
  }, null, 2))
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } })
}

export async function downloadHandoffArchive(pack: ComplaintPack): Promise<void> {
  const exportEvent = createAuditEvent('handoff_exported', pack.id, `approved pack v${pack.version} handoff archive exported`)
  const bytes = await buildHandoffArchive(pack, [exportEvent])
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/zip' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = packFileName(pack).replace(/\.pdf$/i, '-handoff.zip')
  anchor.click()
  persistAuditEvent(exportEvent)
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
