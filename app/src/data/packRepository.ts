import type { ComplaintPack } from '../domain/complaintPack'

const PACKS_KEY = 'tuntiva.pack-versions.v1'

export function listPacks(): ComplaintPack[] {
  try { const value = localStorage.getItem(PACKS_KEY); return value ? (JSON.parse(value) as ComplaintPack[]).map((pack) => ({ ...pack, confirmedDerivedFacts: pack.confirmedDerivedFacts ?? [] })) : [] }
  catch { return [] }
}

export function savePack(pack: ComplaintPack): void {
  const existing = listPacks()
  const next = existing.some((item) => item.id === pack.id) ? existing.map((item) => item.id === pack.id ? pack : item) : [...existing, pack]
  localStorage.setItem(PACKS_KEY, JSON.stringify(next))
}

export function nextPackVersion(): number { return Math.max(0, ...listPacks().map((pack) => pack.version)) + 1 }
export function clearPacks(): void { localStorage.removeItem(PACKS_KEY) }
