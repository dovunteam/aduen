const METHOD_LABELS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])
const DURATION_BUCKETS_SECONDS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]

export type DatabasePoolMetrics = { total: number; idle: number; waiting: number }

type HttpObservation = {
  method: string
  route: string
  status: number
  count: number
  sumSeconds: number
  buckets: number[]
}

export class ApiMetrics {
  private readonly observations = new Map<string, HttpObservation>()

  observeHttp(method: string, route: string, status: number, durationMs: number): void {
    const safeMethod = METHOD_LABELS.has(method) ? method : 'OTHER'
    const safeRoute = /^\/[a-zA-Z0-9_./:{}-]{1,200}$/u.test(route) ? route : 'unmatched'
    const safeStatus = Number.isInteger(status) && status >= 100 && status <= 599 ? status : 0
    const durationSeconds = Number.isFinite(durationMs) && durationMs >= 0 ? durationMs / 1000 : 0
    const key = JSON.stringify([safeMethod, safeRoute, safeStatus])
    let observation = this.observations.get(key)
    if (!observation) {
      observation = { method: safeMethod, route: safeRoute, status: safeStatus, count: 0, sumSeconds: 0, buckets: Array(DURATION_BUCKETS_SECONDS.length).fill(0) as number[] }
      this.observations.set(key, observation)
    }
    observation.count += 1
    observation.sumSeconds += durationSeconds
    DURATION_BUCKETS_SECONDS.forEach((bound, index) => { if (durationSeconds <= bound) observation!.buckets[index]! += 1 })
  }

  render(databasePool?: DatabasePoolMetrics, uptimeSeconds = process.uptime()): string {
    const lines = [
      '# HELP aduen_http_requests_total HTTP responses by method, route template, and status.',
      '# TYPE aduen_http_requests_total counter',
    ]
    const observations = [...this.observations.values()].sort((a, b) => `${a.method}${a.route}${a.status}`.localeCompare(`${b.method}${b.route}${b.status}`))
    for (const observation of observations) {
      const labels = `method="${observation.method}",route="${escapeLabel(observation.route)}",status="${observation.status}"`
      lines.push(`aduen_http_requests_total{${labels}} ${observation.count}`)
    }

    lines.push('# HELP aduen_http_request_duration_seconds HTTP response duration in seconds.', '# TYPE aduen_http_request_duration_seconds histogram')
    for (const observation of observations) {
      const labels = `method="${observation.method}",route="${escapeLabel(observation.route)}",status="${observation.status}"`
      DURATION_BUCKETS_SECONDS.forEach((bound, index) => lines.push(`aduen_http_request_duration_seconds_bucket{${labels},le="${bound}"} ${observation.buckets[index]}`))
      lines.push(`aduen_http_request_duration_seconds_bucket{${labels},le="+Inf"} ${observation.count}`)
      lines.push(`aduen_http_request_duration_seconds_sum{${labels}} ${formatNumber(observation.sumSeconds)}`)
      lines.push(`aduen_http_request_duration_seconds_count{${labels}} ${observation.count}`)
    }

    lines.push('# HELP aduen_process_uptime_seconds API process uptime in seconds.', '# TYPE aduen_process_uptime_seconds gauge', `aduen_process_uptime_seconds ${formatNumber(uptimeSeconds)}`)
    if (databasePool) {
      lines.push('# HELP aduen_postgres_pool_connections PostgreSQL pool connections by state.', '# TYPE aduen_postgres_pool_connections gauge')
      for (const [state, count] of [['total', databasePool.total], ['idle', databasePool.idle], ['waiting', databasePool.waiting]] as const) {
        if (Number.isSafeInteger(count) && count >= 0) lines.push(`aduen_postgres_pool_connections{state="${state}"} ${count}`)
      }
    }
    return `${lines.join('\n')}\n`
  }
}

function escapeLabel(value: string): string { return value.replace(/\\/gu, '\\\\').replace(/\n/gu, '\\n').replace(/"/gu, '\\"') }
function formatNumber(value: number): string { return Number.isFinite(value) ? String(value) : '0' }
