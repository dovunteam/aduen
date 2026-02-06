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
    localStorage.setItem('buktiva.pack-versions.v1', JSON.stringify([{ id: 'broken', version: 'one' }, valid]))
    expect(listPacks()).toEqual([valid])
    expect(nextPackVersion()).toBe(2)
  })

  it('ignores packs with malformed creation or approval timestamps', () => {
    const valid = createComplaintPack(EMPTY_DRAFT, [], evaluateInitialRoute(EMPTY_DRAFT, []))
    localStorage.setItem('buktiva.pack-versions.v1', JSON.stringify([
      { ...valid, createdAt: '2026-09-21' },
      { ...valid, id: 'approved-invalid', approvedAt: 'not-a-date' },
      valid,
    ]))
    expect(listPacks()).toEqual([valid])
  })
})
