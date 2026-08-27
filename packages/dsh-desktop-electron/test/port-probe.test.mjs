import test from 'node:test'
import assert from 'node:assert/strict'
import net from 'node:net'
import { isPortAvailable, probeFreePort } from '../dist/runtime/port-probe.js'

test('isPortAvailable correctly detects free and occupied ports', async () => {
  const server = net.createServer()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const occupiedPort = server.address().port

  const availableOccupied = await isPortAvailable(occupiedPort, '127.0.0.1')
  assert.equal(availableOccupied, false, 'Occupied port should report not available')

  await new Promise((resolve) => server.close(resolve))

  const availableAfterClose = await isPortAvailable(occupiedPort, '127.0.0.1')
  assert.equal(availableAfterClose, true, 'Closed port should report available')
})

test('probeFreePort resolves an available port', async () => {
  const port = await probeFreePort(3080, '127.0.0.1')
  assert.ok(port > 0 && port < 65536, 'Probed port must be a valid TCP port number')
  const available = await isPortAvailable(port, '127.0.0.1')
  assert.equal(available, true, 'Probed port must be available')
})
