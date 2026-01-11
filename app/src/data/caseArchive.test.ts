import { describe, expect, it } from 'vitest'
import { safeFileName } from './caseArchive'

describe('case archive', () => {
  it('prevents evidence names from creating unsafe archive paths', () => {
    expect(safeFileName('../receipt:final?.pdf')).toBe('._receipt_final_.pdf')
    expect(safeFileName('')).toBe('evidence-file')
  })
})
