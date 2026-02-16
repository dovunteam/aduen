import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listPacks, nextPackVersion, savePack } from './packRepository'
import { createComplaintPack, approveComplaintPack } from '../domain/complaintPack'
import { EMPTY_DRAFT } from '../domain/case'
import { evaluateInitialRoute } from '../domain/routing'

beforeEach(() => {
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  })
})
afterEach(() => vi.unstubAllGlobals())

describe('immutable pack storage', () => {
  it('allows initial approval and repeated saves but rejects altered content or approval', () => {
    const draft = createComplaintPack(EMPTY_DRAFT, [], evaluateInitialRoute(EMPTY_DRAFT, []))
    savePack(draft)
    const approved = approveComplaintPack(draft)
    savePack(approved)
    savePack(approved)
    expect(() => savePack({ ...approved, consumerName: 'Changed' })).toThrow('immutable')
    expect(() => savePack({ ...approved, approvedAt: null })).toThrow('approval')
    expect(listPacks()).toEqual([approved])
  })

  it('preserves historical versions when a new pack is created', () => {
    const first = createComplaintPack(EMPTY_DRAFT, [], evaluateInitialRoute(EMPTY_DRAFT, []))
    savePack(first)
    expect(() => savePack({ ...first, id: 'different-id' })).toThrow('version already exists')
    const second = createComplaintPack({ ...EMPTY_DRAFT, consumerName: 'Updated' }, [], evaluateInitialRoute(EMPTY_DRAFT, []), new Date(), nextPackVersion())
    savePack(second)
    expect(listPacks()).toEqual([first, second])
  })

  it('ignores malformed stored packs without discarding valid versions', () => {
    const valid = createComplaintPack(EMPTY_DRAFT, [], evaluateInitialRoute(EMPTY_DRAFT, []))
    localStorage.setItem('Aduen.pack-versions.v1', JSON.stringify([{ id: 'broken', version: 'one' }, valid]))
    expect(listPacks()).toEqual([valid])
    expect(nextPackVersion()).toBe(2)
  })

  it('treats packs saved before locale support as English', () => {
    const legacy = createComplaintPack(EMPTY_DRAFT, [], evaluateInitialRoute(EMPTY_DRAFT, []))
    const { locale: _locale, ...legacyPack } = legacy
    localStorage.setItem('Aduen.pack-versions.v1', JSON.stringify([legacyPack]))
    expect(listPacks()).toEqual([legacy])
  })

  it('ignores packs with malformed creation or approval timestamps', () => {
    const valid = createComplaintPack(EMPTY_DRAFT, [], evaluateInitialRoute(EMPTY_DRAFT, []))
    localStorage.setItem('Aduen.pack-versions.v1', JSON.stringify([
      { ...valid, createdAt: '2026-09-21' },
      { ...valid, id: 'approved-invalid', approvedAt: 'not-a-date' },
      valid,
    ]))
    expect(listPacks()).toEqual([valid])
  })

  it('rejects malformed packs before writing them', () => {
    const valid = createComplaintPack(EMPTY_DRAFT, [], evaluateInitialRoute(EMPTY_DRAFT, []))
    expect(() => savePack({ ...valid, createdAt: '2026-09-21' })).toThrow('Invalid pack')
    expect(listPacks()).toEqual([])
  })

  it('rejects packs with unsafe route links', () => {
    const valid = createComplaintPack(EMPTY_DRAFT, [], evaluateInitialRoute(EMPTY_DRAFT, []))
    expect(() => savePack({ ...valid, route: { ...valid.route, sourceUrl: 'javascript:alert(1)' } })).toThrow('Invalid pack')
    expect(() => savePack({ ...valid, route: { ...valid.route, officialLinks: [{ label: 'Unsafe', url: 'http://example.test' }] } })).toThrow('Invalid pack')
    expect(listPacks()).toEqual([])
  })

  it('rejects packs with unsafe generated text', () => {
    const valid = createComplaintPack(EMPTY_DRAFT, [], evaluateInitialRoute(EMPTY_DRAFT, []))
    expect(() => savePack({ ...valid, disclaimer: 'Synthetic\ntext' })).toThrow('Invalid pack')
    expect(() => savePack({ ...valid, consumerName: 'x'.repeat(501) })).toThrow('Invalid pack')
    expect(() => savePack({ ...valid, route: { ...valid.route, routeName: 'x'.repeat(241) } })).toThrow('Invalid pack')
    expect(listPacks()).toEqual([])
  })

  it('ignores malformed official-link collections without discarding valid packs', () => {
    const valid = createComplaintPack(EMPTY_DRAFT, [], evaluateInitialRoute(EMPTY_DRAFT, []))
    localStorage.setItem('Aduen.pack-versions.v1', JSON.stringify([
      { ...valid, id: 'bad-object-links', route: { ...valid.route, officialLinks: { label: 'bad' } } },
      { ...valid, id: 'bad-item-links', route: { ...valid.route, officialLinks: [null] } },
      valid,
    ]))
    expect(listPacks()).toEqual([valid])
  })
})
