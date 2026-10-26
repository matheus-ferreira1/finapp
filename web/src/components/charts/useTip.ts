import { useState } from 'react'

export interface Tip {
  /** Anchor in the chart's own coordinates. */
  x: number
  y: number
  title: string
  lines: { label: string; value: string; color?: string }[]
}

/**
 * Shows a tooltip for the mark under the pointer or holding keyboard focus. Hover and focus are
 * tracked apart, so leaving a hovered mark does not hide the tip of the focused one, and Escape
 * dismisses it.
 */
export function useTip() {
  const [hovered, setHovered] = useState<Tip | null>(null)
  const [focused, setFocused] = useState<Tip | null>(null)
  return {
    tip: hovered ?? focused,
    /** Props that make a mark show `next` on hover and focus; focusable so the keyboard reaches it. */
    bind: (next: Tip) => ({
      role: 'img' as const,
      tabIndex: 0,
      onMouseEnter: () => setHovered(next),
      onMouseLeave: () => setHovered(null),
      onFocus: () => setFocused(next),
      onBlur: () => setFocused(null),
      onKeyDown: (e: { key: string }) => {
        if (e.key !== 'Escape') return
        setHovered(null)
        setFocused(null)
      },
    }),
  }
}
