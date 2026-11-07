import { stormDuration } from './format'

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

// Display-only summary built from backend values. Never computes risk or status.
export function headline(homes) {
  const total = homes.length
  if (total === 0) return 'Waiting for data from the simulator.'

  const count = (s) => homes.filter((h) => h.status === s).length
  const critical = count('critical')
  const warning = count('warning')
  const cooling = count('cooling')

  if (critical + warning + cooling === 0) {
    return `All ${total} homes heated. Cut power to a block to begin.`
  }

  const parts = []
  if (critical > 0) parts.push(`${plural(critical, 'home')} critical`)
  else if (warning > 0) parts.push(`${plural(warning, 'home')} warning`)
  else parts.push(`${plural(cooling, 'home')} cooling`)

  const hours = homes
    .filter((h) => (h.status === 'cooling' || h.status === 'warning') && h.hours_to_50 !== null && h.hours_to_50 !== undefined)
    .map((h) => h.hours_to_50)
  if (hours.length > 0) {
    const next = Math.min(...hours)
    parts.push(
      next <= 0
        ? 'a home is already below 50°F'
        : `next home reaches 50°F in ${stormDuration(next)} storm time`,
    )
  }
  return parts.join(' · ')
}

export function kpiCounts(homes, state) {
  const blocks = state && Array.isArray(state.blocks) ? state.blocks : []
  return {
    total: homes.length,
    critical: homes.filter((h) => h.status === 'critical').length,
    warning: homes.filter((h) => h.status === 'warning').length,
    blocksWithoutPower: blocks.filter((b) => !b.power_on).length,
    needHelp: homes.filter((h) => h.outcome === 'needs_help' || h.outcome === 'medical').length,
    offline: homes.filter((h) => h.online === false).length,
  }
}
