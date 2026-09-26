import { describe, expect, it } from 'vitest'
import { dragRange, slotAt } from '@mysticals/core/logic/layout'
import { dayAt, dayShift, hitTest, initialScroll, minOf, moveRange, pageTarget, pxOf, resizeEnd, slotOf, snap, spanOf, type Rect } from './math'

describe('timegrid math', () => {
  it('mirrors core slotAt / dragRange', () => {
    for (const m of [-30, 0, 7, 14, 15, 59, 600, 1430, 1439, 2000]) expect(slotOf(m)).toBe(slotAt(m))
    for (const [a, b] of [[60, 120], [120, 60], [0, 0], [1425, 30]]) expect(spanOf(a, b)).toEqual(dragRange(a, b))
  })

  it('converts px <-> minutes', () => {
    expect(pxOf(90, 56)).toBe(84)
    expect(minOf(84, 56)).toBe(90)
  })

  it('snaps moves to 15 minutes and keeps the event inside the day', () => {
    expect(snap(7)).toBe(0)
    expect(snap(8)).toBe(15)
    expect(moveRange(600, 660, 22)).toEqual({ start: 615, end: 675 })
    expect(moveRange(600, 660, -1000)).toEqual({ start: 0, end: 60 })
    expect(moveRange(1380, 1440, 60)).toEqual({ start: 1380, end: 1440 })
  })

  it('resizes to at least one step, at most midnight', () => {
    expect(resizeEnd(600, 590)).toBe(615)
    expect(resizeEnd(600, 700)).toBe(705)
    expect(resizeEnd(600, 2000)).toBe(1440)
  })

  it('finds the day column under a point and after a drag', () => {
    expect(dayAt(-5, 50, 7)).toBe(0)
    expect(dayAt(149, 50, 7)).toBe(2)
    expect(dayAt(999, 50, 7)).toBe(6)
    expect(dayShift(2, 30, 50, 7)).toBe(3)
    expect(dayShift(2, -24, 50, 7)).toBe(2)
    expect(dayShift(0, -500, 50, 7)).toBe(0)
  })

  it('hit-tests the topmost block', () => {
    const r = (i: number, x: number, y: number, w: number, h: number): Rect => ({ i, day: 0, x, y, w, h, start: 0, end: 60, drag: true })
    const rects = [r(0, 0, 0, 100, 100), r(1, 50, 50, 50, 50)]
    expect(hitTest(rects, 60, 60)).toBe(1)
    expect(hitTest(rects, 10, 10)).toBe(0)
    expect(hitTest(rects, 10, 120)).toBe(-1)
    expect(hitTest(rects, 100, 60)).toBe(-1) // right edge is exclusive
  })

  it('pages by at most one, counting flicks', () => {
    expect(pageTarget(-10, 0, 300)).toBe(0)
    expect(pageTarget(-160, 0, 300)).toBe(1)
    expect(pageTarget(40, 1200, 300)).toBe(-1)
    expect(pageTarget(-40, -2000, 300)).toBe(1)
  })

  it('opens on 08:00, or with now a third down when today is shown', () => {
    const at = (h: number, m = 0): Date => new Date(2026, 8, 26, h, m)
    expect(initialScroll(false, at(15), 560, 56)).toBe(8 * 56 - 8)
    // 10 visible hours: 15:30 - 3.33 -> 12:00
    expect(initialScroll(true, at(15, 30), 560, 56)).toBe(12 * 56 - 8)
    expect(initialScroll(true, at(1), 560, 56)).toBe(0)
    // late evening: clamped to the bottom
    expect(initialScroll(true, at(23, 50), 560, 56)).toBe(24 * 56 - 560)
  })
})
