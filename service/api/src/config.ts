export type ApiConfig = {
  host: string
  port: number
  databaseUrl: string
  databaseSsl: boolean
  issuer: string
  jwksUrl: string
  audience: string
  corsOrigins: string[]
  nodeEnv: string
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const nodeEnv = env.NODE_ENV ?? 'development'
  if (!['development', 'test', 'production'].includes(nodeEnv)) throw new Error('NODE_ENV must be development, test, or production.')
  const databaseUrl = required(env.DATABASE_URL, 'DATABASE_URL')
  const issuer = required(env.AUTH_ISSUER, 'AUTH_ISSUER')
  const jwksUrl = required(env.AUTH_JWKS_URL, 'AUTH_JWKS_URL')
  const audience = required(env.AUTH_AUDIENCE, 'AUTH_AUDIENCE')
  const corsOrigins = required(env.CORS_ORIGINS, 'CORS_ORIGINS').split(',').map((origin) => origin.trim()).filter(Boolean)
  if (corsOrigins.length === 0 || corsOrigins.some((origin) => !isOrigin(origin))) throw new Error('CORS_ORIGINS must be a comma-separated list of exact HTTP(S) origins.')
  if (nodeEnv === 'production' && corsOrigins.some((origin) => !origin.startsWith('https://'))) throw new Error('CORS_ORIGINS must use HTTPS in production.')
  if (env.DATABASE_SSL !== undefined && !['true', 'false'].includes(env.DATABASE_SSL)) throw new Error('DATABASE_SSL must be true or false.')
  const databaseSsl = env.DATABASE_SSL === 'true'

  if (nodeEnv === 'production' && !databaseSsl) throw new Error('DATABASE_SSL=true is required in production.')
  if (nodeEnv === 'production' && (new URL(issuer).protocol !== 'https:' || new URL(jwksUrl).protocol !== 'https:')) {
    throw new Error('AUTH_ISSUER and AUTH_JWKS_URL must use HTTPS in production.')
  }
  if (nodeEnv !== 'production' && !['http:', 'https:'].includes(new URL(issuer).protocol)) throw new Error('AUTH_ISSUER must be an HTTP(S) URL.')
  if (nodeEnv !== 'production' && !['http:', 'https:'].includes(new URL(jwksUrl).protocol)) throw new Error('AUTH_JWKS_URL must be an HTTP(S) URL.')

  const port = Number(env.PORT ?? '8080')
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535.')

  return { host: env.HOST ?? '127.0.0.1', port, databaseUrl, databaseSsl, issuer, jwksUrl, audience, corsOrigins: [...new Set(corsOrigins)], nodeEnv }
}

function isOrigin(value: string): boolean {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && url.origin === value && !url.username && !url.password }
  catch { return false }
}

function required(value: string | undefined, name: string): string {
  if (!value?.trim()) throw new Error(`${name} is required.`)
  return value.trim()
}
