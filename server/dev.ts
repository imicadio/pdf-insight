// Local development server for the API — mirrors the Vercel Function without needing the Vercel CLI.
// Usage: npm run dev:api (reads .env). Not deployed.
import { createServer } from 'node:http'
import { handleAnalyze, handleOptions } from './handler.js'

const PORT = Number(process.env.PORT ?? 3000)

createServer(async (req, res) => {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)

  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(key, value)
  }
  headers.set('x-real-ip', req.socket.remoteAddress ?? 'local')
  const request = new Request(`http://localhost:${PORT}${req.url ?? '/'}`, {
    method: req.method,
    headers,
    body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
  })

  let response: Response
  if (req.url !== '/api/analyze') response = new Response('Not found', { status: 404 })
  else if (req.method === 'OPTIONS') response = handleOptions(request)
  else if (req.method === 'POST') response = await handleAnalyze(request)
  else response = new Response(null, { status: 405 })

  res.writeHead(response.status, Object.fromEntries(response.headers))
  res.end(Buffer.from(await response.arrayBuffer()))
}).listen(PORT, () => {
  process.stdout.write(`API: http://localhost:${PORT}/api/analyze\n`)
})
