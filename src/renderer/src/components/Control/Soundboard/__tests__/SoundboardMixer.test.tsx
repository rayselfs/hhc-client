import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SoundboardMixer from '@renderer/components/Control/Soundboard/SoundboardMixer'
import { useSoundboardStore } from '@renderer/stores/soundboard'

it('updates master volume and exposes stop controls', async () => {
  const user = userEvent.setup()
  const stopAll = vi.fn()
  const fadeAll = vi.fn()
  render(<SoundboardMixer onStopAll={stopAll} onFadeAll={fadeAll} />)

  await user.clear(screen.getByLabelText(/master volume/i))
  await user.type(screen.getByLabelText(/master volume/i), '25')
  await user.click(screen.getByRole('button', { name: /stop all/i }))
  await user.click(screen.getByRole('button', { name: /fade all/i }))

  expect(useSoundboardStore.getState().settings.masterVolume).toBe(0.25)
  expect(stopAll).toHaveBeenCalled()
  expect(fadeAll).toHaveBeenCalled()
})
