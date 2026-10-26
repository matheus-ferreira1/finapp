import { scaleBand, scaleLinear } from 'd3-scale'
import { curveMonotoneX, line } from 'd3-shape'
import ChartFrame from './ChartFrame'
import { useTip } from './useTip'
import type { Margin } from './geometry'
import MonthAxes from './MonthAxes'

const WIDTH = 720
const HEIGHT = 200
const MARGIN: Margin = { top: 12, right: 8, bottom: 28, left: 56 }

interface Props {
  /** One value per month, January first. */
  values: number[]
  color: string
  label: string
  title: string
  format: (cents: number) => string
  formatTick: (cents: number) => string
  monthLabel: (month: number) => string
}

/** A single line over the year, such as what the partner owes at the end of each month. */
export default function BalanceLine({ values, color, label, title, format, formatTick, monthLabel }: Props) {
  const { tip, bind } = useTip()

  const months = values.map((_, i) => i + 1)
  const x = scaleBand<number>().domain(months).range([MARGIN.left, WIDTH - MARGIN.right]).paddingInner(0.35).paddingOuter(0.2)
  const y = scaleLinear()
    .domain([Math.min(0, ...values), Math.max(1, ...values)])
    .nice()
    .range([HEIGHT - MARGIN.bottom, MARGIN.top])
  const cx = (month: number) => (x(month) ?? 0) + x.bandwidth() / 2

  const path = line<number>()
    .x((_, i) => cx(i + 1))
    .y((v) => y(v))
    .curve(curveMonotoneX)(values)

  return (
    <ChartFrame width={WIDTH} height={HEIGHT} label={label} tip={tip}>
      <MonthAxes x={x} y={y} margin={MARGIN} width={WIDTH} height={HEIGHT} formatTick={formatTick} monthLabel={monthLabel} />
      {y.domain()[0] < 0 && <line x1={MARGIN.left} x2={WIDTH - MARGIN.right} y1={y(0)} y2={y(0)} stroke="var(--ink-muted)" />}
      <path d={path ?? ''} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {values.map((value, i) => (
        <g
          key={months[i]}
          aria-label={`${monthLabel(months[i])}: ${format(value)}`}
          {...bind({ x: cx(months[i]), y: y(value), title: monthLabel(months[i]), lines: [{ label: title, value: format(value), color }] })}
        >
          <circle cx={cx(months[i])} cy={y(value)} r="12" fill="transparent" />
          <circle cx={cx(months[i])} cy={y(value)} r="4" fill={color} stroke="var(--surface)" strokeWidth="2" />
        </g>
      ))}
    </ChartFrame>
  )
}
