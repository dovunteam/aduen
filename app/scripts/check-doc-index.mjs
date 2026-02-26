import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const repositoryRoot = resolve(appRoot, '..')
const indexPath = join(repositoryRoot, 'docs', '00_PRODUCT_INDEX.md')
const source = readFileSync(indexPath, 'utf8')
const entries = [...source.matchAll(/^(\d+)\. \[[^\]]+\]\(([^)]+)\)/gm)].map((match) => ({ number: Number(match[1]), target: match[2] }))
const errors = []
const numbers = new Set()

for (const entry of entries) {
  if (numbers.has(entry.number)) errors.push(`duplicate index number: ${entry.number}`)
  numbers.add(entry.number)
  if (!existsSync(resolve(dirname(indexPath), entry.target))) errors.push(`missing index target: ${entry.target}`)
}

const expectedNumbers = Array.from({ length: entries.length }, (_, index) => index + 1)
if (entries.map((entry) => entry.number).join(',') !== expectedNumbers.join(',')) errors.push('index numbers must be consecutive starting at 1')

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join('\n'))
  process.exit(1)
}

console.log(`Checked ${entries.length} product-index entries and linked files.`)
