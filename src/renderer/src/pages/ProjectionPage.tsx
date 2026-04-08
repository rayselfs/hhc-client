import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { createProjectionAdapter } from '@renderer/lib/projection-adapter'
import { isElectron } from '@renderer/lib/env'

export default function ProjectionPage(): React.JSX.Element {
  const { t } = useTranslation()
  const [text, setText] = useState('')

  useEffect(() => {
    const adapter = createProjectionAdapter()

    const unsubText = adapter.on('projection:text', (data) => {
      setText(data)
    })

    let unsubClose = (): void => {}
    let unsubPing = (): void => {}

    if (!isElectron()) {
      unsubClose = adapter.on('__system:close', () => {
        window.close()
      })
      unsubPing = adapter.on('__system:ping', () => {
        adapter.send('__system:pong', null)
      })
      adapter.send('__system:pong', null)

      window.addEventListener('beforeunload', () => {
        adapter.send('__system:closed', null)
      })
    }

    return () => {
      unsubText()
      unsubClose()
      unsubPing()
      adapter.dispose()
    }
  }, [])

  return (
    <div className="flex h-screen w-full items-center justify-center bg-black">
      {text ? (
        <p className="text-white text-6xl font-bold">{text}</p>
      ) : (
        <p className="text-white/30 text-2xl">{t('projection.waiting')}</p>
      )}
    </div>
  )
}
