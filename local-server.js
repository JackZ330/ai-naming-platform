import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import nameHandler from './api/name.js'
import historyHandler from './api/history.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT) || 3000

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
}

/** 补齐 Vercel 的 req/res 约定，让同一份 handler 在本地也能跑 */
function decorate(req, res, url) {
  req.query = Object.fromEntries(url.searchParams.entries())
  res.status = (code) => {
    res.statusCode = code
    return res
  }
  res.json = (obj) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(obj))
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  decorate(req, res, url)

  try {
    if (url.pathname === '/api/name') {
      await nameHandler(req, res)
      return
    }
    if (url.pathname === '/api/history') {
      await historyHandler(req, res)
      return
    }

    const filePath = path.join(__dirname, url.pathname === '/' ? 'index.html' : url.pathname)
    if (!filePath.startsWith(__dirname)) {
      res.statusCode = 403
      res.end('Forbidden')
      return
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      res.setHeader('Content-Type', MIME[path.extname(filePath)] || 'application/octet-stream')
      fs.createReadStream(filePath).pipe(res)
      return
    }

    res.statusCode = 404
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end('404 Not Found')
  } catch (err) {
    if (!res.headersSent) {
      res.statusCode = 500
      res.end('Server Error: ' + err.message)
    } else {
      res.end()
    }
  }
})

server.listen(PORT, () => {
  console.log(`\n  AI 起名平台已启动：http://localhost:${PORT}\n`)
})
