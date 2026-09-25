import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const script = join(process.cwd(), 'scripts', 'score-pilot.mjs')
const header = 'caseId,packApproved,merchantDecisionOrValidHandoff,preparationMinutesBefore,preparationMinutesWithAduen,clarificationEventsBefore,clarificationEventsWithAduen,paymentEvidence,materialError,finalCountDecision,operatorMinutes,revenue,otherVariableCosts'

describe('pilot scorecard command', () => {
  it('calculates the gates and operator contribution from an anonymised CSV', () => {
    const directory = mkdtempSync(join(tmpdir(), 'aduen-scorecard-'))
    const path = join(directory, 'cases.csv')
    const rows = Array.from({ length: 10 }, (_, index) => `C${String(index + 1).padStart(2, '0')},Yes,${index < 5 ? 'Yes' : 'No'},60,40,2,1,${index < 3 ? 'Paid' : 'Not paid'},None,Include,30,200,10`)
    rows.push('C11,No,No,0,0,0,0,Not tested,None,Exclude,60,0,0')
    writeFileSync(path, `${header}\n${rows.join('\n')}\n`)
    try {
      const result = JSON.parse(execFileSync(process.execPath, [script, path, '--operator-rate=120'], { encoding: 'utf8' }))
      expect(result.startedCases).toBe(11)
      expect(result.includedCases).toBe(10)
      expect(result.excludedCases).toBe(1)
      expect(result.metrics.approvedPacks).toBe(10)
      expect(result.metrics.validHandoffs).toBe(5)
      expect(result.metrics.paidCases).toBe(3)
      expect(result.metrics.contribution).toBe(1180)
      expect(result.decision).toBe('Proceed')
    } finally { rmSync(directory, { recursive: true, force: true }) }
  })

  it('rejects duplicate IDs and invalid gate values', () => {
    const directory = mkdtempSync(join(tmpdir(), 'aduen-scorecard-'))
    const path = join(directory, 'cases.csv')
    writeFileSync(path, `${header}\nC01,Maybe,Yes,60,40,2,1,Paid,None,Include,30,200,10\nC01,Yes,Yes,60,40,2,1,Paid,None,Include,30,200,10\n`)
    try {
      expect(() => execFileSync(process.execPath, [script, path, '--operator-rate=120'], { encoding: 'utf8', stdio: 'pipe' })).toThrow(/duplicate caseId C01/)
    } finally { rmSync(directory, { recursive: true, force: true }) }
  })

  it('requires an explicit labour rate and complete variable-cost inputs before it can pass economics', () => {
    const directory = mkdtempSync(join(tmpdir(), 'aduen-scorecard-'))
    const path = join(directory, 'cases.csv')
    const rows = Array.from({ length: 10 }, (_, index) => `C${String(index + 1).padStart(2, '0')},Yes,Yes,60,40,2,1,Paid,None,Include,30,200,10`)
    writeFileSync(path, `${header}\n${rows.join('\n')}\n`)
    try {
      expect(() => execFileSync(process.execPath, [script, path], { encoding: 'utf8', stdio: 'pipe' })).toThrow(/Provide --operator-rate/)

      rows[0] = rows[0].replace(',10', ',')
      writeFileSync(path, `${header}\n${rows.join('\n')}\n`)
      expect(() => execFileSync(process.execPath, [script, path, '--operator-rate=120'], { encoding: 'utf8', stdio: 'pipe' })).toThrow(/otherVariableCosts must be a finite non-negative number/)
    } finally { rmSync(directory, { recursive: true, force: true }) }
  })
})
