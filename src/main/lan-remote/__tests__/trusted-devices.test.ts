import { expect, it } from 'vitest'
import { createTrustedDeviceStore } from '../trusted-devices'

it('stores only hashes and expires credentials', async () => {
  const store = createTrustedDeviceStore()
  const credential = await store.addTrustedDevice('Phone', 1, 1000)

  expect(JSON.stringify(store.listTrustedDevices())).not.toContain(credential.secret)
  expect(await store.verifyCredential(credential.id, credential.secret, 1000)).toBe(true)
  expect(
    await store.verifyCredential(credential.id, credential.secret, 1000 + 2 * 24 * 60 * 60 * 1000)
  ).toBe(false)
})
