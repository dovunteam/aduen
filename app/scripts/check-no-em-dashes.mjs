import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const files = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean)
const emDash = String.fromCodePoint(0x2014)
const violations = []

for (const file of files) {
  const path = join(root, file)
  if (!existsSync(path)) continue

  const bytes = readFileSync(path)
  if (bytes.includes(0)) continue

  const content = bytes.toString('utf8')
  const lines = content.split(/\r?\n/)
  lines.forEach((line, index) => {
    if (line.includes(emDash)) violations.push(`${file}:${index + 1}`)
  })
}

if (violations.length > 0) {
  console.error(`Em dash found in ${violations.length} tracked line${violations.length === 1 ? '' : 's'}:`)
  violations.forEach((violation) => console.error(`- ${violation}`))
  process.exit(1)
}

console.log(`Checked ${files.length} tracked files: no em dashes found.`)
