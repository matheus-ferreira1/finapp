import type { ScaleBand, ScaleLinear } from 'd3-scale'
import type { Margin } from './geometry'

/** Room one month name needs, in chart units. */
const MIN_LABEL_STEP = 36

interface Props {
  x: ScaleBand<number>
  y: ScaleLinear<number, number>
  margin: Margin
  width: number
  height: number
  formatTick: (value: number) => string
  monthLabel: (month: number) => string
}

/** Recessive grid, value labels on the left and a label for each month underneath. */
export default function MonthAxes({ x, y, margin, width, height, formatTick, monthLabel }: Props) {
  // narrow charts label every other month rather than letting the names run into each other
  const labelEvery = x.step() < MIN_LABEL_STEP ? 2 : 1
  return (
    <g fontSize="14" fill="var(--ink-muted)">
      {y.ticks(4).map((tick) => (
        <g key={tick}>
          <line x1={margin.left} x2={width - margin.right} y1={y(tick)} y2={y(tick)} stroke="var(--line)" />
          <text x={margin.left - 8} y={y(tick)} textAnchor="end" dominantBaseline="middle">
            {formatTick(tick)}
          </text>
        </g>
      ))}
      {x.domain().map((month, i) => i % labelEvery === 0 && (
        <text key={month} x={(x(month) ?? 0) + x.bandwidth() / 2} y={height - 8} textAnchor="middle">
          {monthLabel(month)}
        </text>
      ))}
    </g>
  )
}
