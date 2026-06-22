import { expect, it } from 'vitest'
import { createLanRemoteServer } from '../server'

it('starts disabled and creates one-use pairing secrets', async () => {
  const server = createLanRemoteServer({
    commandHandler: async () => ({ requestId: 'x', status: 'accepted' })
  })

  expect(server.getStatus().enabled).toBe(false)

  await server.start({ host: '192.168.1.10', port: 0 })
  const pairing = server.createPairingSecret('Device')

  expect(server.getStatus().enabled).toBe(true)
  expect(pairing.url).toContain('/pair/')
  expect(server.consumePairingSecret(pairing.secret)?.deviceName).toBe('Device')
  expect(server.consumePairingSecret(pairing.secret)).toBeNull()

  await server.stop()
  expect(server.getStatus().enabled).toBe(false)
})
