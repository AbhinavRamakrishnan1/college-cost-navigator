import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from '../App'
import { methodologySections, policyEvents, sources } from '../data/methodology'

describe('public methodology and policy traceability', () => {
  it('renders every calculation family with valid primary sources and anchors', async () => {
    const { container } = render(<MemoryRouter initialEntries={['/methodology']}><App/></MemoryRouter>)
    await screen.findByRole('heading', { name: 'How your estimates are calculated.' })
    for (const section of methodologySections) {
      const node = container.querySelector(`#${section.id}`)!
      expect(node).toBeInTheDocument()
      expect(within(node as HTMLElement).getByRole('heading', { name: section.title })).toBeInTheDocument()
      for (const id of section.sources) {
        const source = sources.find(item => item.id === id)!
        expect(within(node as HTMLElement).getByRole('link', { name: source.title })).toHaveAttribute('href', source.url)
        expect(node).toHaveTextContent(source.date)
      }
    }
    expect(methodologySections.filter(section => section.sources.length === 0).map(section => section.id)).toEqual(['privacy'])
    expect(container).toHaveTextContent('national institution snapshot contains 6273 records')
    expect(container).toHaveTextContent('different cohorts')
    expect(container).toHaveTextContent('POLICY_VERSION_UNAVAILABLE')
    expect(container).toHaveTextContent('2026-08-07')
  })
  it('renders dated and distinctly scoped policy events', async () => {
    const { container } = render(<MemoryRouter initialEntries={['/policy-changes']}><App/></MemoryRouter>)
    await screen.findByRole('heading', { name: 'Dated rules, clearly scoped.' })
    for (const event of policyEvents) expect(screen.getByRole('heading', { name: event.title })).toBeInTheDocument()
    expect(container.querySelectorAll('ol time')).toHaveLength(policyEvents.length)
    expect(screen.getByText('Unresolved / litigated')).toBeInTheDocument()
    expect(screen.getByText('Historical')).toBeInTheDocument()
    expect(screen.getByText('Transitional')).toBeInTheDocument()
    expect(container).toHaveTextContent('This does not invalidate the modeled RAP, IBR, Tiered Standard, SAI/Pell, or loan rates')
  })
})
