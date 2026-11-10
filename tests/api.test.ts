import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { generateKeyPair, exportJWK, SignJWT } from 'jose'
import { onRequest } from '../functions/api/[[path]].ts'
import { fixture } from './fixtures.ts'

function database() {
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec(readFileSync(new URL('../migrations/0001_state.sql', import.meta.url), 'utf8'))
  sqlite
    .prepare('INSERT INTO app_state VALUES(1, ?, 0, ?)')
    .run(JSON.stringify(fixture()), '2026-11-10T00:00:00Z')
  return {
    prepare(query: string) {
      const statement = sqlite.prepare(query)
      let params: (string | number)[] = []
      const prepared = {
        bind(...values: (string | number)[]) {
          params = values
          return prepared
        },
        async first() {
          return statement.get(...params) ?? null
        },
        async run() {
          return { meta: { changes: Number(statement.run(...params).changes) } }
        },
      }
      return prepared
    },
    sqlite,
  }
}
function call(request: Request, env: Record<string, unknown>) {
  return onRequest({ request, env } as unknown as Parameters<
    typeof onRequest
  >[0]) as Promise<Response>
}
const localEnv = () => ({ DB: database(), OWNER_EMAIL: 'runner@example.test', DEV_AUTH: 'true' })
function update(revision: number, note: string, origin = 'http://localhost') {
  return new Request('http://localhost/api/state', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      revision,
      command: { type: 'session.patch', id: 'w1-a', patch: { note } },
    }),
  })
}
test('production fails closed without Access configuration, even with local dev flag', async () => {
  const response = await call(new Request('https://training.pages.dev/api/state'), localEnv())
  assert.equal(response.status, 503)
  assert.equal((await response.json()).state, undefined)
})
test('JWT signature, issuer, audience, expiry and exact owner email are enforced', async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256')
  const jwk = { ...(await exportJWK(publicKey)), kid: 'test', alg: 'RS256' }
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ keys: [jwk] }), {
      headers: { 'Content-Type': 'application/json' },
    })
  try {
    const issuer = 'https://test-training.cloudflareaccess.com'
    const env = {
      DB: database(),
      OWNER_EMAIL: 'runner@example.test',
      ACCESS_TEAM_DOMAIN: 'test-training.cloudflareaccess.com',
      ACCESS_AUD: 'expected-audience',
    }
    const token = async (email: string, audience = 'expected-audience', exp = '1h', iss = issuer) =>
      new SignJWT({ email })
        .setProtectedHeader({ alg: 'RS256', kid: 'test' })
        .setIssuer(iss)
        .setAudience(audience)
        .setIssuedAt()
        .setExpirationTime(exp)
        .sign(privateKey)
    const get = (jwt?: string) =>
      call(
        new Request('https://training.pages.dev/api/state', {
          headers: jwt ? { 'Cf-Access-Jwt-Assertion': jwt } : {},
        }),
        env,
      )
    assert.equal((await get()).status, 401)
    assert.equal((await get('forged')).status, 401)
    assert.equal((await get(await token('other@example.test'))).status, 403)
    assert.equal((await get(await token('runner@example.test', 'wrong'))).status, 401)
    assert.equal(
      (await get(await token('runner@example.test', 'expected-audience', '-1h'))).status,
      401,
    )
    assert.equal(
      (
        await get(
          await token(
            'runner@example.test',
            'expected-audience',
            '1h',
            'https://wrong.cloudflareaccess.com',
          ),
        )
      ).status,
      401,
    )
    const valid = await get(await token('runner@example.test'))
    assert.equal(valid.status, 200)
    assert.equal(valid.headers.get('Cache-Control'), 'private, no-store')
    assert.equal((await valid.json()).state.schemaVersion, 1)
  } finally {
    globalThis.fetch = originalFetch
  }
})
test('mutations reject foreign origins and stale revisions without losing saved notes', async () => {
  const env = localEnv()
  assert.equal((await call(update(0, 'bad', 'https://attacker.test'), env)).status, 403)
  assert.equal((await call(update(0, 'First device'), env)).status, 200)
  const stale = await call(update(0, 'Stale device'), env)
  assert.equal(stale.status, 409)
  const body = await stale.json()
  assert.equal(body.state.progress['w1-a'].note, 'First device')
  assert.equal(body.revision, 1)
})
test('simultaneous device writes accept one revision and return the winner to the other', async () => {
  const env = localEnv()
  const responses = await Promise.all([call(update(0, 'One'), env), call(update(0, 'Two'), env)])
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409])
  const state = await (await call(new Request('http://localhost/api/state'), env)).json()
  assert.equal(state.revision, 1)
  assert.ok(['One', 'Two'].includes(state.state.progress['w1-a'].note))
})
