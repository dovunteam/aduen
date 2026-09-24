import { UserManager, WebStorageStateStore } from 'oidc-client-ts'
import type { User, UserManagerSettings } from 'oidc-client-ts'

export type IdentitySettings = {
  authority: string
  clientId: string
  redirectUri: string
  postLogoutRedirectUri: string
  scope: string
}

export type IdentityConfigInput = Partial<IdentitySettings>

export function identitySettingsFromEnvironment(appOrigin = window.location.origin): IdentitySettings | null {
  return readIdentitySettings({
    authority: import.meta.env.VITE_OIDC_AUTHORITY,
    clientId: import.meta.env.VITE_OIDC_CLIENT_ID,
    redirectUri: import.meta.env.VITE_OIDC_REDIRECT_URI,
    postLogoutRedirectUri: import.meta.env.VITE_OIDC_POST_LOGOUT_REDIRECT_URI,
    scope: import.meta.env.VITE_OIDC_SCOPE,
  }, appOrigin)
}

export function readIdentitySettings(input: IdentityConfigInput, appOrigin: string): IdentitySettings | null {
  const values = [input.authority, input.clientId, input.redirectUri, input.postLogoutRedirectUri, input.scope]
  if (values.every((value) => value === undefined || value === '')) return null
  if (values.some((value) => typeof value !== 'string' || !value.trim())) throw new Error('Identity configuration is incomplete.')

  const authority = parseHttpUrl(input.authority!, 'OIDC authority')
  const origin = parseHttpUrl(appOrigin, 'Application origin')
  if (origin.protocol !== 'https:' && !isLoopback(origin.hostname)) throw new Error('Aduen must use HTTPS outside local development.')
  if (authority.protocol !== 'https:' && !isLoopback(authority.hostname)) throw new Error('OIDC authority must use HTTPS outside local development.')
  if (authority.search || authority.hash) throw new Error('OIDC authority cannot include a query or fragment.')

  const redirectUri = parseHttpUrl(input.redirectUri!, 'OIDC redirect URI')
  const postLogoutRedirectUri = parseHttpUrl(input.postLogoutRedirectUri!, 'OIDC post-logout redirect URI')
  if (redirectUri.origin !== origin.origin || postLogoutRedirectUri.origin !== origin.origin) throw new Error('OIDC redirects must remain on the application origin.')
  if (redirectUri.hash || redirectUri.search || postLogoutRedirectUri.hash || postLogoutRedirectUri.search) throw new Error('OIDC redirects cannot include a query or fragment.')

  const clientId = input.clientId!
  if (clientId.length > 200 || Array.from(clientId).some((character) => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127)) throw new Error('OIDC client ID is invalid.')
  const scope = input.scope!
  const scopes = scope.split(' ')
  if (scope.length > 500 || scopes.some((value) => !value || !/^[\x21\x23-\x5b\x5d-\x7e]+$/u.test(value)) || new Set(scopes).size !== scopes.length || !scopes.includes('openid')) throw new Error('OIDC scope must contain openid and valid unique scope names.')
  if (scopes.includes('offline_access')) throw new Error('Offline access is disabled until account recovery and token revocation controls are reviewed.')

  return { authority: authority.href, clientId, redirectUri: redirectUri.href, postLogoutRedirectUri: postLogoutRedirectUri.href, scope }
}

export function createIdentityClient(settings: IdentitySettings) {
  validateIdentitySettings(settings)
  const manager = new UserManager(createUserManagerSettings(settings))
  return {
    async getAccessToken(): Promise<string | null> {
      const user = await manager.getUser()
      if (!user) return null
      if (user.expired || !user.access_token) {
        await manager.removeUser()
        return null
      }
      return user.access_token
    },
    beginSignIn(): Promise<void> { return manager.signinRedirect() },
    completeSignIn(): Promise<User> { return manager.signinRedirectCallback() },
    beginSignOut(): Promise<void> { return manager.signoutRedirect() },
  }
}

export function createUserManagerSettings(settings: IdentitySettings): UserManagerSettings {
  validateIdentitySettings(settings)
  const tabStore = new WebStorageStateStore({ store: window.sessionStorage })
  return {
    authority: settings.authority,
    client_id: settings.clientId,
    redirect_uri: settings.redirectUri,
    post_logout_redirect_uri: settings.postLogoutRedirectUri,
    response_type: 'code',
    disablePKCE: false,
    scope: settings.scope,
    userStore: tabStore,
    stateStore: tabStore,
    automaticSilentRenew: false,
    monitorSession: false,
    loadUserInfo: false,
    filterProtocolClaims: true,
  }
}

function validateIdentitySettings(settings: IdentitySettings): void {
  if (!settings.authority || !settings.clientId || !settings.redirectUri || !settings.postLogoutRedirectUri || !settings.scope) throw new Error('Identity configuration is incomplete.')
  const redirect = parseHttpUrl(settings.redirectUri, 'OIDC redirect URI')
  const safe = readIdentitySettings(settings, redirect.origin)
  if (!safe) throw new Error('Identity configuration is incomplete.')
}

function parseHttpUrl(value: string, label: string): URL {
  let url: URL
  try { url = new URL(value) } catch { throw new Error(`${label} must be an absolute HTTP(S) URL.`) }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error(`${label} must be an HTTP(S) URL without credentials.`)
  return url
}

function isLoopback(hostname: string): boolean {
  return ['localhost', '127.0.0.1', '[::1]'].includes(hostname)
}
