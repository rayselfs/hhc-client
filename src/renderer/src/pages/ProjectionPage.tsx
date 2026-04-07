import { useState, useEffect, useRef } from 'react'
import { createProjectionAdapter, type ProjectionAdapter } from '@renderer/lib/projection-adapter'

export default function ProjectionPage(): React.JSX.Element {
  const [text, setText] = useState('')
  const adapterRef = useRef<ProjectionAdapter | null>(null)

  useEffect(() => {
    const adapter = createProjectionAdapter()
    adapterRef.current = adapter

    const unsubscribe = adapter.on('projection:text', (data) => {
      setText(data as string)
    })

    return () => {
      unsubscribe()
      adapter.dispose()
    }
  }, [])

  return (
    <div className="flex h-screen w-full items-center justify-center bg-black">
      {text ? (
        <p className="text-white text-6xl font-bold">{text}</p>
      ) : (
        <p className="text-white/30 text-2xl">Waiting for content...</p>
      )}
    </div>
  )
}
