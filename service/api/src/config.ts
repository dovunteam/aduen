import { isIP } from 'node:net'
import { assertDatabaseTlsUrl } from './databaseTls.js'

export type ApiConfig = {
  host: string
  port: number
  databaseUrl: string
  databaseSsl: boolean
  issuer: string
  jwksUrl: string
  audience: string
  authMaxTokenAgeSeconds: number
  hostedCaseRetentionDays: number | null
  corsOrigins: string[]
  trustedProxies: string[]
  rateLimitHmacKey: string | null
  metricsBearerToken: string | null
  nodeEnv: string
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const nodeEnv = env.NODE_ENV ?? 'development'
  if (!['development', 'test', 'production'].includes(nodeEnv)) throw new Error('NODE_ENV must be development, test, or production.')
  const host = env.HOST?.trim() || '127.0.0.1'
  if (nodeEnv === 'production' && host !== '0.0.0.0') throw new Error('HOST=0.0.0.0 is required in production so the container can receive ingress traffic.')
  const databaseUrl = required(env.DATABASE_URL, 'DATABASE_URL')
  const issuer = required(env.AUTH_ISSUER, 'AUTH_ISSUER')
  const jwksUrl = required(env.AUTH_JWKS_URL, 'AUTH_JWKS_URL')
  const audience = required(env.AUTH_AUDIENCE, 'AUTH_AUDIENCE')
  const issuerUrl = parseHttpEndpoint(issuer, 'AUTH_ISSUER')
  const jwksEndpoint = parseHttpEndpoint(jwksUrl, 'AUTH_JWKS_URL')
  const authMaxTokenAgeSeconds = Number(env.AUTH_MAX_TOKEN_AGE_SECONDS ?? '3600')
  if (!Number.isInteger(authMaxTokenAgeSeconds) || authMaxTokenAgeSeconds < 60 || authMaxTokenAgeSeconds > 86_400) throw new Error('AUTH_MAX_TOKEN_AGE_SECONDS must be a whole number from 60 to 86400.')
  const hostedCaseRetentionValue = env.HOSTED_CASE_RETENTION_DAYS?.trim() ?? ''
  const hostedCaseRetentionDays = hostedCaseRetentionValue ? Number(hostedCaseRetentionValue) : null
  if (hostedCaseRetentionDays !== null && (!/^\d+$/u.test(hostedCaseRetentionValue) || !Number.isSafeInteger(hostedCaseRetentionDays) || hostedCaseRetentionDays < 1 || hostedCaseRetentionDays > 3650)) throw new Error('HOSTED_CASE_RETENTION_DAYS must be a whole number from 1 to 3650.')
  const corsOrigins = required(env.CORS_ORIGINS, 'CORS_ORIGINS').split(',').map((origin) => origin.trim()).filter(Boolean)
  if (corsOrigins.length === 0 || corsOrigins.some((origin) => !isOrigin(origin))) throw new Error('CORS_ORIGINS must be a comma-separated list of exact HTTP(S) origins.')
  if (nodeEnv === 'production' && corsOrigins.some((origin) => !origin.startsWith('https://'))) throw new Error('CORS_ORIGINS must use HTTPS in production.')
  if (env.DATABASE_SSL !== undefined && !['true', 'false'].includes(env.DATABASE_SSL)) throw new Error('DATABASE_SSL must be true or false.')
  const databaseSsl = env.DATABASE_SSL === 'true'
  assertDatabaseTlsUrl(databaseUrl, databaseSsl)

  if (nodeEnv === 'production' && !databaseSsl) throw new Error('DATABASE_SSL=true is required in production.')
  if (nodeEnv === 'production' && (issuerUrl.protocol !== 'https:' || jwksEndpoint.protocol !== 'https:')) {
    throw new Error('AUTH_ISSUER and AUTH_JWKS_URL must use HTTPS in production.')
  }
  if (nodeEnv === 'production' && hostedCaseRetentionDays === null) throw new Error('HOSTED_CASE_RETENTION_DAYS must be explicitly selected in production.')

  const port = Number(env.PORT ?? '8080')
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535.')

  const trustedProxies = (env.TRUSTED_PROXIES ?? '').split(',').map((value) => value.trim()).filter(Boolean)
  if (trustedProxies.some((value) => !isIpOrCidr(value))) throw new Error('TRUSTED_PROXIES must contain IP addresses or CIDR ranges.')
  if (nodeEnv === 'production' && trustedProxies.length === 0) throw new Error('TRUSTED_PROXIES must list the trusted TLS ingress addresses in production.')
  const rateLimitHmacKey = env.RATE_LIMIT_HMAC_KEY?.trim() || null
  if (rateLimitHmacKey && Buffer.byteLength(rateLimitHmacKey, 'utf8') < 32) throw new Error('RATE_LIMIT_HMAC_KEY must contain at least 32 UTF-8 bytes.')
  if (nodeEnv === 'production' && !rateLimitHmacKey) throw new Error('RATE_LIMIT_HMAC_KEY is required for shared production rate limiting.')
  const metricsBearerToken = env.METRICS_BEARER_TOKEN?.trim() || null
  if (metricsBearerToken && Buffer.byteLength(metricsBearerToken, 'utf8') < 32) throw new Error('METRICS_BEARER_TOKEN must contain at least 32 UTF-8 bytes.')
  if (nodeEnv === 'production' && !metricsBearerToken) throw new Error('METRICS_BEARER_TOKEN is required for protected production metrics.')

  return { host, port, databaseUrl, databaseSsl, issuer, jwksUrl, audience, authMaxTokenAgeSeconds, hostedCaseRetentionDays, corsOrigins: [...new Set(corsOrigins)], trustedProxies, rateLimitHmacKey, metricsBearerToken, nodeEnv }
}

function isIpOrCidr(value: string): boolean {
  const [address, prefix, ...rest] = value.split('/')
  if (rest.length || !address) return false
  const family = isIP(address)
  if (!family) return false
  if (prefix === undefined) return true
  if (!/^\d+$/u.test(prefix)) return false
  const bits = Number(prefix)
  return Number.isInteger(bits) && bits >= 0 && bits <= (family === 4 ? 32 : 128)
}

function isOrigin(value: string): boolean {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && url.origin === value && !url.username && !url.password }
  catch { return false }
}

function parseHttpEndpoint(value: string, name: string): URL {
  let url: URL
  try { url = new URL(value) } catch { throw new Error(`${name} must be an absolute HTTP(S) URL.`) }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password || url.hash) {
    throw new Error(`${name} must be an HTTP(S) URL without credentials or a fragment.`)
  }
  return url
}

function required(value: string | undefined, name: string): string {
  if (!value?.trim()) throw new Error(`${name} is required.`)
  return value.trim()
}
