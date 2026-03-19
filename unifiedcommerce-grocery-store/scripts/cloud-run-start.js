/**
 * Cloud Run startup wrapper: listen on PORT immediately so the platform's startup probe
 * always sees a listener. Run preflight, then start Medusa on an internal port and proxy to it.
 * PORT is never released. Migrations are not run here; run them separately (e.g. medusa db:migrate) before or after deploy.
 * SIGTERM is forwarded to Medusa; if we're between spawn and assign, we wait briefly.
 */
const http = require('http')
const net = require('net')
const path = require('path')
const { spawn } = require('child_process')

const PORT = parseInt(process.env.PORT || '9000', 10)
const MEDUSA_INTERNAL_PORT = 9001

let statusMessage = 'Starting...'
let medusaChild = null
/** Set true just before spawn, false after assigning medusaChild; SIGTERM handler uses this to avoid exiting without forwarding. */
let startingMedusa = false

function waitForPort(port, opts = {}) {
  const maxAttempts = opts.maxAttempts || 120
  const intervalMs = opts.intervalMs || 2000
  return new Promise((resolve, reject) => {
    let attempts = 0
    const tryConnect = () => {
      const socket = new net.Socket()
      const timer = setTimeout(() => {
        socket.destroy()
        attempts++
        if (attempts >= maxAttempts) {
          reject(new Error(`Port ${port} did not become ready in time`))
          return
        }
        tryConnect()
      }, intervalMs)
      socket.once('connect', () => {
        clearTimeout(timer)
        socket.destroy()
        resolve()
      })
      socket.once('error', () => {
        clearTimeout(timer)
        socket.destroy()
        attempts++
        if (attempts >= maxAttempts) {
          reject(new Error(`Port ${port} did not become ready in time`))
          return
        }
        tryConnect()
      })
      socket.connect(port, '127.0.0.1')
    }
    tryConnect()
  })
}

function proxyRequest(clientReq, clientRes, backendPort) {
  const opts = {
    hostname: '127.0.0.1',
    port: backendPort,
    path: clientReq.url,
    method: clientReq.method,
    headers: { ...clientReq.headers },
  }
  delete opts.headers.host
  const proxy = http.request(opts, (backendRes) => {
    clientRes.writeHead(backendRes.statusCode, backendRes.headers)
    backendRes.pipe(clientRes)
  })
  proxy.on('error', (err) => {
    clientRes.writeHead(502, { 'Content-Type': 'application/json' })
    clientRes.end(JSON.stringify({ error: 'Bad Gateway', message: err.message }))
  })
  clientReq.pipe(proxy)
}

function serveStatus(req, res) {
  const urlPath = (req.url || '/').split('?')[0]
  if (urlPath === '/health' || urlPath === '/health/') {
    const body = JSON.stringify({ status: 'degraded', message: statusMessage })
    res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) })
    res.end(body)
    return
  }
  const body = JSON.stringify({ error: 'Database unreachable', message: statusMessage })
  res.writeHead(503, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) })
  res.end(body)
}

let requestHandler = serveStatus

const server = http.createServer((req, res) => {
  requestHandler(req, res)
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[cloud-run-start] Listening on ${PORT}. Running DB preflight...`)
  let runPreflight
  try {
    runPreflight = require(path.join(__dirname, 'cloud-run-db-preflight.js')).runPreflight
  } catch (err) {
    console.error('[cloud-run-start] Failed to load preflight:', err)
    statusMessage = `Startup error: ${err.message}`
    return
  }
  runPreflight()
    .then((r) => {
      if (!r.ok) {
        statusMessage = r.message || 'Database unreachable'
        console.error(`[cloud-run-start] ${statusMessage}`)
        return
      }
      console.log('[cloud-run-start] Preflight OK. Starting Medusa on internal port', MEDUSA_INTERNAL_PORT, '...')
      statusMessage = 'Starting Medusa...'
      startingMedusa = true
      const env = { ...process.env, PORT: String(MEDUSA_INTERNAL_PORT) }
      medusaChild = spawn('npx', ['medusa', 'start'], {
        env,
        stdio: 'inherit',
        cwd: process.cwd(),
      })
      startingMedusa = false
      medusaChild.on('error', (err) => {
        console.error('[cloud-run-start] Failed to start Medusa:', err)
        statusMessage = `Medusa failed to start: ${err.message}`
      })
      medusaChild.on('exit', (code, signal) => {
        if (code !== null && code !== 0) {
          console.error('[cloud-run-start] Medusa exited with code', code)
          statusMessage = `Medusa exited with code ${code}`
        }
      })
      waitForPort(MEDUSA_INTERNAL_PORT, { maxAttempts: 90, intervalMs: 2000 })
        .then(() => {
          statusMessage = 'ok'
          requestHandler = (req, res) => proxyRequest(req, res, MEDUSA_INTERNAL_PORT)
          console.log('[cloud-run-start] Medusa ready. Proxying to backend.')
        })
        .catch((err) => {
          console.error('[cloud-run-start]', err.message)
          statusMessage = err.message
        })
    })
    .catch((err) => {
      console.error('[cloud-run-start] Preflight error:', err)
      statusMessage = err.message
    })
})

server.on('error', (err) => {
  console.error('[cloud-run-start] Server listen error:', err)
  process.exit(1)
})

process.on('SIGTERM', () => {
  if (medusaChild) {
    medusaChild.kill('SIGTERM')
  } else if (startingMedusa) {
    const deadline = Date.now() + 5000
    const waitThenExit = () => {
      if (medusaChild) {
        medusaChild.kill('SIGTERM')
      } else if (Date.now() < deadline) {
        setImmediate(waitThenExit)
      } else {
        process.exit(0)
      }
    }
    setImmediate(waitThenExit)
  } else {
    server.close(() => process.exit(0))
  }
})
