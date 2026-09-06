import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CameraWorkspacePage from '../CameraWorkspacePage'
vi.mock('@renderer/contexts/CameraSessionContext', () => ({
  useCameraSession: () => ({
    stream: null,
    selectSource: vi.fn(),
    enable: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    reset: vi.fn(),
    retry: vi.fn()
  })
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
it('shows one source selector and no alternative fit modes', () => {
  render(
    <MemoryRouter>
      <CameraWorkspacePage />
    </MemoryRouter>
  )
  expect(screen.getAllByRole('combobox')).toHaveLength(1)
  expect(screen.getByRole('button', { name: 'camera.start' })).toBeDisabled()
  expect(screen.queryByText(/contain|stretch/i)).toBeNull()
})
