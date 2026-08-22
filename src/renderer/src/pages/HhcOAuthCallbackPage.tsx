import { useEffect, useState } from 'react'

export default function HhcOAuthCallbackPage(): React.JSX.Element {
  const [complete, setComplete] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const codes = params.getAll('code')
    const states = params.getAll('state')
    if (codes.length !== 1 || states.length !== 1 || !codes[0] || !states[0] || !window.opener) {
      return undefined
    }

    try {
      if (window.opener.location.origin !== window.location.origin) return undefined
      window.opener.postMessage({ code: codes[0], state: states[0] }, window.location.origin)
      const timer = window.setTimeout(() => setComplete(true))
      return () => window.clearTimeout(timer)
    } catch {
      // Cross-origin openers are deliberately not trusted with OAuth callback data.
      return undefined
    }
  }, [])

  return <main>{complete ? 'Sign-in complete' : 'Unable to complete sign-in'}</main>
}
