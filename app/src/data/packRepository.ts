import type { ComplaintPack } from '../domain/complaintPack'

const PACKS_KEY = 'buktiva.pack-versions.v1'
const TUNTIVA_PACKS_KEY = 'tuntiva.pack-versions.v1'

export function listPacks(): ComplaintPack[] {
  try {
    const current = localStorage.getItem(PACKS_KEY)
    const value = current ?? localStorage.getItem(TUNTIVA_PACKS_KEY)
    if (!value) return []
    if (!current) { localStorage.setItem(PACKS_KEY, value); localStorage.removeItem(TUNTIVA_PACKS_KEY) }
    return (JSON.parse(value) as ComplaintPack[]).map((pack) => ({ ...pack, confirmedDerivedFacts: pack.confirmedDerivedFacts ?? [], merchantRequest: pack.merchantRequest ?? { subject: '', body: '', generatedFrom: [] }, route: { ...pack.route, sourceUrl: pack.route.sourceUrl ?? 'https://github.com/dovunteam/tuntiva/blob/main/docs/Buktiva_Case_Routing_Rules.md' } }))
  }
  catch { return [] }
}

export function savePack(pack: ComplaintPack): void {
  const existing = listPacks()
  const next = existing.some((item) => item.id === pack.id) ? existing.map((item) => item.id === pack.id ? pack : item) : [...existing, pack]
  localStorage.setItem(PACKS_KEY, JSON.stringify(next))
}

export function nextPackVersion(): number { return Math.max(0, ...listPacks().map((pack) => pack.version)) + 1 }
export function clearPacks(): void { localStorage.removeItem(PACKS_KEY); localStorage.removeItem(TUNTIVA_PACKS_KEY) }
