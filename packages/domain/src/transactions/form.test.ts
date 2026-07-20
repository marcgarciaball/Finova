import { describe, expect, it } from 'vitest'
import { composeSignedAmount, parseTagsInput } from './form'

describe('composeSignedAmount', () => {
  it('leaves income positive', () => {
    expect(composeSignedAmount('income', '50')).toBe('50')
  })

  it('negates an expense', () => {
    expect(composeSignedAmount('expense', '50')).toBe('-50')
  })

  it('strips an existing sign before applying direction', () => {
    expect(composeSignedAmount('expense', '-50')).toBe('-50')
    expect(composeSignedAmount('income', '-50')).toBe('50')
    expect(composeSignedAmount('expense', '+50')).toBe('-50')
  })

  it('trims surrounding whitespace', () => {
    expect(composeSignedAmount('income', '  12.34 ')).toBe('12.34')
  })

  it('returns empty for empty/whitespace/null so the schema rejects it', () => {
    expect(composeSignedAmount('income', '')).toBe('')
    expect(composeSignedAmount('income', '   ')).toBe('')
    expect(composeSignedAmount('income', null)).toBe('')
  })
})

describe('parseTagsInput', () => {
  it('splits, trims, and drops empties', () => {
    expect(parseTagsInput('a, b ,  , c')).toEqual(['a', 'b', 'c'])
  })

  it('returns [] for empty or non-string input', () => {
    expect(parseTagsInput('')).toEqual([])
    expect(parseTagsInput(null)).toEqual([])
    expect(parseTagsInput('   ')).toEqual([])
  })

  it('keeps a single tag', () => {
    expect(parseTagsInput('groceries')).toEqual(['groceries'])
  })
})
