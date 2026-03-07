import { CaseApiError } from './caseApi'
import type { createCaseApi } from './caseApi'
import type { CaseRecord } from '../domain/case'

export type HostedCaseApi = Pick<ReturnType<typeof createCaseApi>, 'get' | 'create' | 'replace'>

export async function saveHostedCase(api: HostedCaseApi, record: CaseRecord): Promise<void> {
  try {
    const current = await api.get(record.id)
    await api.replace(record, current.revision)
  } catch (error) {
    if (error instanceof CaseApiError && error.status === 404) {
      await api.create(record)
      return
    }
    throw error
  }
}
