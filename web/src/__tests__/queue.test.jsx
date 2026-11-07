import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import homes from '../data/mock/homes.json'
import PriorityQueue, { queueRows } from '../components/PriorityQueue'
import HomeDetails from '../components/HomeDetails'

describe('PriorityQueue', () => {
  it('shows at most 10 rows and no heated homes', () => {
    const rows = queueRows(homes)
    expect(rows.length).toBeLessThanOrEqual(10)
    expect(rows.every((h) => h.status !== 'heated')).toBe(true)
    render(<PriorityQueue homes={homes} selectedId={null} onSelect={() => {}} />)
    expect(screen.getAllByRole('button')).toHaveLength(rows.length)
  })

  it('shows CO ppm instead of a countdown for the CO home', () => {
    render(<PriorityQueue homes={homes} selectedId={null} onSelect={() => {}} />)
    expect(screen.getByText('CO 62 ppm')).toBeInTheDocument()
  })

  it('selects on click and on Enter', () => {
    const onSelect = vi.fn()
    render(<PriorityQueue homes={homes} selectedId={null} onSelect={onSelect} />)
    const first = screen.getAllByRole('button')[0]
    fireEvent.click(first)
    fireEvent.keyDown(first, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledTimes(2)
  })

  it('shows empty state', () => {
    render(<PriorityQueue homes={homes.map((h) => ({ ...h, status: 'heated' }))} selectedId={null} onSelect={() => {}} />)
    expect(screen.getByText('No homes need attention.')).toBeInTheDocument()
  })
})

describe('HomeDetails', () => {
  const base = homes.find((h) => h.id === 'H-13')
  it('shows Unavailable for null k_est', () => {
    render(<HomeDetails home={{ ...base, k_est: null, k_source: null }} selectedId="H-13" />)
    expect(screen.getByText('Insulation k').nextSibling).toHaveTextContent('Unavailable')
  })
  it('shows passed when hours are 0', () => {
    render(<HomeDetails home={base} selectedId="H-13" />)
    expect(screen.getByText('Hours to 60°F').nextSibling).toHaveTextContent('passed')
  })
  it('shows neutral state when home is gone', () => {
    render(<HomeDetails home={undefined} selectedId="H-99" />)
    expect(screen.getByText('Home not in current run.')).toBeInTheDocument()
  })
})
