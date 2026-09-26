// Grid geometry, snapping and hit-testing. Everything here runs inside gesture worklets on the UI thread,
// so each function is a self-contained worklet (no imports called inside; core's slotAt/dragRange are
// mirrored and parity-tested in math.test.ts).

/** Drag step in minutes (core SLOT_MIN). */
export const STEP = 15
/** Bottom strip of an event block that resizes instead of moving (px). */
export const HANDLE_PX = 14

export function pxOf(min: number, hourHeight: number): number {
  'worklet'
  return (min / 60) * hourHeight
}

export function minOf(px: number, hourHeight: number): number {
  'worklet'
  return (px / hourHeight) * 60
}

/** Pointer minute snapped to the nearest step (desktop drag.ts `snap`). */
export function snap(min: number): number {
  'worklet'
  return Math.round(min / STEP) * STEP
}

/** Minute floored to its slot and clamped to the day (core `slotAt`). */
export function slotOf(min: number): number {
  'worklet'
  return Math.min(1440 - STEP, Math.max(0, Math.floor(min / STEP) * STEP))
}

/** Slots `a`..`b` in either direction, both inclusive (core `dragRange`). */
export function spanOf(a: number, b: number): { start: number; end: number } {
  'worklet'
  return { start: Math.min(a, b), end: Math.max(a, b) + STEP }
}

/** `start..end` moved by `delta` minutes, kept whole and inside the day (desktop drag.ts). */
export function moveRange(start: number, end: number, delta: number): { start: number; end: number } {
  'worklet'
  const dur = end - start
  const s = Math.max(0, Math.min(start + snap(delta), 1440 - dur))
  return { start: s, end: s + dur }
}

/** New end when the bottom edge is dragged to `pointer`: at least one step long, at most midnight. */
export function resizeEnd(start: number, pointer: number): number {
  'worklet'
  return Math.max(start + STEP, Math.min(1440, snap(pointer)))
}

/** Day column under `x`, clamped to the page. */
export function dayAt(x: number, colW: number, days: number): number {
  'worklet'
  return Math.max(0, Math.min(days - 1, Math.floor(x / colW)))
}

/** Target day after dragging `dx` px from `day`. */
export function dayShift(day: number, dx: number, colW: number, days: number): number {
  'worklet'
  return Math.max(0, Math.min(days - 1, day + Math.round(dx / colW)))
}

/** A laid-out timed block of the current page, in page px (x from the first column, y from midnight). */
export interface Rect {
  /** Index into the page's placed events. */
  i: number
  day: number
  x: number
  y: number
  w: number
  h: number
  /** Minutes from midnight the block covers on its day. */
  start: number
  end: number
  /** Movable/resizable: editable calendar and starts+ends on this day. */
  drag: boolean
}

/** Topmost block under the point (later blocks are drawn above earlier ones), or -1. */
export function hitTest(rects: Rect[], x: number, y: number): number {
  'worklet'
  for (let k = rects.length - 1; k >= 0; k--) {
    const r = rects[k]
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return k
  }
  return -1
}

/** Where a page swipe settles, in whole pages relative to where it started: at most one page, flicks count. */
export function pageTarget(dx: number, vx: number, width: number): -1 | 0 | 1 {
  'worklet'
  const travel = dx + vx * 0.15
  if (travel < -width / 2) return 1
  if (travel > width / 2) return -1
  return 0
}

/** Scroll offset that opens the grid on a whole hour: now ~1/3 down when today is shown, else 08:00. */
export function initialScroll(showsToday: boolean, now: Date, viewportPx: number, hourHeight: number): number {
  const hours = viewportPx / hourHeight
  const top = showsToday ? Math.floor(now.getHours() + now.getMinutes() / 60 - hours / 3) : 8
  const max = pxOf(1440, hourHeight) - viewportPx
  return Math.max(0, Math.min(max, pxOf(Math.max(0, top) * 60, hourHeight) - 8))
}
