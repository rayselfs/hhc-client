import type { FileSystemProvider, FileSourceType, ProviderResult } from './types'
import { LocalProvider } from './providers/LocalProvider'
import { createSuccessResult, createFailureResult } from './types'

/**
 * FileSystemProviderFactory
 *
 * Manages multiple file system providers and routes operations
 * to the appropriate provider based on URL or source type.
 *
 * Usage:
 * ```typescript
 * // Initialize once at app startup
 * await fileSystemProviderFactory.initialize()
 *
 * // Get provider for a specific source type
 * const provider = fileSystemProviderFactory.getProvider('local')
 *
 * // Get provider based on URL
 * const provider = fileSystemProviderFactory.getProviderForUrl('local-resource://...')
 * ```
 */
class FileSystemProviderFactory {
  private providers: Map<FileSourceType, FileSystemProvider> = new Map()
  private defaultProviderType: FileSourceType = 'sync'
  private initialized = false

  /**
   * Initialize all available providers
   * Should be called once at application startup
   */
  async initialize(): Promise<ProviderResult<void>> {
    if (this.initialized) {
      return createSuccessResult(undefined)
    }

    try {
      // Initialize local provider
      const localProvider = new LocalProvider()
      const localResult = await localProvider.initialize()

      if (localResult.success) {
        this.providers.set('local', localProvider)
        this.providers.set('sync', localProvider)
      } else {
        console.warn('LocalProvider initialization failed:', localResult.error)
      }

      // Future: Initialize cloud providers here
      // const cloudProvider = new GoogleDriveProvider()
      // const cloudResult = await cloudProvider.initialize()
      // if (cloudResult.success) {
      //   this.providers.set('cloud', cloudProvider)
      // }

      // Future: Initialize sync provider
      // const syncProvider = new SyncProvider()
      // const syncResult = await syncProvider.initialize()
      // if (syncResult.success) {
      //   this.providers.set('sync', syncProvider)
      // }

      this.initialized = true
      return createSuccessResult(undefined)
    } catch (error) {
      return createFailureResult(error instanceof Error ? error.message : String(error), 'UNKNOWN')
    }
  }

  /**
   * Check if the factory has been initialized
   */
  isInitialized(): boolean {
    return this.initialized
  }

  /**
   * Get a provider by source type
   * Auto-initializes if not already initialized
   * @param type - The source type (default: 'local')
   * @throws Error if provider not found
   */
  getProvider(type: FileSourceType = this.defaultProviderType): FileSystemProvider {
    // Auto-initialize if not already done
    if (!this.initialized) {
      this.initializeSync()
    }

    const provider = this.providers.get(type)

    if (!provider) {
      throw new Error(`Provider not found for type: ${type}`)
    }

    return provider
  }

  /**
   * Synchronous initialization for immediate use
   * Used when getProvider is called before async initialize
   */
  private initializeSync(): void {
    if (this.initialized) return

    // Initialize local provider synchronously
    const localProvider = new LocalProvider()
    // Sync initialization - just check environment
    if (typeof window !== 'undefined' && !!window.electronAPI) {
      localProvider['_isAvailable'] = true
    }
    this.providers.set('local', localProvider)
    this.providers.set('sync', localProvider)

    this.initialized = true
  }

  /**
   * Safely get a provider, returns null if not found
   */
  getProviderSafe(type: FileSourceType): FileSystemProvider | null {
    return this.providers.get(type) || null
  }

  /**
   * Get the appropriate provider for a given URL
   * @param url - The file URL to analyze
   * @returns The provider that can handle this URL
   */
  getProviderForUrl(url: string): FileSystemProvider {
    // Check each provider to see if it can handle the URL
    for (const provider of this.providers.values()) {
      if (provider.canHandle(url)) {
        return provider
      }
    }

    // Fallback to default provider
    return this.getProvider(this.defaultProviderType)
  }

  /**
   * Check if a URL can be handled by any registered provider
   */
  canHandle(url: string): boolean {
    for (const provider of this.providers.values()) {
      if (provider.canHandle(url)) {
        return true
      }
    }
    return false
  }

  /**
   * Get all registered providers
   */
  getAllProviders(): FileSystemProvider[] {
    return Array.from(this.providers.values())
  }

  /**
   * Get all available provider types
   */
  getAvailableTypes(): FileSourceType[] {
    return Array.from(this.providers.keys())
  }

  /**
   * Check if a specific provider type is available
   */
  hasProvider(type: FileSourceType): boolean {
    const provider = this.providers.get(type)
    return provider?.isAvailable() ?? false
  }

  /**
   * Set the default provider type
   */
  setDefaultProvider(type: FileSourceType): void {
    if (!this.providers.has(type)) {
      throw new Error(`Cannot set default: Provider not found for type: ${type}`)
    }
    this.defaultProviderType = type
  }

  /**
   * Get the default provider type
   */
  getDefaultProviderType(): FileSourceType {
    return this.defaultProviderType
  }

  /**
   * Register a new provider (for future dynamic provider loading)
   */
  registerProvider(provider: FileSystemProvider): void {
    this.providers.set(provider.type, provider)
  }

  /**
   * Unregister a provider
   */
  unregisterProvider(type: FileSourceType): boolean {
    return this.providers.delete(type)
  }
}

/**
 * Singleton instance of the factory
 */
export const fileSystemProviderFactory = new FileSystemProviderFactory()

/**
 * Helper function to get the local provider directly
 * Convenience method for common use case
 */
export function getLocalProvider(): LocalProvider {
  return fileSystemProviderFactory.getProvider('local') as LocalProvider
}
