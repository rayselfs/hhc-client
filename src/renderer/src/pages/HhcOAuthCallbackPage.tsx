import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import icon from '@renderer/assets/icon.png'
import { HHC_AUTH_CALLBACK_CHANNEL } from '@shared/hhc-auth'

export default function HhcOAuthCallbackPage(): React.JSX.Element {
  const [status, setStatus] = useState<'pending' | 'complete' | 'failed'>('pending')
  const { t } = useTranslation()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const codes = params.getAll('code')
    const states = params.getAll('state')
    if (codes.length !== 1 || states.length !== 1 || !codes[0] || !states[0]) {
      const timer = window.setTimeout(() => setStatus('failed'))
      return () => window.clearTimeout(timer)
    }

    const payload = { code: codes[0], state: states[0] }
    let channel =
      typeof BroadcastChannel === 'undefined'
        ? null
        : new BroadcastChannel(HHC_AUTH_CALLBACK_CHANNEL)
    let settled = false
    const finish = (data: unknown): void => {
      if (
        !data ||
        typeof data !== 'object' ||
        !('state' in data) ||
        !('status' in data) ||
        data.state !== payload.state ||
        (data.status !== 'complete' && data.status !== 'failed')
      )
        return
      if (settled) return
      settled = true
      if (timer) window.clearTimeout(timer)
      setStatus(data.status)
      window.removeEventListener('message', onMessage)
      channel?.removeEventListener('message', onBroadcast)
      channel?.close()
      channel = null
    }
    const onBroadcast = (event: MessageEvent<unknown>): void => finish(event.data)
    const onMessage = (event: MessageEvent<unknown>): void => {
      if (event.origin === window.location.origin && event.source === window.opener)
        finish(event.data)
    }
    channel?.addEventListener('message', onBroadcast)
    window.addEventListener('message', onMessage)

    let delivered = false
    try {
      if (window.opener?.location.origin === window.location.origin) {
        window.opener.postMessage(payload, window.location.origin)
        delivered = true
      }
    } catch {
      // Cross-origin openers are deliberately not trusted with OAuth callback data.
    }

    if (!delivered && channel) {
      channel.postMessage(payload)
      delivered = true
    }
    const timer = window.setTimeout(
      () => {
        if (settled) return
        settled = true
        setStatus('failed')
        window.removeEventListener('message', onMessage)
        channel?.removeEventListener('message', onBroadcast)
        channel?.close()
        channel = null
      },
      delivered ? 30_000 : 0
    )
    return () => {
      if (timer) window.clearTimeout(timer)
      window.removeEventListener('message', onMessage)
      channel?.removeEventListener('message', onBroadcast)
      channel?.close()
    }
  }, [])

  const title =
    status === 'pending'
      ? t('authCallback.pendingTitle')
      : status === 'complete'
        ? t('authCallback.completeTitle')
        : t('authCallback.failedTitle')
  const description =
    status === 'pending'
      ? t('authCallback.pendingDescription')
      : status === 'complete'
        ? t('authCallback.completeDescription')
        : t('authCallback.failedDescription')

  return (
    <main className="flex h-screen items-center justify-center bg-background p-6 text-foreground">
      <section className="w-full max-w-md rounded-3xl border border-divider bg-content1 p-8 text-center shadow-xl">
        <img className="mx-auto mb-6 h-20 w-20 rounded-2xl" src={icon} alt={t('app.name')} />
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-3 text-foreground-500">{description}</p>
      </section>
    </main>
  )
}
