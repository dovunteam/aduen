import JSZip from 'jszip'
import type { ComplaintPack } from '../domain/complaintPack'
import { packFileName } from '../domain/complaintPack'
import { getEvidenceOriginal } from './evidenceRepository'
import { createComplaintPackPdf } from './packPdf'
import { safeFileName } from './caseArchive'
import { listAuditEvents, recordAuditEvent } from './auditRepository'

export async function buildHandoffArchive(pack: ComplaintPack): Promise<Uint8Array> {
  if (!pack.approvedAt) throw new Error('Approve the pack before exporting it.')
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
    notice: 'User-approved Buktiva handoff archive. It contains the approved pack and only the evidence selected for that pack.',
    pack: { id: pack.id, version: pack.version, approvedAt: pack.approvedAt, route: pack.route },
    auditLog: listAuditEvents(),
    evidence: manifestEvidence,
  }, null, 2))
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } })
}

export async function downloadHandoffArchive(pack: ComplaintPack): Promise<void> {
  const bytes = await buildHandoffArchive(pack)
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/zip' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = packFileName(pack).replace(/\.pdf$/i, '-handoff.zip')
  anchor.click()
  recordAuditEvent('handoff_exported', pack.id, `approved pack v${pack.version} handoff archive exported`)
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
