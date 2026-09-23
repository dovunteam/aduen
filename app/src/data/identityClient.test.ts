import { afterEach, describe, expect, it, vi } from 'vitest'
import { createUserManagerSettings, readIdentitySettings } from './identityClient'

const validSettings = {
  authority: 'https://identity.example.test/',
  clientId: 'aduen-browser',
  redirectUri: 'https://aduen.example.test/auth/callback',
  postLogoutRedirectUri: 'https://aduen.example.test/',
  scope: 'openid aduen-api',
}

afterEach(() => vi.unstubAllGlobals())

describe('OIDC identity client configuration', () => {
  it('leaves identity disabled until every setting is supplied', () => {
    expect(readIdentitySettings({}, 'https://aduen.example.test')).toBeNull()
    expect(() => readIdentitySettings({ authority: validSettings.authority }, 'https://aduen.example.test')).toThrow('incomplete')
  })

  it('requires HTTPS and same-origin redirects outside loopback development', () => {
    expect(readIdentitySettings(validSettings, 'https://aduen.example.test')).toEqual(validSettings)
    expect(() => readIdentitySettings({ ...validSettings, authority: 'http://identity.example.test' }, 'https://aduen.example.test')).toThrow('authority must use HTTPS')
    expect(() => readIdentitySettings(validSettings, 'http://aduen.example.test')).toThrow('Aduen must use HTTPS')
    expect(() => readIdentitySettings({ ...validSettings, redirectUri: 'https://attacker.example.test/callback' }, 'https://aduen.example.test')).toThrow('application origin')
    expect(() => readIdentitySettings({ ...validSettings, postLogoutRedirectUri: 'https://aduen.example.test/?next=https://attacker.example.test' }, 'https://aduen.example.test')).toThrow('query or fragment')
    expect(readIdentitySettings({ ...validSettings, authority: 'http://localhost:9000/', redirectUri: 'http://localhost:5173/auth/callback', postLogoutRedirectUri: 'http://localhost:5173/' }, 'http://localhost:5173')).not.toBeNull()
  })

  it('uses authorization code flow with tab-scoped session storage and no offline tokens', () => {
    const values = new Map<string, string>()
    const sessionStore = { get length() { return values.size }, clear: () => values.clear(), getItem: (key: string) => values.get(key) ?? null, key: (index: number) => [...values.keys()][index] ?? null, removeItem: (key: string) => values.delete(key), setItem: (key: string, value: string) => values.set(key, value) } as Storage
    vi.stubGlobal('window', { sessionStorage: sessionStore })
    const settings = createUserManagerSettings(validSettings)
    expect(settings.response_type).toBe('code')
    expect(settings.disablePKCE).toBe(false)
    expect(settings.automaticSilentRenew).toBe(false)
    expect(settings.monitorSession).toBe(false)
    expect(settings.loadUserInfo).toBe(false)
    expect(settings.userStore?.constructor.name).toBe('WebStorageStateStore')
    expect(() => readIdentitySettings({ ...validSettings, scope: 'openid offline_access' }, 'https://aduen.example.test')).toThrow('Offline access is disabled')
    expect(() => readIdentitySettings({ ...validSettings, scope: 'profile' }, 'https://aduen.example.test')).toThrow('contain openid')
  })
})
