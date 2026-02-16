import type { ComplaintPack } from '../domain/complaintPack'

const PACKS_KEY = 'Aduen.pack-versions.v1'
const TUNTIVA_PACKS_KEY = 'tuntiva.pack-versions.v1'

export function listPacks(): ComplaintPack[] {
  try {
    const current = localStorage.getItem(PACKS_KEY)
    const value = current ?? localStorage.getItem(TUNTIVA_PACKS_KEY)
    if (!value) return []
    if (!current) { localStorage.setItem(PACKS_KEY, value); localStorage.removeItem(TUNTIVA_PACKS_KEY) }
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((pack) => {
      if (!pack || typeof pack !== 'object') return []
      const candidate = pack as Partial<ComplaintPack>
      const normalised = { ...candidate, locale: candidate.locale === 'ms' ? 'ms' : 'en', confirmedDerivedFacts: candidate.confirmedDerivedFacts ?? [], merchantRequest: candidate.merchantRequest ?? { subject: '', body: '', generatedFrom: [] }, route: candidate.route ? { ...candidate.route, sourceUrl: candidate.route.sourceUrl ?? 'https://github.com/dovunteam/aduen/blob/main/docs/Aduen_Case_Routing_Rules.md' } : null }
      return isComplaintPack(normalised) ? [normalised] : []
    })
  }
  catch { return [] }
}

export function savePack(pack: ComplaintPack): void {
  if (!isComplaintPack(pack)) throw new Error('Invalid pack.')
  const existing = listPacks()
  const previous = existing.find((item) => item.id === pack.id)
  if (previous) {
    const { approvedAt: previousApproval, ...previousContent } = previous
    const { approvedAt: approval, ...content } = pack
    if (JSON.stringify(previousContent) !== JSON.stringify(content)) throw new Error('Pack content is immutable. Generate a new version for changes.')
    if (previousApproval && approval !== previousApproval) throw new Error('The approval of a saved pack cannot be changed.')
  } else if (existing.some((item) => item.version === pack.version)) {
    throw new Error('This pack version already exists. Generate a new version.')
  }
  const next = existing.some((item) => item.id === pack.id) ? existing.map((item) => item.id === pack.id ? pack : item) : [...existing, pack]
  localStorage.setItem(PACKS_KEY, JSON.stringify(next))
}

export function nextPackVersion(): number { return Math.max(0, ...listPacks().map((pack) => pack.version)) + 1 }
export function clearPacks(): void { localStorage.removeItem(PACKS_KEY); localStorage.removeItem(TUNTIVA_PACKS_KEY) }

function isComplaintPack(value: unknown): value is ComplaintPack {
  if (!value || typeof value !== 'object') return false
  const pack = value as Partial<ComplaintPack>
  return (pack.locale === 'en' || pack.locale === 'ms') && isSafeText(pack.id, 100, true) && typeof pack.version === 'number' && Number.isInteger(pack.version) && pack.version > 0 && typeof pack.createdAt === 'string' && isIsoTimestamp(pack.createdAt) && (pack.approvedAt === null || (typeof pack.approvedAt === 'string' && isIsoTimestamp(pack.approvedAt))) && isSafeText(pack.consumerName, 500) && isSafeText(pack.issue, 120) && isSafeText(pack.remedy, 120) && (pack.remedyAmount === null || isSafeText(pack.remedyAmount, 40)) && Boolean(pack.transaction && typeof pack.transaction === 'object') && Boolean(pack.route && typeof pack.route === 'object') && isSafeRoute(pack.route) && Array.isArray(pack.timeline) && Array.isArray(pack.evidence) && Array.isArray(pack.confirmedDerivedFacts) && Boolean(pack.merchantRequest && typeof pack.merchantRequest === 'object') && isSafeText(pack.disclaimer, 2000) && isSafeText(pack.declaration, 2000)
}

function isSafeRoute(route: ComplaintPack['route'] | undefined): boolean {
  if (!route) return false
  if (!isSafeText(route.routeName, 240) || !isSafeText(route.ruleVersion, 100) || !isSafeText(route.sourceChecked, 80) || !isSafeText(route.sourceUrl, 2000) || !isHttpsUrl(route.sourceUrl)) return false
  if (route.officialLinks === undefined) return true
  return Array.isArray(route.officialLinks) && route.officialLinks.every((link) => Boolean(link && typeof link === 'object' && isSafeText(link.label, 240, true) && isSafeText(link.url, 2000) && isHttpsUrl(link.url)))
}

function isSafeText(value: unknown, maxLength: number, requireNonEmpty = false): value is string {
  return typeof value === 'string' && value.length <= maxLength && (!requireNonEmpty || value.length > 0) && !Array.from(value).some((character) => {
    const code = character.charCodeAt(0)
    return code <= 31 || code === 127
  })
}

function isHttpsUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false
  try { return new URL(value).protocol === 'https:' } catch { return false }
}

function isIsoTimestamp(value: string): boolean {
  try { return new Date(value).toISOString() === value } catch { return false }
}
