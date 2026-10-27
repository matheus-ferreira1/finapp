import { useMemo } from 'react'
import { sankey, sankeyLeft, sankeyLinkHorizontal } from 'd3-sankey'
import type { Flow, FlowNode } from '../../lib/chart-data'
import { categoryColor } from '../../lib/category-colors'
import ChartFrame from './ChartFrame'
import { spreadLabels } from './geometry'
import { useTip } from './useTip'

const WIDTH = 720
/** Narrower screens scroll the chart sideways rather than shrink its labels. */
const MIN_WIDTH = 560
const LABEL_SPACE = 150
const NODE_WIDTH = 12
const EMPTY_HEIGHT = 120
/** Two lines of text need this much room. */
const LABEL_GAP = 32

type Kind = 'partner' | 'overspent' | 'leftover' | 'uncategorized'

interface Props {
  flow: Flow
  label: string
  /** Names for the nodes that are not a category. */
  kindLabels: Record<Kind, string>
  format: (cents: number) => string
  /** Draw the ribbons in once, on first paint. */
  animate?: boolean
}

const KIND_COLOR: Record<FlowNode['kind'], string | null> = {
  income: 'var(--income)',
  partner: 'var(--shared)',
  overspent: 'var(--expense)',
  expense: null, // the category's colour
  leftover: 'var(--income)',
}

const colorOf = (node: FlowNode) => KIND_COLOR[node.kind] ?? categoryColor(node.categoryId)

/** Where the month's money came from (left) and where it went (right), ribbons sized by amount. */
export default function FlowChart({ flow, label, kindLabels, format, animate = false }: Props) {
  const { tip, bind } = useTip()
  const empty = flow.sources.length + flow.targets.length === 0
  const rows = Math.max(flow.sources.length, flow.targets.length, 1)
  const height = Math.max(240, rows * 44)

  const nameOf = (node: FlowNode) => node.label || (node.kind in kindLabels ? kindLabels[node.kind as Kind] : kindLabels.uncategorized)

  // the layout only depends on the flow, not on which mark is hovered
  const layoutResult = useMemo(() => {
    if (empty) return null
    const graph = sankey<FlowNode, { source: string; target: string; value: number }>()
      .nodeId((n) => n.id)
      .nodeAlign(sankeyLeft)
      .nodeSort(null)
      .nodeWidth(NODE_WIDTH)
      .nodePadding(14)
      .extent([
        [LABEL_SPACE, 4],
        [WIDTH - LABEL_SPACE, height - 4],
      ])({
      nodes: [...flow.sources, ...flow.targets].map((n) => ({ ...n })),
      links: flow.links.map((l) => ({ ...l })),
    })

    // thin nodes sit close together: spread each side's labels so they never overlap
    const labelY = new Map<string, number>()
    for (const onLeft of [true, false]) {
      const side = graph.nodes.filter((n) => ((n.x0 ?? 0) < WIDTH / 2) === onLeft).sort((a, b) => (a.y0 ?? 0) - (b.y0 ?? 0))
      const spread = spreadLabels(side.map((n) => ((n.y0 ?? 0) + (n.y1 ?? 0)) / 2), LABEL_GAP, LABEL_GAP / 2, height - LABEL_GAP / 2)
      side.forEach((n, i) => labelY.set(n.id, spread[i]))
    }
    return { graph, labelY }
  }, [flow, empty, height])

  // d3-sankey cannot lay out an empty graph
  if (!layoutResult) return <ChartFrame width={WIDTH} height={EMPTY_HEIGHT} label={label} tip={null}>{null}</ChartFrame>
  const { graph, labelY } = layoutResult
  const linkPath = sankeyLinkHorizontal()

  return (
    <ChartFrame width={WIDTH} height={height} label={label} tip={tip} minWidth={MIN_WIDTH}>
      <g fill="none">
        {graph.links.map((link) => {
          const source = link.source as unknown as FlowNode
          const target = link.target as unknown as FlowNode
          const text = `${nameOf(source)} → ${nameOf(target)}: ${format(link.value)}`
          return (
            <path
              key={`${source.id}-${target.id}`}
              d={linkPath(link) ?? ''}
              stroke={colorOf(target)}
              strokeOpacity="0.4"
              strokeWidth={Math.max(1, link.width ?? 0)}
              pathLength={1}
              className={animate ? 'flow-draw' : undefined}
              aria-label={text}
              {...bind({
                x: (((link.source as { x1?: number }).x1 ?? 0) + ((link.target as { x0?: number }).x0 ?? 0)) / 2,
                y: ((link.y0 ?? 0) + (link.y1 ?? 0)) / 2,
                title: nameOf(source),
                lines: [{ label: nameOf(target), value: format(link.value), color: colorOf(target) }],
              })}
            />
          )
        })}
      </g>
      {graph.nodes.map((node) => {
        const isSource = (node.x0 ?? 0) < WIDTH / 2
        const x0 = node.x0 ?? 0
        const y0 = node.y0 ?? 0
        const h = (node.y1 ?? 0) - y0
        const center = y0 + h / 2
        const textY = labelY.get(node.id) ?? center
        const edge = isSource ? x0 : x0 + NODE_WIDTH
        const textX = isSource ? x0 - 10 : x0 + NODE_WIDTH + 10
        return (
          <g key={node.id}>
            <rect x={x0} y={y0} width={NODE_WIDTH} height={Math.max(2, h)} rx="3" fill={colorOf(node)} />
            {Math.abs(textY - center) > 4 && <line x1={edge} y1={center} x2={textX - (isSource ? -4 : 4)} y2={textY} stroke="var(--ink-muted)" strokeWidth="1" />}
            <text y={textY} textAnchor={isSource ? 'end' : 'start'} fontSize="13" fill="var(--ink)">
              <tspan x={textX} dy="-0.2em" fontWeight="600">
                {nameOf(node)}
              </tspan>
              <tspan x={textX} dy="1.3em" fill="var(--ink-muted)">
                {format(node.value ?? 0)}
              </tspan>
            </text>
          </g>
        )
      })}
    </ChartFrame>
  )
}
