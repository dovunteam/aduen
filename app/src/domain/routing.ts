import type { CaseDraft } from './case'
import type { CheckItem } from './caseReview'

export type RouteEvaluation = {
  routeName: string
  recommendedAction: string
  matchingFacts: string[]
  unmetPrerequisites: string[]
  exclusionsChecked: string[]
  source: string
  sourceUrl: string
  sourceType: 'product-default' | 'official'
  sourceChecked: string
  ruleVersion: string
  confidence: 'supported' | 'uncertain' | 'unsupported'
}

export function evaluateInitialRoute(draft: CaseDraft, checks: CheckItem[]): RouteEvaluation {
  const missing = checks.filter((item) => item.level === 'required' && !item.satisfied).map((item) => item.label)
  const base = {
    source: 'Tuntiva Case Routing Rules — R-010 Merchant-first',
    sourceUrl: 'https://github.com/dovunteam/tuntiva/blob/5d42568/docs/Tuntiva_Case_Routing_Rules.md#r-010-merchant-first',
    sourceType: 'product-default' as const,
    sourceChecked: '20 September 2026',
    ruleVersion: 'MY-R010-2026.09.20',
  }

  if (draft.purpose === 'business') return {
    ...base, routeName: 'Manual review', recommendedAction: 'This prototype supports personal, domestic, or household purchases only.',
    matchingFacts: ['Purchase recorded as business or professional'], unmetPrerequisites: [], exclusionsChecked: ['Personal-consumer scope'], confidence: 'unsupported',
  }
  if (draft.consumerLocation !== 'malaysia') return {
    ...base, routeName: 'Manual review', recommendedAction: 'This prototype is scoped to consumers in Malaysia.',
    matchingFacts: [`Consumer location: ${draft.consumerLocation || 'not confirmed'}`], unmetPrerequisites: draft.consumerLocation ? [] : ['Consumer location'], exclusionsChecked: ['Malaysian consumer scope'], confidence: draft.consumerLocation ? 'unsupported' : 'uncertain',
  }
  if (['healthcare', 'professional_service', 'land'].includes(draft.category)) return {
    ...base, routeName: 'Out of supported scope', recommendedAction: 'This category needs an independent route and is not handled by the prototype.',
    matchingFacts: [`Purchase category: ${draft.category.replaceAll('_', ' ')}`], unmetPrerequisites: [], exclusionsChecked: ['Sector exclusion'], confidence: 'unsupported',
  }
  if (draft.category === 'aviation' || draft.category === 'financial_service') return {
    ...base, routeName: 'Sector route review', recommendedAction: 'A current sector-specific source must be checked before recommending the next channel.',
    matchingFacts: [`Purchase category: ${draft.category.replaceAll('_', ' ')}`], unmetPrerequisites: ['Live official sector requirements'], exclusionsChecked: ['General consumer route paused'], confidence: 'uncertain',
  }
  if (draft.issue === 'uncertain') return {
    ...base, routeName: 'Manual review', recommendedAction: 'Clarify the main transaction failure before selecting a route.',
    matchingFacts: ['Issue type is uncertain'], unmetPrerequisites: missing, exclusionsChecked: ['Urgent-risk triage completed'], confidence: 'uncertain',
  }
  if (draft.contactHistory === 'none') return {
    ...base, routeName: 'Merchant or platform first', recommendedAction: 'Send a clear written request with the transaction identity, failure, requested remedy, and a request for response.',
    matchingFacts: ['No prior written merchant contact recorded', `Requested remedy: ${draft.remedy}`], unmetPrerequisites: missing,
    exclusionsChecked: ['No urgent exception declared', 'Purchase recorded as personal or household'], confidence: 'supported',
  }
  return {
    ...base, routeName: 'Manual route review', recommendedAction: 'Review the merchant contact and response before choosing any external escalation channel.',
    matchingFacts: [`Merchant contact recorded: ${draft.contactHistory}`, ...(draft.contactDate ? [`Contact date: ${draft.contactDate}`] : [])],
    unmetPrerequisites: [...missing, ...(!draft.contactDate ? ['Date of merchant contact'] : [])], exclusionsChecked: ['Merchant-first prerequisite considered'], confidence: 'uncertain',
  }
}
