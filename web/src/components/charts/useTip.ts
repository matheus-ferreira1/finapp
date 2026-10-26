import { useState } from 'react'

export interface Tip {
  /** Anchor in the chart's own coordinates. */
  x: number
  y: number
  title: string
  lines: { label: string; value: string; color?: string }[]
}

/** Shows a tooltip for the mark under the pointer or holding keyboard focus. */
export function useTip() {
  const [tip, setTip] = useState<Tip | null>(null)
  return {
    tip,
    clear: () => setTip(null),
    /** Props that make a mark show `next` on hover and focus; focusable so the keyboard reaches it. */
    bind: (next: Tip) => ({
      tabIndex: 0,
      onMouseEnter: () => setTip(next),
      onFocus: () => setTip(next),
      onMouseLeave: () => setTip(null),
      onBlur: () => setTip(null),
    }),
  }
}
