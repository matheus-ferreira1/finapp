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
