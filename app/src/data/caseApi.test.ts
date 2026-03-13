import { describe, expect, it, vi } from 'vitest'
import { createCaseRecord, EMPTY_DRAFT } from '../domain/case'
import { CaseApiError, createCaseApi } from './caseApi'

function setup(fetcher: typeof fetch) {
  return createCaseApi({ baseUrl: 'https://api.example.test/', getAccessToken: () => 'synthetic-access-token', fetcher })
}

describe('authenticated case API client', () => {
  it('lists, creates, and deletes cases with cursor and revision handling', async () => {
    const record = createCaseRecord(EMPTY_DRAFT, new Date('2026-09-24T00:00:00.000Z'))
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ cases: [{ record, revision: 1 }], nextCursor: 'next-page' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ record, revision: 1 }), { status: 201, headers: { ETag: '"1"' } }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    const api = setup(fetcher)

    await expect(api.list(10, 'first-page')).resolves.toEqual({ cases: [{ record, revision: 1 }], nextCursor: 'next-page' })
    await expect(api.create(record)).resolves.toEqual({ record, revision: 1 })
    await expect(api.delete(record.id, 1)).resolves.toBeUndefined()
    expect(fetcher.mock.calls[0]?.[0]).toBe('https://api.example.test/v1/cases?limit=10&cursor=first-page')
    expect(fetcher.mock.calls[1]?.[1]?.method).toBe('POST')
    expect(fetcher.mock.calls[2]?.[1]?.method).toBe('DELETE')
    expect(new Headers(fetcher.mock.calls[2]?.[1]?.headers).get('If-Match')).toBe('"1"')
  })

  it('deletes all hosted account data through the authenticated API', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }))
    const api = setup(fetcher)
    await expect(api.deleteAccountData()).resolves.toBeUndefined()
    expect(fetcher).toHaveBeenCalledWith('https://api.example.test/v1/account/data', expect.objectContaining({ method: 'DELETE', credentials: 'omit', cache: 'no-store' }))
  })

  it('exports every authenticated hosted case and validates the records', async () => {
    const record = createCaseRecord(EMPTY_DRAFT)
    const exportedAt = '2026-09-24T00:00:00.000Z'
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ exportedAt, cases: [{ record, revision: 2 }] }), { status: 200 }))
    const api = setup(fetcher)
    await expect(api.exportAll()).resolves.toEqual({ exportedAt, cases: [{ record, revision: 2 }] })
    expect(fetcher).toHaveBeenCalledWith('https://api.example.test/v1/account/data/export', expect.objectContaining({ method: 'GET', credentials: 'omit', cache: 'no-store' }))
  })

  it('uses bearer auth, omits browser credentials, and checks ETag revisions', async () => {
    const record = createCaseRecord(EMPTY_DRAFT, new Date('2026-09-24T00:00:00.000Z'))
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ record, revision: 2 }), { status: 200, headers: { ETag: '"2"' } }))
    const api = setup(fetcher)

    await expect(api.replace(record, 1)).resolves.toEqual({ record, revision: 2 })
    expect(fetcher).toHaveBeenCalledWith(`https://api.example.test/v1/cases/${record.id}`, expect.objectContaining({ credentials: 'omit', cache: 'no-store', redirect: 'error', mode: 'cors', headers: expect.any(Headers) }))
    const init = fetcher.mock.calls[0]?.[1]
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer synthetic-access-token')
    expect(new Headers(init?.headers).get('If-Match')).toBe('"1"')
  })

  it('rejects a stale revision response as a typed API error', async () => {
    const api = setup(vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ error: 'revision_conflict_or_case_not_found' }), { status: 412 })))
    await expect(api.replace(createCaseRecord(EMPTY_DRAFT), 1)).rejects.toMatchObject(new CaseApiError(412, 'revision_conflict_or_case_not_found'))
  })

  it('refuses malformed server records and inconsistent ETags', async () => {
    const record = createCaseRecord(EMPTY_DRAFT)
    const malformed = setup(vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ record: { ...record, status: 'made_up' }, revision: 1 }), { status: 200, headers: { ETag: '"1"' } })))
    await expect(malformed.get(record.id)).rejects.toThrow('invalid case record')

    const inconsistent = setup(vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ record, revision: 1 }), { status: 200, headers: { ETag: '"2"' } })))
    await expect(inconsistent.get(record.id)).rejects.toThrow('inconsistent revision tag')
  })

  it('requires an access token and a secure API URL outside loopback development', async () => {
    const noToken = createCaseApi({ baseUrl: 'https://api.example.test', getAccessToken: () => null, fetcher: vi.fn() })
    await expect(noToken.list()).rejects.toThrow('access token is required')
    expect(() => createCaseApi({ baseUrl: 'http://api.example.test', getAccessToken: () => 'token' })).toThrow('must use HTTPS')
  })
})
