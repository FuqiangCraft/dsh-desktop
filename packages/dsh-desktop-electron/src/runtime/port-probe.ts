import net from 'node:net'

/**
 * Check if a specific TCP port is available on the given host.
 */
export function isPortAvailable(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.unref()

    server.once('error', () => {
      resolve(false)
    })

    server.once('listening', () => {
      server.close(() => {
        resolve(true)
      })
    })

    server.listen(port, host)
  })
}

/**
 * Probe a free port. If preferredPort is given and free, use it;
 * otherwise find an available free ephemeral port starting from preferredPort or OS-assigned.
 */
export async function probeFreePort(preferredPort = 3080, host = '127.0.0.1'): Promise<number> {
  if (preferredPort > 0 && (await isPortAvailable(preferredPort, host))) {
    return preferredPort
  }

  // Scan up to 50 ports from preferredPort
  for (let port = preferredPort + 1; port < preferredPort + 50; port++) {
    if (await isPortAvailable(port, host)) {
      return port
    }
  }

  // Fallback to OS assigned free port
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()

    server.once('error', (err) => {
      reject(err)
    })

    server.listen(0, host, () => {
      const address = server.address()
      if (typeof address === 'object' && address !== null) {
        const assignedPort = address.port
        server.close(() => {
          resolve(assignedPort)
        })
      } else {
        server.close(() => {
          reject(new Error('Failed to resolve dynamic port'))
        })
      }
    })
  })
}
