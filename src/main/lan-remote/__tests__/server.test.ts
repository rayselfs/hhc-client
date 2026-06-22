import { expect, it, vi } from 'vitest'
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

it('pairs a browser session and accepts authorized commands', async () => {
  const commandHandler = vi.fn(async (command) => ({
    requestId: command.requestId,
    status: 'accepted' as const
  }))
  const server = createLanRemoteServer({ commandHandler })

  await server.start({ host: '192.168.1.10', port: 0 })
  const { port } = server.getStatus()
  const pairing = server.createPairingSecret('Phone')
  const pairResponse = await fetch(`http://127.0.0.1:${port}/pair/${pairing.secret}`)
  const html = await pairResponse.text()
  const token = html.match(/const sessionToken = "([^"]+)"/)?.[1]

  expect(token).toBeTruthy()

  const unauthorized = await fetch(`http://127.0.0.1:${port}/state`)
  expect(unauthorized.status).toBe(401)

  const commandResponse = await fetch(`http://127.0.0.1:${port}/command`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-libre-presenter-session': token!
    },
    body: JSON.stringify({ requestId: 'r1', type: 'presentation:next' })
  })

  expect(commandResponse.status).toBe(200)
  await expect(commandResponse.json()).resolves.toEqual({ requestId: 'r1', status: 'accepted' })
  expect(commandHandler).toHaveBeenCalledWith({ requestId: 'r1', type: 'presentation:next' })

  server.publishState({
    revision: 1,
    presentation: { currentIndex: 0, total: 1, currentName: 'A', canNext: false },
    projection: { isOpen: true, isBlanked: false }
  })
  const stateResponse = await fetch(`http://127.0.0.1:${port}/state`, {
    headers: { 'x-libre-presenter-session': token! }
  })
  await expect(stateResponse.json()).resolves.toMatchObject({
    snapshot: {
      revision: 1,
      presentation: { currentName: 'A' },
      projection: { isOpen: true }
    }
  })

  await server.stop()
})
