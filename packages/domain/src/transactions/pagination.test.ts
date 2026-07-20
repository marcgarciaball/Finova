import { describe, expect, it } from 'vitest'
import { PAGE_SIZE, pageRange, parsePage, totalPages } from './pagination'

describe('parsePage', () => {
  it('defaults to 1 for missing/invalid values', () => {
    expect(parsePage(undefined)).toBe(1)
    expect(parsePage('')).toBe(1)
    expect(parsePage('abc')).toBe(1)
    expect(parsePage('0')).toBe(1)
    expect(parsePage('-3')).toBe(1)
    expect(parsePage('1.5')).toBe(1)
  })

  it('parses a valid 1-based page', () => {
    expect(parsePage('2')).toBe(2)
    expect(parsePage('42')).toBe(42)
  })

  it('takes the first value of an array param', () => {
    expect(parsePage(['3', '9'])).toBe(3)
  })
})

describe('pageRange', () => {
  it('maps 1-based pages to inclusive offsets', () => {
    expect(pageRange(1, 50)).toEqual({ from: 0, to: 49 })
    expect(pageRange(2, 50)).toEqual({ from: 50, to: 99 })
    expect(pageRange(3, 20)).toEqual({ from: 40, to: 59 })
  })

  it('uses PAGE_SIZE by default', () => {
    expect(pageRange(2)).toEqual({ from: PAGE_SIZE, to: 2 * PAGE_SIZE - 1 })
  })
})

describe('totalPages', () => {
  it('rounds up', () => {
    expect(totalPages(0, 50)).toBe(1)
    expect(totalPages(1, 50)).toBe(1)
    expect(totalPages(50, 50)).toBe(1)
    expect(totalPages(51, 50)).toBe(2)
    expect(totalPages(120, 50)).toBe(3)
  })

  it('never returns 0 (page 1 always exists)', () => {
    expect(totalPages(-5, 50)).toBe(1)
  })
})
