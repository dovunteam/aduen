import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const headersPath = join(root, 'dist', '_headers')
const apiBaseUrl = process.env.VITE_API_BASE_URL?.trim()
const oidcAuthority = process.env.VITE_OIDC_AUTHORITY?.trim()
const additionalOrigins = process.env.VITE_CSP_CONNECT_ORIGINS?.split(',').map((value) => value.trim()).filter(Boolean) ?? []

function originOf(value, label, originOnly = false) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${label} must be an absolute HTTPS URL.`)
  }
  if (url.protocol !== 'https:') throw new Error(`${label} must use HTTPS.`)
  if (url.username || url.password || url.search || url.hash || (originOnly && (url.pathname !== '/' || value !== url.origin))) {
    throw new Error(`${label} must be an origin without credentials, path, query, or fragment.`)
  }
  return url.origin
}

const origins = new Set()
if (apiBaseUrl) origins.add(originOf(apiBaseUrl, 'VITE_API_BASE_URL'))
if (oidcAuthority) origins.add(originOf(oidcAuthority, 'VITE_OIDC_AUTHORITY'))
for (const origin of additionalOrigins) origins.add(originOf(origin, 'VITE_CSP_CONNECT_ORIGINS entry', true))

const headers = await readFile(headersPath, 'utf8')
const policyLine = /^\s*Content-Security-Policy:\s*(.*)$/mu
if (!policyLine.test(headers)) throw new Error('The static hosting headers file must define Content-Security-Policy.')
const connectSource = ["'self'", ...origins].join(' ')
const updated = headers.replace(policyLine, (_line, policy) => {
  if (!/\bconnect-src\s+/u.test(policy)) throw new Error('The Content-Security-Policy must define connect-src.')
  return `  Content-Security-Policy: ${policy.replace(/connect-src\s+[^;]*/u, `connect-src ${connectSource}`)}`
})
await writeFile(headersPath, updated)
