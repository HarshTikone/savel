import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import series from '../data/mock/series-H-13.json'
import TemperatureChart, { buildChartData, yDomain } from '../components/TemperatureChart'

describe('TemperatureChart', () => {
  it('renders three legend entries for a series with an estimated tail', () => {
    render(<TemperatureChart series={series} selectedId="H-13" width={700} />)
    expect(screen.getByText('Measured')).toBeInTheDocument()
    expect(screen.getByText('Estimated (sensor offline)')).toBeInTheDocument()
    expect(screen.getByText('Predicted')).toBeInTheDocument()
  })

  it('draws both reference line labels', () => {
    const { container } = render(<TemperatureChart series={series} selectedId="H-13" width={700} />)
    expect(container.textContent).toContain('warning 60°F')
    expect(container.textContent).toContain('critical 50°F')
  })

  it('shows empty, error and no-selection states', () => {
    const { rerender } = render(<TemperatureChart series={{ actual: [], predicted: [] }} selectedId="H-13" />)
    expect(screen.getByText('No readings yet')).toBeInTheDocument()
    rerender(<TemperatureChart series={null} error="Unknown home" selectedId="H-99" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Unknown home')
    rerender(<TemperatureChart series={null} selectedId={null} />)
    expect(screen.getByText(/Select a home/)).toBeInTheDocument()
  })
})

describe('buildChartData', () => {
  it('splits measured and estimated runs and never adds points beyond input times', () => {
    const { data, nowT } = buildChartData(series)
    const times = new Set([...series.actual, ...series.predicted].map((p) => new Date(p.t).getTime()))
    expect(data.every((d) => times.has(d.t))).toBe(true)
    expect(data.some((d) => d.estimated !== undefined)).toBe(true)
    expect(data.some((d) => d.measured !== undefined)).toBe(true)
    expect(nowT).toBe(new Date(series.actual[series.actual.length - 1].t).getTime())
  })
  it('y domain always includes 50 and 68', () => {
    const [lo, hi] = yDomain([{ measured: 60 }])
    expect(lo).toBeLessThanOrEqual(50)
    expect(hi).toBeGreaterThanOrEqual(68)
  })
})
