import { afterEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@renderer/i18n'
import DefaultProjection from '@renderer/components/Projection/DefaultProjection'

afterEach(async () => {
  await i18n.changeLanguage('en')
})

describe.each([
  ['en', 'HHC Presenter'],
  ['zh-TW', 'HHC 投影系統'],
  ['zh-CN', 'HHC 投影系统']
] as const)('DefaultProjection in %s', (language, name) => {
  it('shows the localized product name', async () => {
    await i18n.changeLanguage(language)

    render(
      <I18nextProvider i18n={i18n}>
        <DefaultProjection />
      </I18nextProvider>
    )

    expect(screen.getByText(name)).toBeInTheDocument()
  })
})
