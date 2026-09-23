import type { CaseDraft } from '../domain/case'
import type { CheckItem, TimelineItem } from '../domain/caseReview'
import type { EvidenceMetadata } from '../domain/evidence'
import type { EvidenceExtraction } from '../domain/extraction'
import type { RouteEvaluation } from '../domain/routing'
import type { Locale } from '../i18n'
import { createAuditEvent, persistAuditEvent } from './auditRepository'

export type ReviewBrief = {
  exportVersion: 1
  exportedAt: string
  notice: string
  case: CaseDraft
  locale: Locale
  checks: CheckItem[]
  timeline: TimelineItem[]
  conflicts: string[]
  route: RouteEvaluation
  evidence: EvidenceMetadata[]
  extractions: EvidenceExtraction[]
}

export function buildReviewBrief(input: Omit<ReviewBrief, 'exportVersion' | 'exportedAt' | 'notice'>, now = new Date()): ReviewBrief {
  return {
    exportVersion: 1,
    exportedAt: now.toISOString(),
    notice: 'Aduen manual review brief. It contains structured case data and evidence metadata, but not original evidence files. Review the originals in Aduen before making a decision.',
    ...input,
  }
}

export function downloadReviewBrief(brief: ReviewBrief, caseId: string): void {
  const event = createAuditEvent('review_brief_exported', caseId, 'manual review brief exported')
  const payload = JSON.stringify({ ...brief, auditEvent: event }, null, 2)
  const url = URL.createObjectURL(new Blob([payload], { type: 'application/json;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `Aduen-manual-review-${new Date(brief.exportedAt).toISOString().slice(0, 10)}.json`
  anchor.click()
  persistAuditEvent(event)
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
