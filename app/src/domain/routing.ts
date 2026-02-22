import type { CaseDraft } from './case'
import type { CheckItem } from './caseReview'
import { assessScope } from './scope'

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
  officialLinks?: Array<{ label: string; url: string }>
}

export type TtpmAssessment = { status: 'excluded' | 'uncertain'; reason: string }
export const ROUTE_SOURCE_REVIEW_DAYS = 180
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000

export function assessTtpmPrerequisites(draft: CaseDraft): TtpmAssessment {
  if (!draft.purpose || !draft.category) return { status: 'uncertain', reason: 'TTPM check: confirm the purchase purpose and category.' }
  if (draft.purpose === 'business') return { status: 'excluded', reason: 'TTPM check: business or professional purchase is outside the documented consumer scope.' }
  if (['healthcare', 'professional_service', 'land', 'aviation', 'personal_injury', 'wills_estates', 'franchise', 'goodwill_ip', 'other_tribunal'].includes(draft.category)) return { status: 'excluded', reason: 'TTPM check: this recorded category is listed as excluded or assigned to a sector-specific process.' }
  const amount = Number(draft.amount)
  if (!Number.isFinite(amount) || amount <= 0) return { status: 'uncertain', reason: 'TTPM check: confirm the transaction amount.' }
  return { status: 'uncertain', reason: 'TTPM applies the RM50,000 limit to the claim amount and its three-year limit to when the claim accrued. Aduen records transaction amount and purchase date only, so it cannot assess either limit; verify both with TTPM.' }
}

export function evaluateInitialRoute(draft: CaseDraft, checks: CheckItem[], now = new Date()): RouteEvaluation {
  const route = evaluateRoute(draft, checks)
  if (route.confidence !== 'supported' || isRouteSourceCurrent(route.sourceChecked, now)) return route
  return {
    ...route,
    routeName: 'Manual source review',
    recommendedAction: 'This route source review is overdue. Check current official guidance before taking the next step.',
    matchingFacts: [...route.matchingFacts, `Rule source last checked: ${route.sourceChecked}`],
    unmetPrerequisites: [...route.unmetPrerequisites, 'Review current route source'],
    exclusionsChecked: [...route.exclusionsChecked, 'Source freshness checked'],
    confidence: 'uncertain',
  }
}

function isRouteSourceCurrent(sourceChecked: string, now: Date): boolean {
  const checkedAt = Date.parse(sourceChecked)
  if (!Number.isFinite(checkedAt) || !Number.isFinite(now.getTime())) return false
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const checkedDay = Date.UTC(new Date(checkedAt).getUTCFullYear(), new Date(checkedAt).getUTCMonth(), new Date(checkedAt).getUTCDate())
  const ageInDays = Math.floor((today - checkedDay) / DAY_IN_MILLISECONDS)
  return ageInDays >= 0 && ageInDays <= ROUTE_SOURCE_REVIEW_DAYS
}

function evaluateRoute(draft: CaseDraft, checks: CheckItem[]): RouteEvaluation {
  const missing = checks.filter((item) => item.level === 'required' && !item.satisfied).map((item) => item.label)
  const base = {
    source: 'Aduen Case Routing Rules — R-010 Merchant-first',
    sourceUrl: 'https://github.com/dovunteam/aduen/blob/main/docs/Aduen_Case_Routing_Rules.md#r-010-merchant-first',
    sourceType: 'product-default' as const,
    sourceChecked: '2026-09-23',
    ruleVersion: 'MY-R010-2026.09.23.1',
  }

  if (draft.purpose === 'business') return {
    ...base, routeName: 'Manual review', recommendedAction: 'This prototype supports personal, domestic, or household purchases only.',
    matchingFacts: ['Purchase recorded as business or professional'], unmetPrerequisites: [], exclusionsChecked: ['Personal-consumer scope'], confidence: 'unsupported',
  }
  if (draft.consumerLocation !== 'malaysia') return {
    ...base, routeName: 'Manual review', recommendedAction: 'This prototype is scoped to consumers in Malaysia.',
    matchingFacts: [`Consumer location: ${draft.consumerLocation || 'not confirmed'}`], unmetPrerequisites: draft.consumerLocation ? [] : ['Consumer location'], exclusionsChecked: ['Malaysian consumer scope'], confidence: draft.consumerLocation ? 'unsupported' : 'uncertain',
  }
  if (['healthcare', 'professional_service', 'land', 'personal_injury', 'wills_estates', 'franchise', 'goodwill_ip', 'other_tribunal'].includes(draft.category)) return {
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
  const scope = assessScope(draft)
  if (scope.result === 'uncertain') return {
    ...base, routeName: 'Manual scope review', recommendedAction: 'Clarify the category and seller jurisdiction before preparing a routed complaint.',
    matchingFacts: scope.reasons, unmetPrerequisites: [...missing, 'Reviewed category and seller jurisdiction'],
    exclusionsChecked: ['Prototype scope uncertainty retained'], confidence: 'uncertain',
  }
  const amount = Number(draft.amount)
  if (!Number.isFinite(amount) || amount <= 0) return {
    ...base, routeName: 'Manual review', recommendedAction: 'Confirm the transaction amount before selecting a route.',
    matchingFacts: ['Transaction amount is missing or invalid'], unmetPrerequisites: [...missing, 'Transaction amount'],
    exclusionsChecked: ['Required transaction facts checked'], confidence: 'uncertain',
  }
  const missingScope = [!draft.purpose && 'Purchase purpose', !draft.category && 'Purchase category', !draft.sellerLocation && 'Seller location', !draft.issue && 'Issue type', !draft.remedy && 'Requested remedy'].filter((item): item is string => Boolean(item))
  if (draft.contactHistory === 'none' && missingScope.length) return {
    ...base, routeName: 'Manual review', recommendedAction: 'Confirm the missing case facts before selecting a route.',
    matchingFacts: ['The case record is incomplete'], unmetPrerequisites: [...missing, ...missingScope],
    exclusionsChecked: ['Required scope facts checked'], confidence: 'uncertain',
  }
  if (draft.contactHistory === 'none') return {
    ...base, routeName: 'Merchant or platform first', recommendedAction: 'Send a clear written request with the transaction identity, failure, requested remedy, and a request for response.',
    matchingFacts: ['No prior written merchant contact recorded', `Requested remedy: ${draft.remedy}`], unmetPrerequisites: missing,
    exclusionsChecked: ['No urgent exception declared', 'Purchase recorded as personal or household'], confidence: 'supported',
  }
  return {
    ...base, routeName: 'Manual route review', recommendedAction: 'Review the merchant contact and response before choosing any external escalation channel.',
    matchingFacts: [`Merchant contact recorded: ${draft.contactHistory}`, ...(draft.contactDate ? [`Contact date: ${draft.contactDate}`] : []), assessTtpmPrerequisites(draft).reason],
    unmetPrerequisites: [...missing, ...(!draft.contactDate ? ['Date of merchant contact'] : []), ...(assessTtpmPrerequisites(draft).status === 'uncertain' ? ['TTPM claim amount and accrual date require official verification'] : [])], exclusionsChecked: ['Merchant-first prerequisite considered'], confidence: 'uncertain',
    officialLinks: [
      { label: 'KPDN e-Aduan', url: 'https://eaduan.kpdn.gov.my/' },
      { label: 'TTPM e-Tribunal', url: 'https://ttpm.kpdn.gov.my/?lang=en' },
    ],
  }
}
