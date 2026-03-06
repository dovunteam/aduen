import { z } from 'zod'

const statuses = ['draft', 'out_of_scope', 'evidence_collection', 'confirmation', 'review', 'ready_for_pack', 'approved', 'handed_off', 'awaiting_response', 'resolved', 'closed'] as const
const safeText = (max: number, required = false) => z.string().max(max).refine((value) => (!required || value.length > 0) && !/[\u0000-\u001f\u007f]/u.test(value))
const dateOnly = z.string().refine((value) => {
  if (value === '') return true
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
})
const amount = z.string().refine((value) => value === '' || (/^\d+(?:\.\d{1,2})?$/u.test(value) && Number.isFinite(Number(value))))
const timestamp = z.string().refine((value) => {
  try { return new Date(value).toISOString() === value } catch { return false }
})

const draftSchema = z.object({
  consumerName: safeText(500),
  consumerLocation: z.enum(['malaysia', 'outside', '']),
  seller: safeText(500),
  sellerLocation: z.enum(['malaysia', 'outside', 'unknown', '']),
  platform: safeText(500),
  purchaseDate: dateOnly,
  amount,
  claimAmount: amount,
  claimAccruedDate: dateOnly,
  currency: z.literal('MYR'),
  paymentMethod: safeText(500),
  orderReference: safeText(500),
  purpose: z.enum(['personal', 'business', '']),
  issue: z.enum(['non_delivery', 'mismatch', 'missing_refund', 'cancellation', 'uncertain', '']),
  category: z.enum(['general_goods', 'general_services', 'aviation', 'financial_service', 'healthcare', 'professional_service', 'land', 'personal_injury', 'wills_estates', 'franchise', 'goodwill_ip', 'other_tribunal', 'other', '']),
  remedy: z.enum(['delivery', 'replacement', 'repair', 'cancellation', 'refund', '']),
  remedyAmount: amount,
  promisedDate: dateOnly,
  contactHistory: z.enum(['none', 'contacted', 'responded', '']),
  contactDate: dateOnly,
}).strict()

const auditEventSchema = z.object({
  at: timestamp,
  actor: z.enum(['user', 'system']),
  action: safeText(160, true),
  status: z.enum(statuses),
}).strict()

export const caseRecordSchema = z.object({
  id: z.uuid(),
  createdAt: timestamp,
  updatedAt: timestamp,
  status: z.enum(statuses),
  draft: draftSchema,
  history: z.array(auditEventSchema).min(1).max(500),
}).strict()

export type CaseRecord = z.infer<typeof caseRecordSchema>
