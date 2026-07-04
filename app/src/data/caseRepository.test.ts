import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EMPTY_DRAFT } from '../domain/case'
import { readCase } from './caseRepository'

beforeEach(() => {
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  })
})
afterEach(() => vi.unstubAllGlobals())

describe('case repository', () => {
  it('rejects a stored case with an unknown lifecycle status', () => {
    localStorage.setItem('buktiva.case-record.v1', JSON.stringify({ id: 'case-1', createdAt: '2026-09-21', updatedAt: '2026-09-21', status: 'invalid', draft: EMPTY_DRAFT, history: [] }))
    expect(readCase()).toBeNull()
  })
})
