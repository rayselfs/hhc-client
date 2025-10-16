import * as Sentry from '@sentry/vue'

/**
 * Sentry composable for error reporting
 * Provides unified error reporting functions
 */
export const useSentry = () => {
  /**
   * Report an error to Sentry
   * @param error - The error to report
   * @param context - Additional context information
   */
  const reportError = (
    error: unknown,
    context?: {
      operation?: string
      component?: string
      extra?: Record<string, unknown>
    },
  ) => {
    // Log to console for development debugging
    console.error('Sentry Error Report:', {
      error,
      operation: context?.operation,
      component: context?.component,
      extra: context?.extra,
    })

    Sentry.captureException(error, {
      tags: context?.operation ? { operation: context.operation } : undefined,
      extra: {
        component: context?.component,
        ...context?.extra,
      },
    })
  }

  /**
   * Set user context for Sentry
   * @param user - User information
   */
  const setUserContext = (user: { id?: string; email?: string; username?: string }) => {
    Sentry.setUser(user)
  }

  /**
   * Set additional context for Sentry
   * @param key - Context key
   * @param context - Context value
   */
  const setContext = (key: string, context: Record<string, unknown>) => {
    Sentry.setContext(key, context)
  }

  return {
    reportError,
    setUserContext,
    setContext,
  }
}
