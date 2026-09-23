import { readFile } from 'node:fs/promises'

const [, , inputPath, ...options] = process.argv
if (!inputPath) {
  console.error('Usage: npm run score:pilot -- <anonymised-case-log.csv> [--operator-rate=RM/hour] [--institution-commitment=yes]')
  process.exit(1)
}

const rateOptionIndex = options.findIndex((value) => value === '--operator-rate' || value.startsWith('--operator-rate='))
const rateOption = rateOptionIndex < 0 ? '' : options[rateOptionIndex].includes('=') ? options[rateOptionIndex].split('=')[1] : options[rateOptionIndex + 1]
const operatorRate = Number(rateOption ?? '')
const institutionCommitment = options.some((value, index) => value === '--institution-commitment=yes' || (value === '--institution-commitment' && options[index + 1] === 'yes'))
const source = await readFile(inputPath, 'utf8')
const rows = parseCsv(source)
const required = ['caseId', 'packApproved', 'merchantDecisionOrValidHandoff', 'preparationMinutesBefore', 'preparationMinutesWithAduen', 'clarificationEventsBefore', 'clarificationEventsWithAduen', 'paymentEvidence', 'materialError', 'finalCountDecision', 'operatorMinutes', 'revenue']
const missing = required.filter((field) => !rows.headers.includes(field))
if (missing.length) fail(`Missing CSV columns: ${missing.join(', ')}`)
const cases = rows.records.map((record, index) => ({ ...record, row: index + 2 }))
const included = cases.filter((record) => record.finalCountDecision.trim().toLowerCase() === 'include')
const count = included.length
const approvedPacks = countWhere(included, 'packApproved', 'yes')
const validHandoffs = countWhere(included, 'merchantDecisionOrValidHandoff', 'yes')
const paidCases = countWhere(included, 'paymentEvidence', 'paid')
const materialErrors = included.filter((record) => record.materialError.trim().toLowerCase() !== 'none')
const reducedPreparation = included.filter((record) => isStrictReduction(record.preparationMinutesBefore, record.preparationMinutesWithAduen) || isStrictReduction(record.clarificationEventsBefore, record.clarificationEventsWithAduen)).length
const numericOperatorMinutes = included.map((record) => Number(record.operatorMinutes))
const numericRevenue = included.map((record) => Number(record.revenue))
const economicsComplete = numericOperatorMinutes.every(Number.isFinite) && numericRevenue.every(Number.isFinite) && Number.isFinite(operatorRate) && operatorRate >= 0
const contribution = economicsComplete ? numericRevenue.reduce((sum, value) => sum + value, 0) - numericOperatorMinutes.reduce((sum, value) => sum + value, 0) / 60 * operatorRate : null

const gates = [
  gate('Approved packs', count === 10 && approvedPacks >= 7, ` ${approvedPacks}/${count}`),
  gate('Merchant decisions or valid handoffs', count === 10 && validHandoffs >= 5, ` ${validHandoffs}/${count}`),
  gate('Preparation or clarification reduction', count === 10 && reducedPreparation > 0, ` ${reducedPreparation}/${count} cases show a reduction`),
  gate('Real payment evidence', count === 10 && (paidCases >= 3 || institutionCommitment), institutionCommitment ? ' institutional commitment recorded' : ` ${paidCases} paid cases`),
  gate('Material routing or factual errors', count === 10 && materialErrors.length === 0, materialErrors.length ? ` ${materialErrors.length} error cases` : ' zero error cases'),
  gate('Positive contribution after operator labour', contribution !== null && contribution > 0, contribution === null ? ' inconclusive: provide all revenue, operator minutes, and --operator-rate' : ` RM${contribution.toFixed(2)}`),
]

console.log(JSON.stringify({ inputPath, startedCases: cases.length, includedCases: count, excludedCases: cases.length - count, metrics: { approvedPacks, validHandoffs, reducedPreparation, paidCases, materialErrors: materialErrors.map((record) => record.caseId), operatorRate: Number.isFinite(operatorRate) ? operatorRate : null, contribution }, gates, decision: gates.every((item) => item.result === 'Pass') ? 'Proceed' : 'Revise and retest' }, null, 2))

function parseCsv(value) {
  const records = []
  let row = []; let cell = ''; let quoted = false
  const rows = []
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]
    if (character === '"') {
      if (quoted && value[index + 1] === '"') { cell += '"'; index += 1 } else quoted = !quoted
    } else if (character === ',' && !quoted) { row.push(cell); cell = ''
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && value[index + 1] === '\n') index += 1
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += character
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  const headers = rows.shift()?.map((header) => header.trim()) ?? []
  for (const values of rows.filter((items) => items.some((item) => item.trim()))) records.push(Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ''])))
  return { headers, records }
}

function countWhere(records, field, expected) { return records.filter((record) => record[field].trim().toLowerCase() === expected).length }
function isStrictReduction(before, after) { const first = Number(before); const second = Number(after); return Number.isFinite(first) && Number.isFinite(second) && second < first }
function gate(name, passed, detail) { return { name, result: passed ? 'Pass' : 'Fail', detail: detail.trim() } }
function fail(message) { console.error(message); process.exit(1) }
