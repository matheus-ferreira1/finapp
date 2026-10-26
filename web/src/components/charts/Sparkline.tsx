import { line } from 'd3-shape'

const WIDTH = 96
const HEIGHT = 28
const PAD = 3

interface Props {
  values: number[]
  color: string
  /** Says what the trend is, for people who cannot see it. */
  label: string
}

/** A tiny trend line with no axes, to sit beside a figure. */
export default function Sparkline({ values, color, label }: Props) {
  const min = Math.min(0, ...values)
  const max = Math.max(1, ...values)
  const step = values.length > 1 ? (WIDTH - 2 * PAD) / (values.length - 1) : 0
  const y = (v: number) => HEIGHT - PAD - ((v - min) / (max - min)) * (HEIGHT - 2 * PAD)
  const path = line<number>().x((_, i) => PAD + i * step).y(y)(values)
  const last = values.length - 1

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={label} className="h-7 w-24">
      <path d={path ?? ''} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {last >= 0 && <circle cx={PAD + last * step} cy={y(values[last])} r="3" fill={color} />}
    </svg>
  )
}
