/** A rectangle path whose top corners are rounded, so a bar is anchored flat to its baseline. */
export function barPath(x: number, y: number, w: number, h: number, r = 4): string {
  const radius = Math.max(0, Math.min(r, w / 2, h))
  return [
    `M${x},${y + h}`,
    `V${y + radius}`,
    `Q${x},${y} ${x + radius},${y}`,
    `H${x + w - radius}`,
    `Q${x + w},${y} ${x + w},${y + radius}`,
    `V${y + h}`,
    'Z',
  ].join(' ')
}

/** The space left around a plot for the axes. */
export interface Margin {
  top: number
  right: number
  bottom: number
  left: number
}

/**
 * Vertical positions for labels that want to sit at `centers` (ascending) but need `gap` between
 * neighbours. Crowded labels are pushed down, and if that runs past `max` the stack is pulled back up.
 */
export function spreadLabels(centers: number[], gap: number, min: number, max: number): number[] {
  const pos: number[] = []
  centers.forEach((center, i) => {
    pos.push(Math.max(center, i === 0 ? min : pos[i - 1] + gap))
  })
  for (let i = pos.length - 1; i >= 0; i--) {
    const limit = i === pos.length - 1 ? max : pos[i + 1] - gap
    pos[i] = Math.min(pos[i], limit)
  }
  return pos
}
