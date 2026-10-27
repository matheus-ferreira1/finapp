import type { ReactNode } from 'react'
import type { Tip } from './useTip'

interface ChartFrameProps {
  width: number
  height: number
  /** Says what the chart shows, for people who cannot see it. */
  label: string
  tip: Tip | null
  /** Below this width (px) the chart scrolls sideways instead of shrinking its text. */
  minWidth?: number
  children: ReactNode
}

/**
 * Draws in fixed coordinates and scales with CSS, so it needs no size measuring. Marks inside are
 * focusable and carry their own labels, hence a labelled group rather than an image.
 */
export default function ChartFrame({ width, height, label, tip, minWidth, children }: ChartFrameProps) {
  const chart = (
    <div className="relative" style={minWidth ? { minWidth } : undefined}>
      <svg viewBox={`0 0 ${width} ${height}`} role="group" aria-label={label} className="h-auto w-full overflow-visible">
        {children}
      </svg>
      {tip && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-10 min-w-32 rounded-control bg-ink px-3 py-2 text-xs text-paper"
          style={{ left: `${Math.min(88, Math.max(12, (tip.x / width) * 100))}%`, top: `${(tip.y / height) * 100}%`, transform: 'translate(-50%, calc(-100% - 8px))' }}
        >
          <p className="mb-1 font-semibold">{tip.title}</p>
          {tip.lines.map((line) => (
            <p key={line.label} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5">
                {line.color && <span aria-hidden className="size-2 rounded-full" style={{ background: line.color }} />}
                {line.label}
              </span>
              <span className="font-medium">{line.value}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  )
  // room above the chart keeps tooltips from being clipped by the scroll container
  return minWidth ? <div className="-mt-12 overflow-x-auto pt-12">{chart}</div> : chart
}
