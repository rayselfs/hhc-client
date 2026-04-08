import { useState, useEffect } from 'react'
import { createProjectionAdapter } from '@renderer/lib/projection-adapter'
import { isElectron } from '@renderer/lib/env'
import DefaultProjection from '@renderer/components/projection/DefaultProjection'

export default function ProjectionPage(): React.JSX.Element {
  const [showDefault, setShowDefault] = useState(true)
  const [text, setText] = useState('')

  useEffect(() => {
    const adapter = createProjectionAdapter()

    const unsubBlank = adapter.on('__system:blank', ({ showDefault: blank }) => {
      setShowDefault(blank)
    })

    const unsubText = adapter.on('projection:text', (data) => {
      setText(data)
      setShowDefault(false)
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

      const handleBeforeUnload = (): void => {
        adapter.send('__system:closed', null)
      }
      window.addEventListener('beforeunload', handleBeforeUnload)

      return () => {
        unsubBlank()
        unsubText()
        unsubClose()
        unsubPing()
        window.removeEventListener('beforeunload', handleBeforeUnload)
        adapter.dispose()
      }
    }

    return () => {
      unsubBlank()
      unsubText()
      unsubClose()
      unsubPing()
      adapter.dispose()
    }
  }, [])

  if (showDefault) return <DefaultProjection />

  return (
    <div className="flex h-screen w-full items-center justify-center bg-black">
      {text ? <p className="text-white text-6xl font-bold">{text}</p> : <DefaultProjection />}
    </div>
  )
}
