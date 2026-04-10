import { isOnboarded, markOnboarded, ONBOARDED_KEY } from '../onboarding'

describe('onboarding', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('isOnboarded() returns false when no flag', () => {
    expect(isOnboarded()).toBe(false)
  })

  it('markOnboarded() sets flag, isOnboarded() returns true', () => {
    markOnboarded()
    expect(isOnboarded()).toBe(true)
  })

  it('isOnboarded() returns false when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error()
    })
    expect(isOnboarded()).toBe(false)
    vi.restoreAllMocks()
  })

  it('markOnboarded() warns when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error()
    })
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    markOnboarded()
    expect(spy).toHaveBeenCalledWith('[Onboarding] Failed to persist onboarded flag')
    vi.restoreAllMocks()
  })

  it('ONBOARDED_KEY is a non-empty string', () => {
    expect(typeof ONBOARDED_KEY).toBe('string')
    expect(ONBOARDED_KEY.length).toBeGreaterThan(0)
  })
})
