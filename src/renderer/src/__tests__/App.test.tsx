import { render, screen } from '@testing-library/react'
import App from '../App'

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />)
  })

  it('renders App div', () => {
    render(<App />)
    expect(screen.getByText('App')).toBeInTheDocument()
  })
})
