import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from './App'

function renderRoute(route: string) {
  return render(<MemoryRouter initialEntries={[route]}><App /></MemoryRouter>)
}

describe('application shell', () => {
  it('renders the home entry point', () => {
    renderRoute('/')
    expect(screen.getByRole('heading', { name: /plan with context/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /try a fictional household/i })).toHaveAttribute('href', '/profile')
  })

  it('opens accessible mobile navigation', async () => {
    renderRoute('/')
    const button = screen.getByRole('button', { name: 'Menu' })
    await userEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('navigation', { name: 'Mobile' })).toBeInTheDocument()
  })

  it('shows the independent-student unsupported state', async () => {
    renderRoute('/profile')
    expect(await screen.findByRole('heading', { name: 'Independent students' })).toBeInTheDocument()
    expect(screen.getByText(/unsupported—not calculated/i)).toBeInTheDocument()
  })
})
