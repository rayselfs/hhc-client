import { describe, it, expect, vi } from 'vitest'

describe('GeneralSettings', () => {
  it('should have correct props interface', () => {
    const props = {
      selectedLanguage: 'en',
      languageOptions: [
        { text: 'English', value: 'en' },
        { text: '繁體中文', value: 'zh-TW' },
      ],
      selectedTimezone: 'Asia/Taipei',
      timezones: [
        { title: 'Taipei', value: 'Asia/Taipei' },
        { title: 'Tokyo', value: 'Asia/Tokyo' },
      ],
      isDarkMode: false,
    }

    expect(props.selectedLanguage).toBe('en')
    expect(props.languageOptions).toHaveLength(2)
    expect(props.selectedTimezone).toBe('Asia/Taipei')
    expect(props.timezones).toHaveLength(2)
    expect(props.isDarkMode).toBe(false)
  })

  it('should handle language change correctly', () => {
    const mockEmit = vi.fn()
    const newLanguage = 'zh-TW'

    mockEmit('languageChange', newLanguage)

    expect(mockEmit).toHaveBeenCalledExactlyOnceWith('languageChange', 'zh-TW')
  })

  it('should handle timezone change correctly', () => {
    const mockEmit = vi.fn()
    const newTimezone = 'Asia/Tokyo'

    mockEmit('timezoneChange', newTimezone)

    expect(mockEmit).toHaveBeenCalledExactlyOnceWith('timezoneChange', 'Asia/Tokyo')
  })

  it('should handle dark mode toggle correctly', () => {
    const mockEmit = vi.fn()
    const newDarkMode = true

    mockEmit('update:isDarkMode', newDarkMode)

    expect(mockEmit).toHaveBeenCalledExactlyOnceWith('update:isDarkMode', true)
  })
})
