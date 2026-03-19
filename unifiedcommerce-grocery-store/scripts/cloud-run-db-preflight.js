/**
 * Cloud Run preflight: try to reach the database with a short timeout.
 * - When run as main: if reachable exit 0; if unreachable start placeholder on PORT.
 * - When required as module: exports runPreflight() returning Promise<{ ok: boolean, message?: string }>.
 */
const http = require('http')
const net = require('net')

function startPlaceholder(port, message) {
  const listenPort = parseInt(process.env.PORT || port, 10)
  const server = http.createServer((req, res) => {
    const urlPath = req.url || '/'
    if (urlPath === '/health' || urlPath === '/health/') {
      const body = JSON.stringify({
        status: 'degraded',
        database: 'unreachable',
        message: message,
      })
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      })
      res.end(body)
      return
    }
    const body = JSON.stringify({
      error: 'Database unreachable',
      message: message,
      hint: 'For Cloud SQL public IP: add Authorized network 0.0.0.0/0 in Cloud SQL → Connections. Or use Cloud SQL Auth Proxy: set CLOUD_SQL_INSTANCE and DATABASE_URL with ?host=/cloudsql/PROJECT:REGION:INSTANCE',
    })
    res.writeHead(503, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    })
    res.end(body)
  })
  server.listen(listenPort, '0.0.0.0', () => {
    console.error(`[preflight] Placeholder server listening on ${listenPort}. Fix DB connectivity and redeploy.`)
  })
}

/**
 * Returns Promise<{ ok: boolean, message?: string }>. ok true = DB reachable; ok false = unreachable (message set).
 */
function runPreflight() {
  const url = process.env.DATABASE_URL
  if (!url) {
    return Promise.resolve({ ok: false, message: 'DATABASE_URL is not set' })
  }

  let host = 'localhost'
  let port = 5432
  try {
    const authority = url.replace(/^[^:]+:\/\//, '').split('/')[0]
    const atLast = authority.lastIndexOf('@')
    const hostPort = atLast >= 0 ? authority.slice(atLast + 1) : authority
    if (hostPort.includes(':')) {
      const idx = hostPort.lastIndexOf(':')
      host = hostPort.slice(0, idx)
      port = parseInt(hostPort.slice(idx + 1), 10) || 5432
    } else {
      host = hostPort
    }
  } catch {
    // ignore
  }

  if (host.startsWith('/') || !host || url.includes('/cloudsql/')) {
    console.log('[preflight] DATABASE_URL uses Cloud SQL socket or no host, skipping TCP preflight')
    return Promise.resolve({ ok: true })
  }

  const timeoutMs = parseInt(process.env.DB_PREFLIGHT_TIMEOUT_MS || '25000', 10)
  const start = Date.now()
  console.log(`[preflight] Checking DB reachability at ${host}:${port} (timeout ${timeoutMs / 1000}s)...`)

  return new Promise((resolve) => {
    const socket = new net.Socket()
    const timer = setTimeout(() => {
      socket.destroy()
      const elapsed = ((Date.now() - start) / 1000).toFixed(1)
      const msg = `Database at ${host}:${port} unreachable after ${elapsed}s (timeout). For Cloud SQL public IP: add Authorized network 0.0.0.0/0 in Cloud SQL → Connections → Networking. Or use Cloud SQL Auth Proxy: set CLOUD_SQL_INSTANCE and DATABASE_URL with ?host=/cloudsql/PROJECT:REGION:INSTANCE`
      console.error(`[preflight] ${msg}`)
      resolve({ ok: false, message: msg })
    }, timeoutMs)

    socket.once('connect', () => {
      clearTimeout(timer)
      socket.destroy()
      const elapsed = ((Date.now() - start) / 1000).toFixed(1)
      console.log(`[preflight] Database at ${host}:${port} reachable (${elapsed}s).`)
      resolve({ ok: true })
    })

    socket.once('error', (err) => {
      clearTimeout(timer)
      const elapsed = ((Date.now() - start) / 1000).toFixed(1)
      const msg = `Database at ${host}:${port} failed after ${elapsed}s: ${err.message}. For Cloud SQL: add Authorized network 0.0.0.0/0 or use Cloud SQL Auth Proxy (CLOUD_SQL_INSTANCE + socket URL).`
      console.error(`[preflight] ${msg}`)
      resolve({ ok: false, message: msg })
    })

    socket.connect(port, host)
  })
}

// When run as main: same behavior as before (exit 0 or start placeholder)
if (require.main === module) {
  runPreflight().then((r) => {
    if (r.ok) process.exit(0)
    else startPlaceholder(9000, r.message)
  })
}

module.exports = { runPreflight, startPlaceholder }
