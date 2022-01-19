import { test } from 'uvu'
import assert from 'uvu/assert'
import { createUpnpClient } from '../lib/upnp'

test('upnp', async () => {
    const client = await createUpnpClient()
    const mappings = await client.getMappings()
    assert.ok(mappings)
    console.log(mappings)
    client.destroy()
})

test('upnp - external ip', async () => {
    const client = await createUpnpClient()
    const ip = await client.externalIp()
    assert.ok(ip)
    // console.log(ip)
    client.destroy()
})

test.run()
