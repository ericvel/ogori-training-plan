import { createRemoteJWKSet, jwtVerify } from 'jose'
import { applyCommand } from '../../shared/commands.ts'
import type { Command } from '../../shared/commands.ts'
import type { TrainingState } from '../../shared/model.ts'

interface Env {
  DB: D1Database
  OWNER_EMAIL: string
  ACCESS_TEAM_DOMAIN?: string
  ACCESS_AUD?: string
  DEV_AUTH?: string
}
interface Row {
  document: string
  revision: number
  updated_at: string
}
const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>()
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      Vary: 'Cookie',
    },
  })
}
function snapshot(row: Row) {
  return {
    state: JSON.parse(row.document) as TrainingState,
    revision: row.revision,
    updatedAt: row.updated_at,
  }
}
export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url)
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
  if (!env.OWNER_EMAIL) return json({ error: 'Owner access is not configured.' }, 503)
  if (!(local && env.DEV_AUTH === 'true')) {
    if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD)
      return json({ error: 'Private sign-in is not configured.' }, 503)
    const domain = env.ACCESS_TEAM_DOMAIN.replace(/^https:\/\//, '').replace(/\/$/, '')
    if (!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(domain))
      return json({ error: 'Private sign-in configuration is invalid.' }, 503)
    const token = request.headers.get('Cf-Access-Jwt-Assertion')
    if (!token) return json({ error: 'Sign in to access your training data.' }, 401)
    try {
      let keys = keySets.get(domain)
      if (!keys) {
        keys = createRemoteJWKSet(new URL(`https://${domain}/cdn-cgi/access/certs`))
        keySets.set(domain, keys)
      }
      const { payload } = await jwtVerify(token, keys, {
        issuer: `https://${domain}`,
        audience: env.ACCESS_AUD,
        algorithms: ['RS256'],
      })
      if (
        typeof payload.email !== 'string' ||
        payload.email.toLowerCase() !== env.OWNER_EMAIL.toLowerCase()
      ) {
        return json({ error: 'This account does not have access.' }, 403)
      }
    } catch {
      return json({ error: 'Your sign-in has expired. Reload to sign in again.' }, 401)
    }
  }
  if (url.pathname !== '/api/state') return json({ error: 'Not found.' }, 404)
  if (!['GET', 'POST'].includes(request.method)) return json({ error: 'Method not allowed.' }, 405)
  if (request.method === 'POST' && request.headers.get('Origin') !== url.origin)
    return json({ error: 'Request origin was rejected.' }, 403)
  if (!env.DB) return json({ error: 'Training database is not configured.' }, 503)
  try {
    const row = await env.DB.prepare(
      'SELECT document, revision, updated_at FROM app_state WHERE id = 1',
    ).first<Row>()
    if (!row) return json({ error: 'Training data has not been migrated yet.' }, 503)
    if (request.method === 'GET') return json(snapshot(row))
    if (!request.headers.get('Content-Type')?.startsWith('application/json'))
      return json({ error: 'Send JSON updates.' }, 415)
    if (Number(request.headers.get('Content-Length')) > 4_000_000)
      return json({ error: 'Update is too large.' }, 413)
    const text = await request.text()
    if (text.length > 4_000_000) return json({ error: 'Update is too large.' }, 413)
    let body: { revision: number; command: Command }
    try {
      body = JSON.parse(text)
    } catch {
      return json({ error: 'Invalid JSON.' }, 400)
    }
    if (!body || !Number.isInteger(body.revision))
      return json({ error: 'Update must include its revision.' }, 400)
    if (body.revision !== row.revision)
      return json(
        {
          error: 'Data changed on another device. Reload changes, review, then retry.',
          ...snapshot(row),
        },
        409,
      )
    let next: TrainingState
    try {
      next = applyCommand(JSON.parse(row.document), body.command)
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'Invalid update.' }, 400)
    }
    const document = JSON.stringify(next),
      updatedAt = new Date().toISOString()
    if (new TextEncoder().encode(document).byteLength > 1_800_000)
      return json(
        {
          error:
            'Training history is too large for this import. Download a backup before reducing the imported range.',
        },
        413,
      )
    const result = await env.DB.prepare(
      'UPDATE app_state SET document = ?, revision = revision + 1, updated_at = ? WHERE id = 1 AND revision = ?',
    )
      .bind(document, updatedAt, row.revision)
      .run()
    if (result.meta.changes !== 1) {
      const latest = await env.DB.prepare(
        'SELECT document, revision, updated_at FROM app_state WHERE id = 1',
      ).first<Row>()
      return json(
        {
          error: 'Data changed on another device. Reload changes, review, then retry.',
          ...(latest ? snapshot(latest) : {}),
        },
        409,
      )
    }
    return json({ state: next, revision: row.revision + 1, updatedAt })
  } catch (error) {
    console.error(
      'Training database request failed',
      error instanceof Error ? error.name : 'Unknown error',
    )
    return json({ error: 'Could not reach training storage. Keep this page open and retry.' }, 503)
  }
}
