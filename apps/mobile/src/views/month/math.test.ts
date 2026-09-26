import { describe, expect, it } from 'vitest'
import { CELL, cellAt, chipRows, fitChips, fromMonthIndex, hitInCell, monthIndex, shiftDays, snapPage } from './math'

describe('month math', () => {
  it('month index round-trips across years', () => {
    expect(fromMonthIndex(monthIndex(new Date(2026, 0, 15)) - 1)).toEqual(new Date(2025, 11, 1))
    expect(fromMonthIndex(monthIndex(new Date(2026, 11, 3)) + 1)).toEqual(new Date(2027, 0, 1))
  })

  it('hit-tests cells of the 7x6 grid', () => {
    expect(cellAt(0, 0, 700, 600)).toBe(0)
    expect(cellAt(699, 599, 700, 600)).toBe(41)
    expect(cellAt(150, 250, 700, 600)).toBe(2 * 7 + 1)
    expect(cellAt(-1, 10, 700, 600)).toBe(-1)
    expect(cellAt(10, 600, 700, 600)).toBe(-1)
  })

  it('fits chips to the cell height and turns the last row into "+N"', () => {
    const h = CELL.pad * 2 + CELL.num + 3 * CELL.chip + 2 * CELL.gap
    expect(chipRows(h)).toBe(3)
    expect(chipRows(h - 1)).toBe(2)
    expect(fitChips(3, 3)).toEqual({ shown: 3, more: 0 })
    expect(fitChips(5, 3)).toEqual({ shown: 2, more: 3 })
    expect(fitChips(2, 0)).toEqual({ shown: 0, more: 2 })
  })

  it('finds the chip, the "+N" row or empty space inside a cell', () => {
    const row = (i: number): number => CELL.pad + CELL.num + i * (CELL.chip + CELL.gap) + 2
    expect(hitInCell(5, 2, 3)).toEqual({ kind: 'cell' })
    expect(hitInCell(row(0), 2, 3)).toEqual({ kind: 'chip', index: 0 })
    expect(hitInCell(row(1), 2, 3)).toEqual({ kind: 'chip', index: 1 })
    expect(hitInCell(row(2), 2, 3)).toEqual({ kind: 'more' })
    expect(hitInCell(row(2), 2, 0)).toEqual({ kind: 'cell' })
  })

  it('snaps pages on distance or flick velocity', () => {
    expect(snapPage(-10, -50, 390)).toBe(0)
    expect(snapPage(-140, 0, 390)).toBe(1)
    expect(snapPage(140, 0, 390)).toBe(-1)
    expect(snapPage(-30, -900, 390)).toBe(1)
    // flicking back against the drag direction cancels
    expect(snapPage(-60, 900, 390)).toBe(0)
  })

  it('shifts events by whole days keeping duration', () => {
    expect(shiftDays({ start: '2026-09-10', end: '2026-09-12', allDay: true }, 3)).toEqual({ start: '2026-09-13', end: '2026-09-15' })
    const s = new Date(2026, 8, 10, 9, 30)
    const e = new Date(2026, 8, 10, 11)
    const r = shiftDays({ start: s.toISOString(), end: e.toISOString(), allDay: false }, -2)
    expect(new Date(r.start)).toEqual(new Date(2026, 8, 8, 9, 30))
    expect(+new Date(r.end) - +new Date(r.start)).toBe(+e - +s)
  })
})
