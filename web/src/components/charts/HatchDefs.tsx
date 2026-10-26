import { useId } from 'react'

/**
 * A diagonal hatch in one colour, for what is planned but not yet realized. Returns the pattern
 * definition and the `fill` value that uses it; ids are unique per instance.
 */
export function useHatch(color: string) {
  const id = `hatch-${useId().replace(/:/g, '')}`
  return {
    fill: `url(#${id})`,
    defs: (
      <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="6" height="6" fill={color} opacity="0.18" />
        <line x1="0" y1="0" x2="0" y2="6" stroke={color} strokeWidth="2.5" />
      </pattern>
    ),
  }
}
