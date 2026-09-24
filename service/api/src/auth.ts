import { createRemoteJWKSet, customFetch, errors, jwtVerify } from 'jose'

export type Authenticate = ((authorization: string | undefined) => Promise<string>) & { checkProvider(): Promise<void> }
export type AuthOptions = { issuer: string; jwksUrl: string; audience: string; maxTokenAgeSeconds?: number }

export class AuthenticationUnavailable extends Error {
  constructor() { super('Authentication provider unavailable.'); this.name = 'AuthenticationUnavailable' }
}

class JwksTransportError extends Error {}

export function createAuthenticator(options: AuthOptions): Authenticate {
  const keySet = createRemoteJWKSet(new URL(options.jwksUrl), {
    timeoutDuration: 3_000,
    cooldownDuration: 30_000,
    cacheMaxAge: 600_000,
    [customFetch]: async (url, init) => {
      try { return await fetch(url, init) }
      catch (error) {
        if (error instanceof TypeError) throw new JwksTransportError()
        throw error
      }
    },
  })

  const authenticate = (async (authorization: string | undefined) => {
    const match = authorization?.match(/^Bearer ([A-Za-z0-9._~-]+)$/u)
    if (!match) throw new Error('unauthorized')

    try {
      const { payload } = await jwtVerify(match[1]!, keySet, {
        issuer: options.issuer,
        audience: options.audience,
        algorithms: ['RS256', 'ES256'],
        requiredClaims: ['iss', 'sub', 'aud', 'exp', 'iat'],
        maxTokenAge: options.maxTokenAgeSeconds ?? 3_600,
      })
      if (typeof payload.sub !== 'string' || !/^[\x21-\x7e]{1,255}$/u.test(payload.sub)) throw new Error('invalid subject')
      return payload.sub
    } catch (error) {
      if (isProviderUnavailable(error)) throw new AuthenticationUnavailable()
      throw new Error('unauthorized')
    }
  }) as Authenticate

  authenticate.checkProvider = async () => {
    try {
      if (!keySet.fresh) await keySet.reload()
      if (!keySet.jwks()?.keys.length) throw new Error('No signing keys are available.')
    } catch {
      throw new AuthenticationUnavailable()
    }
  }

  return authenticate
}

function isProviderUnavailable(error: unknown): boolean {
  if (error instanceof JwksTransportError || error instanceof errors.JWKSTimeout) return true
  return error instanceof errors.JOSEError && ['ERR_JOSE_GENERIC', 'ERR_JWKS_INVALID'].includes(error.code)
}
