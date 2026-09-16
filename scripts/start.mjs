import { appendFile, rename, stat, truncate, unlink } from 'fs/promises'
import { cpSync, mkdirSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const standaloneDir = join(projectRoot, '.next', 'standalone')
const logDir = join(projectRoot, 'logs')
const logFile = join(logDir, 'server.log')

mkdirSync(logDir, { recursive: true })
mkdirSync(join(projectRoot, 'cache'), { recursive: true })

if (existsSync(standaloneDir)) {
  cpSync(join(projectRoot, 'public'), join(standaloneDir, 'public'), { recursive: true })
  cpSync(join(projectRoot, '.next', 'static'), join(standaloneDir, '.next', 'static'), { recursive: true })
}

// Rotate when server.log exceeds LOG_MAX_BYTES, keeping one previous file.
// A synchronous-append EPIPE storm once filled 155 GB in a day — logging must
// never be able to eat the disk again.
const LOG_MAX_BYTES = 50 * 1024 * 1024
const ROTATE_CHECK_BYTES = 1024 * 1024

let bytesSinceRotateCheck = 0
let rotating = null

async function rotateIfNeeded(force = false) {
  if (rotating) return rotating
  let size
  try {
    size = (await stat(logFile)).size
  } catch {
    return
  }
  if (size <= LOG_MAX_BYTES && !force) return
  rotating = (async () => {
    try {
      await unlink(`${logFile}.1`).catch(() => {})
      await rename(logFile, `${logFile}.1`)
    } finally {
      rotating = null
    }
  })()
  return rotating
}

async function appendLog(line) {
  try {
    if (bytesSinceRotateCheck >= ROTATE_CHECK_BYTES) {
      bytesSinceRotateCheck = 0
      await rotateIfNeeded()
    }
    const buf = Buffer.from(line)
    bytesSinceRotateCheck += buf.length
    await appendFile(logFile, buf)
  } catch {
    // never let logging failures break the app
  }
}

// A runaway log from a previous run is almost certainly error spam — drop it
// outright instead of rotating gigabytes of it into server.log.1.
const startupSize = await stat(logFile).then((s) => s.size, () => 0)
if (startupSize > 10 * LOG_MAX_BYTES) {
  await truncate(logFile).catch(() => {})
} else {
  await rotateIfNeeded(true)
}

const stamp = () => new Date().toISOString().slice(0, 19).replace('T', ' ')

for (const method of ['log', 'error', 'warn']) {
  const original = console[method]
  console[method] = (...args) => {
    original(...args)
    void appendLog(`${stamp()} ${args.join(' ')}\n`)
  }
}

const mb = (bytes) => `${Math.round(bytes / 1024 / 1024)}MB`
const logMemory = () => {
  const m = process.memoryUsage()
  console.log(`memory: rss=${mb(m.rss)} heap=${mb(m.heapUsed)}/${mb(m.heapTotal)} ext=${mb(m.external)}`)
}

console.log(`Node.js ${process.version} — pid ${process.pid}`)
logMemory()
setInterval(logMemory, 300000)

process.chdir(projectRoot)
console.log(`[START] Working directory: ${process.cwd()}`)

await import('../.next/standalone/server.js')

setTimeout(async () => {
  try {
    const port = process.env.PORT || 3000
    const res = await fetch(`http://localhost:${port}/api/vento/foehn`)
    console.log(`[CACHE] Foehn cache warmed (status ${res.status})`)
  } catch (e) {
    console.error('[CACHE] Failed to warm foehn cache:', e)
  }
}, 5000)
