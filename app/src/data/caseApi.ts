import type { CaseRecord } from '../domain/case'
import { isValidCaseRecord } from './caseRepository'

export type StoredCase = { record: CaseRecord; revision: number }
export type CasePage = { cases: StoredCase[]; nextCursor: string | null }
export type CaseApiOptions = { baseUrl: string; getAccessToken: () => string | null | Promise<string | null>; fetcher?: typeof fetch }

export class CaseApiError extends Error {
  readonly status: number
  readonly code: string
  constructor(status: number, code: string) { super(`Case API request failed: ${code}`); this.name = 'CaseApiError'; this.status = status; this.code = code }
}

export function createCaseApi(options: CaseApiOptions) {
  const baseUrl = validateBaseUrl(options.baseUrl)
  const fetcher = options.fetcher ?? fetch

  return {
    list(limit = 50, cursor?: string): Promise<CasePage> {
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Case page limit must be between 1 and 100.')
      const query = new URLSearchParams({ limit: String(limit) })
      if (cursor) query.set('cursor', cursor)
      return request(`/cases?${query}`, { method: 'GET' }).then(parseCasePage)
    },
    get(id: string): Promise<StoredCase> { return request(`/cases/${encodeURIComponent(id)}`, { method: 'GET' }).then(parseStoredCase) },
    create(record: CaseRecord): Promise<StoredCase> {
      return request('/cases', { method: 'POST', body: JSON.stringify(record) }).then((response) => parseStoredCase(response, record.id))
    },
    replace(record: CaseRecord, revision: number): Promise<StoredCase> {
      if (!Number.isSafeInteger(revision) || revision < 1) throw new Error('A valid case revision is required.')
      return request(`/cases/${encodeURIComponent(record.id)}`, { method: 'PUT', headers: { 'If-Match': `"${revision}"` }, body: JSON.stringify(record) }).then((response) => parseStoredCase(response, record.id))
    },
    async delete(id: string, revision: number): Promise<void> {
      if (!Number.isSafeInteger(revision) || revision < 1) throw new Error('A valid case revision is required.')
      await request(`/cases/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { 'If-Match': `"${revision}"` } })
    },
    async deleteAccountData(): Promise<void> { await request('/account/data', { method: 'DELETE' }) },
  }

  async function request(path: string, init: RequestInit): Promise<Response> {
    const token = await options.getAccessToken()
    if (!token || token !== token.trim() || /\s/u.test(token)) throw new Error('A valid access token is required.')
    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${token}`)
    if (init.body) headers.set('Content-Type', 'application/json')
    const response = await fetcher(`${baseUrl}/v1${path}`, { ...init, headers, credentials: 'omit', cache: 'no-store', redirect: 'error', mode: 'cors' })
    if (!response.ok) {
      let code = 'request_failed'
      try {
        const body: unknown = await response.json()
        if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string' && /^[a-z0-9_]{1,80}$/u.test(body.error)) code = body.error
      } catch { /* Keep the status-based error when the response is not JSON. */ }
      throw new CaseApiError(response.status, code)
    }
    return response
  }
}

function validateBaseUrl(value: string): string {
  let url: URL
  try { url = new URL(value) } catch { throw new Error('Case API URL must be an absolute HTTP(S) URL.') }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (!['http:', 'https:'].includes(url.protocol) || (url.protocol !== 'https:' && !loopback) || url.username || url.password || url.search || url.hash) {
    throw new Error('Case API URL must use HTTPS and cannot contain credentials, a query, or a fragment.')
  }
  return url.href.replace(/\/$/u, '')
}

async function parseCasePage(response: Response): Promise<CasePage> {
  const value: unknown = await response.json()
  if (!value || typeof value !== 'object' || !('cases' in value) || !Array.isArray(value.cases) || value.cases.length > 100 || !('nextCursor' in value) || !(value.nextCursor === null || (typeof value.nextCursor === 'string' && value.nextCursor.length <= 512))) throw new Error('Case API returned an invalid case page.')
  return { cases: value.cases.map((item) => validateStoredCase(item)), nextCursor: value.nextCursor }
}

async function parseStoredCase(response: Response, expectedId?: string): Promise<StoredCase> {
  const value: unknown = await response.json()
  const stored = validateStoredCase(value, expectedId)
  const etag = response.headers.get('ETag')
  if (etag !== `"${stored.revision}"`) throw new Error('Case API returned a missing or inconsistent revision tag.')
  return stored
}

function validateStoredCase(value: unknown, expectedId?: string): StoredCase {
  if (!value || typeof value !== 'object' || !('record' in value) || !('revision' in value) || !Number.isSafeInteger(value.revision) || (value.revision as number) < 1 || !isValidCaseRecord(value.record) || (expectedId !== undefined && value.record.id !== expectedId)) {
    throw new Error('Case API returned an invalid case record.')
  }
  return value as StoredCase
}
