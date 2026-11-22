import 'dotenv/config'
import { z } from 'zod'
import { createInterface } from 'node:readline/promises'
import { questionInputSchema } from '../src/models/question.js'
import { seedQuestions } from './questions.js'

const password = process.env.ADMIN_PASSWORD
if (!password) throw new Error('Set ADMIN_PASSWORD in backend/.env before seeding.')
const port = Number(process.env.PORT ?? 4000)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port.')
const base = `http://127.0.0.1:${port}/api`

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(base + path, init)
  if (!response.ok) throw new Error(`Seed request ${path} failed (${response.status}): ${await response.text()}`)
  return response.json()
}

for (const question of seedQuestions) questionInputSchema.parse(question)
if (!process.stdin.isTTY) throw new Error('Run the seed script in an interactive terminal to enter the verification code.')
const challenge = z.object({ challenge: z.string() }).parse(await request('/admin/otp/request', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }),
}))
const input = createInterface({ input: process.stdin, output: process.stdout })
let code: string
try { code = await input.question('Enter the verification code from the backend console: ') }
finally { input.close() }
if (!/^\d{6}$/.test(code)) throw new Error('Enter a six-digit verification code.')
const login = z.object({ token: z.string() }).parse(await request('/admin/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ challenge: challenge.challenge, code }),
}))
const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${login.token}` }
const existing = z.array(z.object({ chapter: z.string(), stem: z.string() })).parse(await request('/admin/questions', { headers }))
let created = 0
for (const question of seedQuestions) {
  if (existing.some(item => item.chapter === question.chapter && item.stem === question.stem)) continue
  await request('/admin/questions', { method: 'POST', headers, body: JSON.stringify(question) })
  existing.push(question)
  created++
}
await request('/admin/logout', { method: 'POST', headers })
console.log(`Created ${created} sample questions; existing matching questions were retained.`)
