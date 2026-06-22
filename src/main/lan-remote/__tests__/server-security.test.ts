import { expect, it } from 'vitest'
import { createLanRemoteServer } from '../server'

it('rejects public interface binding', async () => {
  const server = createLanRemoteServer({
    commandHandler: async () => ({ requestId: 'x', status: 'accepted' })
  })

  await expect(server.start({ host: '8.8.8.8', port: 0 })).rejects.toThrow('private LAN')
})
