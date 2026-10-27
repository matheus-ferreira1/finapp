import { describe, expect, it } from 'vitest'
import { barPath, spreadLabels } from './geometry'

describe('spreadLabels', () => {
  it('leaves labels that already have room where they are', () => {
    expect(spreadLabels([10, 60, 120], 30, 0, 200)).toEqual([10, 60, 120])
  })

  it('pushes crowded labels apart, keeping their order', () => {
    const spread = spreadLabels([100, 102, 104], 30, 0, 400)
    expect(spread).toEqual([100, 130, 160])
  })

  it('pulls a stack that would run past the bottom back up', () => {
    const spread = spreadLabels([180, 190, 199], 30, 0, 200)
    expect(spread[2]).toBe(200)
    expect(spread[1]).toBe(170)
    expect(spread[0]).toBe(140)
  })

  it('never goes above the top', () => {
    expect(Math.min(...spreadLabels([0, 1, 2], 30, 10, 400))).toBeGreaterThanOrEqual(10)
  })

  it('handles no labels and one label', () => {
    expect(spreadLabels([], 30, 0, 100)).toEqual([])
    expect(spreadLabels([50], 30, 0, 100)).toEqual([50])
  })
})

describe('barPath', () => {
  it('starts at the bottom-left corner of the bar', () => {
    expect(barPath(10, 20, 30, 40)).toMatch(/^M10,60 /)
  })
})
