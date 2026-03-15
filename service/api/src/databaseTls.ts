const TLS_CONNECTION_PARAMETERS = new Set([
  'ssl',
  'sslmode',
  'sslcert',
  'sslkey',
  'sslrootcert',
  'sslnegotiation',
  'uselibpqcompat',
])

export function assertDatabaseTlsUrl(url: string, tlsEnabled: boolean): void {
  if (!tlsEnabled) return

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('Database URL must be a valid PostgreSQL URL when TLS is enabled.')
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) throw new Error('Database URL must use PostgreSQL when TLS is enabled.')
  if ([...parsed.searchParams.keys()].some((parameter) => TLS_CONNECTION_PARAMETERS.has(parameter))) {
    throw new Error('Database URL must not contain TLS parameters when DATABASE_SSL=true; configure TLS with DATABASE_SSL instead.')
  }
}
