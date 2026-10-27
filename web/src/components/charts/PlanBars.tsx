import { scaleBand, scaleLinear } from 'd3-scale'
import type { PlanBar } from '../../lib/chart-data'
import ChartFrame from './ChartFrame'
import { useTip } from './useTip'
import { barPath, type Margin } from './geometry'
import { useHatch } from './HatchDefs'
import MonthAxes from './MonthAxes'

const WIDTH = 720
const HEIGHT = 240
const MARGIN: Margin = { top: 12, right: 8, bottom: 28, left: 68 }
const GAP = 2

interface Props {
  bars: PlanBar[]
  /** A CSS colour; solid for what is realized, hatched for what is still planned. */
  color: string
  label: string
  legend: { realized: string; pending: string }
  format: (cents: number) => string
  formatTick: (cents: number) => string
  monthLabel: (month: number) => string
}

/** Twelve months of one measure, each bar solid where realized and hatched where only planned. */
export default function PlanBars({ bars, color, label, legend, format, formatTick, monthLabel }: Props) {
  const { tip, bind } = useTip()
  const hatch = useHatch(color)

  const x = scaleBand<number>().domain(bars.map((b) => b.month)).range([MARGIN.left, WIDTH - MARGIN.right]).paddingInner(0.35).paddingOuter(0.2)
  const max = Math.max(1, ...bars.map((b) => b.realized + b.pending))
  const y = scaleLinear().domain([0, max]).nice().range([HEIGHT - MARGIN.bottom, MARGIN.top])
  const base = y(0)

  return (
    <figure>
      <ChartFrame width={WIDTH} height={HEIGHT} label={label} tip={tip}>
        <defs>{hatch.defs}</defs>
        <MonthAxes x={x} y={y} margin={MARGIN} width={WIDTH} height={HEIGHT} formatTick={formatTick} monthLabel={monthLabel} />
        {bars.map((bar) => {
          const left = x(bar.month) ?? 0
          const realizedTop = y(bar.realized)
          const pendingTop = y(bar.realized + bar.pending)
          const gap = bar.realized > 0 ? GAP : 0
          const pendingHeight = Math.max(0, realizedTop - gap - pendingTop)
          const total = bar.realized + bar.pending
          const hover = bind({
            x: left + x.bandwidth() / 2,
            y: pendingTop,
            title: monthLabel(bar.month),
            lines: [
              { label: legend.realized, value: format(bar.realized), color },
              { label: legend.pending, value: format(bar.pending), color },
            ],
          })
          return (
            <g key={bar.month} aria-label={`${monthLabel(bar.month)}: ${format(total)}`} {...hover}>
              {/* a wider invisible target than the thin bar */}
              <rect x={left - 4} y={MARGIN.top} width={x.bandwidth() + 8} height={base - MARGIN.top} fill="transparent" />
              {bar.realized > 0 && (
                <path d={barPath(left, realizedTop, x.bandwidth(), base - realizedTop, bar.pending > 0 ? 0 : 4)} fill={color} />
              )}
              {pendingHeight > 0 && <path d={barPath(left, pendingTop, x.bandwidth(), pendingHeight)} fill={hatch.fill} stroke={color} strokeWidth="1" />}
            </g>
          )
        })}
      </ChartFrame>
      <figcaption className="mt-2 flex gap-4 text-xs text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm" style={{ background: color }} />
          {legend.realized}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2.5 rounded-sm"
            style={{ border: `1px solid ${color}`, backgroundImage: `repeating-linear-gradient(135deg, ${color} 0 1px, transparent 1px 3px)` }}
          />
          {legend.pending}
        </span>
      </figcaption>
    </figure>
  )
}
