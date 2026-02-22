import type { CaseDraft } from './case'

export type ScopeAssessment = { result: 'supported' | 'uncertain' | 'unsupported'; reasons: string[] }

export function assessScope(draft: CaseDraft): ScopeAssessment {
  const unsupported: string[] = []
  if (draft.purpose === 'business') unsupported.push('The purchase was for business or professional use.')
  if (draft.consumerLocation === 'outside') unsupported.push('The consumer is outside the prototype’s Malaysian scope.')
  const categoryReason: Partial<Record<CaseDraft['category'], string>> = {
    aviation: 'Airline and airport matters need a current sector-specific process.',
    financial_service: 'Regulated financial-service complaints need a current provider and sector process.',
    healthcare: 'Healthcare matters are excluded from this prototype.',
    professional_service: 'Regulated professional services are excluded from this prototype.',
    land: 'Land and property matters are excluded from this prototype.',
    personal_injury: 'Claims arising from personal injury or death are excluded from TTPM jurisdiction.',
    wills_estates: 'Wills, inheritance, and estate-rights disputes are excluded from TTPM jurisdiction.',
    franchise: 'Franchise disputes are excluded from TTPM jurisdiction.',
    goodwill_ip: 'Goodwill, trade-secret, and intellectual-property disputes are excluded from TTPM jurisdiction.',
    other_tribunal: 'This subject may belong to another tribunal and is outside the prototype’s supported scope.',
  }
  if (categoryReason[draft.category]) unsupported.push(categoryReason[draft.category] as string)
  if (unsupported.length) return { result: 'unsupported', reasons: unsupported }
  const uncertain: string[] = []
  if (!draft.purpose) uncertain.push('The purchase purpose needs confirmation.')
  if (!draft.consumerLocation) uncertain.push('The consumer location needs confirmation.')
  if (!draft.category) uncertain.push('The purchase category needs confirmation.')
  if (!draft.sellerLocation) uncertain.push('The seller location needs confirmation.')
  if (draft.category === 'other') uncertain.push('The purchase category needs manual review.')
  if (draft.sellerLocation === 'outside' || draft.sellerLocation === 'unknown') uncertain.push('The seller’s location may limit available recovery routes.')
  return { result: uncertain.length ? 'uncertain' : 'supported', reasons: uncertain }
}
