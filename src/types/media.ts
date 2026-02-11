import type { BaseMessage } from './projection'
import { MessageType } from './projection'
import type { FileItem } from './folder'

/**
 * Media Update Message
 */
export interface MediaUpdateMessage extends BaseMessage {
  type: MessageType.MEDIA_UPDATE
  data: {
    playlist?: FileItem[]
    currentIndex: number
    action: 'update' | 'next' | 'prev' | 'jump' | 'ended'
    type?: 'video' | 'image' | 'pdf'
  }
}

/**
 * Media Control Message
 */
export interface MediaControlMessage extends BaseMessage {
  type: MessageType.MEDIA_CONTROL
  data: {
    type: 'video' | 'image' | 'pdf'
    action: string
    value?: number | string | { x: number; y: number }
    shouldPlay?: boolean
  }
}
