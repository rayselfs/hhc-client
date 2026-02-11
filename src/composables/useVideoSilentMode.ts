import { ref, type Ref } from 'vue'

/**
 * WeakMap to track HTMLMediaElements that have been connected to AudioContext.
 * MediaElementSourceNode can only be created once per element, so we need to track this.
 */
const connectedElements = new WeakMap<
  HTMLMediaElement,
  { audioContext: AudioContext; sourceNode: MediaElementAudioSourceNode; gainNode: GainNode }
>()

/**
 * Composable for managing video silent mode using AudioContext
 * Mutes audio output while keeping the player volume/state active (useful for preview windows)
 */
export function useVideoSilentMode(videoRef: Ref<HTMLVideoElement | null>) {
  const audioContext = ref<AudioContext | null>(null)
  const gainNode = ref<GainNode | null>(null)

  /**
   * Setup AudioContext to mute output while keeping player volume/state active
   * Uses a WeakMap to track already-connected elements (MediaElementSourceNode can only be created once)
   */
  const setup = () => {
    if (!videoRef.value) return

    try {
      const el = videoRef.value

      // Check if this element was already connected to an AudioContext
      const existing = connectedElements.get(el)
      if (existing) {
        // Reuse existing audio nodes - just ensure gain is muted
        audioContext.value = existing.audioContext
        gainNode.value = existing.gainNode
        gainNode.value.gain.value = 0

        // Resume if suspended
        if (audioContext.value.state === 'suspended') {
          audioContext.value.resume()
        }
        return
      }

      // Create new AudioContext and connect
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AudioContextClass) return

      audioContext.value = new AudioContextClass()
      const sourceNode = audioContext.value.createMediaElementSource(el)
      gainNode.value = audioContext.value.createGain()

      // Mute the gain node
      gainNode.value.gain.value = 0

      // Connect source -> gain (muted) -> destination
      sourceNode.connect(gainNode.value)
      gainNode.value.connect(audioContext.value.destination)

      // Store in WeakMap for future reuse
      connectedElements.set(el, {
        audioContext: audioContext.value,
        sourceNode,
        gainNode: gainNode.value,
      })
    } catch (e) {
      // Often fails if element not connected or already connected.
      // Warn but don't crash
      console.warn('Failed to setup AudioContext for silent mode', e)
    }
  }

  /**
   * Resume AudioContext if suspended (browser autoplay policy)
   */
  const resume = () => {
    if (audioContext.value?.state === 'suspended') {
      audioContext.value.resume()
    }
  }

  /**
   * Cleanup - clear local refs but don't close AudioContext
   * AudioContext is reused and stored in WeakMap for element lifetime
   */
  const cleanup = () => {
    audioContext.value = null
    gainNode.value = null
  }

  return {
    audioContext,
    gainNode,
    setup,
    resume,
    cleanup,
  }
}
