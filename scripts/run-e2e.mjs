#!/usr/bin/env node
/*
 * Runs the browser suite against the production build, with a mock LLM, on
 * ports the kernel picks. Each run gets an empty storage folder.
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { createServer as createNetServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')

const reply = {
  title: 'Mock LLM Title for a Ranked Company Page',
  h1: 'Mock LLM Heading for a Ranked Company Page',
  metaDescription: 'A mock description, long enough to pass the length check on meta descriptions, written for the end-to-end test of the upload workflow here.',
  intro: ['This mock introduction has no figures in it.'],
  sections: [
    { heading: 'Mock section one', paragraphs: ['Mock paragraph one.'] },
    { heading: 'Mock section two', paragraphs: ['Mock paragraph two.'] },
  ],
  faq: [
    { question: 'Mock question one?', answer: 'Mock answer one.' },
    { question: 'Mock question two?', answer: 'Mock answer two.' },
  ],
  keywords: ['mock keyword'],
}

const llm = createServer((request, response) => {
  let body = ''
  request.on('data', chunk => (body += chunk))
  request.on('end', () => {
    if (body.includes('outage')) {
      response.writeHead(503).end()
      return
    }
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(reply) } }] }))
  })
})
await new Promise(done => llm.listen(0, '127.0.0.1', done))

const freePort = () => new Promise((done) => {
  const probe = createNetServer().listen(0, '127.0.0.1', () => {
    const { port } = probe.address()
    probe.close(() => done(port))
  })
})

const port = await freePort()
const storage = mkdtempSync(join(tmpdir(), 'topline-e2e-'))
const llmEnv = {
  NUXT_LLM_NAME: 'mock',
  NUXT_LLM_BASE_URL: `http://127.0.0.1:${llm.address().port}/v1`,
  NUXT_LLM_MODEL: 'mock-1',
}
const app = spawn('node', [join(root, '.output/server/index.mjs')], {
  cwd: storage,
  env: { ...process.env, ...llmEnv, HOST: '127.0.0.1', PORT: String(port), NUXT_DAILY_PAGE_LIMIT: '500', NUXT_IP_DAILY_LIMIT: '500' },
  stdio: ['ignore', 'ignore', 'inherit'],
})

let code = 1
try {
  for (let i = 0; i < 100; i++) {
    if (await fetch(`http://127.0.0.1:${port}/robots.txt`).then(r => r.ok, () => false)) break
    await new Promise(done => setTimeout(done, 100))
  }
  const tests = spawn('npx', ['playwright', 'test', ...process.argv.slice(2)], {
    cwd: root,
    env: { ...process.env, ...llmEnv, E2E_BASE_URL: `http://127.0.0.1:${port}` },
    stdio: 'inherit',
  })
  code = await new Promise(done => tests.on('exit', done))
}
finally {
  app.kill()
  llm.close()
  rmSync(storage, { recursive: true, force: true })
}
process.exit(code)
