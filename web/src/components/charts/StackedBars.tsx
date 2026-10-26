import { scaleBand, scaleLinear } from 'd3-scale'
import { categoryColor } from '../../lib/category-colors'
import type { MonthStack } from '../../lib/chart-data'
import ChartFrame from './ChartFrame'
import { useTip } from './useTip'
import { barPath, type Margin } from './geometry'
import MonthAxes from './MonthAxes'

const WIDTH = 720
const HEIGHT = 260
const MARGIN: Margin = { top: 12, right: 8, bottom: 28, left: 56 }
const GAP = 2

interface Props {
  stacks: MonthStack[]
  label: string
  format: (cents: number) => string
  formatTick: (cents: number) => string
  monthLabel: (month: number) => string
}

/** Spending per month, stacked by category in each category's own colour. */
export default function StackedBars({ stacks, label, format, formatTick, monthLabel }: Props) {
  const { tip, bind } = useTip()

  const x = scaleBand<number>().domain(stacks.map((s) => s.month)).range([MARGIN.left, WIDTH - MARGIN.right]).paddingInner(0.35).paddingOuter(0.2)
  const y = scaleLinear().domain([0, Math.max(1, ...stacks.map((s) => s.total))]).nice().range([HEIGHT - MARGIN.bottom, MARGIN.top])

  return (
    <ChartFrame width={WIDTH} height={HEIGHT} label={label} tip={tip}>
      <MonthAxes x={x} y={y} margin={MARGIN} width={WIDTH} height={HEIGHT} formatTick={formatTick} monthLabel={monthLabel} />
      {stacks.map((stack) => {
        const left = x(stack.month) ?? 0
        let filled = 0
        const hover = bind({
          x: left + x.bandwidth() / 2,
          y: y(stack.total),
          title: `${monthLabel(stack.month)}: ${format(stack.total)}`,
          lines: [...stack.segments].reverse().map((s) => ({ label: s.name, value: format(s.value), color: categoryColor(s.categoryId) })),
        })
        return (
          <g key={stack.month} aria-label={`${monthLabel(stack.month)}: ${format(stack.total)}`} {...hover}>
            <rect x={left - 4} y={MARGIN.top} width={x.bandwidth() + 8} height={HEIGHT - MARGIN.bottom - MARGIN.top} fill="transparent" />
            {stack.segments.map((segment, i) => {
              const top = y(filled + segment.value)
              const height = y(filled) - top - (i === 0 ? 0 : GAP)
              filled += segment.value
              const isTop = i === stack.segments.length - 1
              return <path key={segment.categoryId} d={barPath(left, top, x.bandwidth(), Math.max(0, height), isTop ? 4 : 0)} fill={categoryColor(segment.categoryId)} />
            })}
          </g>
        )
      })}
    </ChartFrame>
  )
}
