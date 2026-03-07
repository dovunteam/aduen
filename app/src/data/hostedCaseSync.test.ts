import { describe, expect, it, vi } from 'vitest'
import { createCaseRecord, EMPTY_DRAFT } from '../domain/case'
import { CaseApiError } from './caseApi'
import { saveHostedCase } from './hostedCaseSync'
import type { HostedCaseApi } from './hostedCaseSync'

describe('explicit hosted case save', () => {
  const record = createCaseRecord(EMPTY_DRAFT)

  it('creates a hosted copy when the signed-in account does not have this case', async () => {
    const api = {
      get: vi.fn().mockRejectedValue(new CaseApiError(404, 'case_not_found')),
      create: vi.fn().mockResolvedValue({ record, revision: 1 }),
      replace: vi.fn(),
    }
    await saveHostedCase(api as unknown as HostedCaseApi, record)
    expect(api.create).toHaveBeenCalledWith(record)
    expect(api.replace).not.toHaveBeenCalled()
  })

  it('replaces only with the revision just read', async () => {
    const api = {
      get: vi.fn().mockResolvedValue({ record, revision: 7 }),
      create: vi.fn(),
      replace: vi.fn().mockResolvedValue({ record, revision: 8 }),
    }
    await saveHostedCase(api as unknown as HostedCaseApi, record)
    expect(api.replace).toHaveBeenCalledWith(record, 7)
    expect(api.create).not.toHaveBeenCalled()
  })

  it('does not treat conflicts or service failures as permission to create or overwrite', async () => {
    const api = {
      get: vi.fn().mockRejectedValue(new CaseApiError(503, 'internal_error')),
      create: vi.fn(),
      replace: vi.fn(),
    }
    await expect(saveHostedCase(api as unknown as HostedCaseApi, record)).rejects.toMatchObject({ status: 503 })
    expect(api.create).not.toHaveBeenCalled()
    expect(api.replace).not.toHaveBeenCalled()
  })
})
