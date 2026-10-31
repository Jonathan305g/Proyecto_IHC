require('reflect-metadata')
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { NestFactory } = require('@nestjs/core')
const { AppModule } = require('../dist/app.module')
const { AuthGuard } = require('../dist/auth.guard')
const { DatabaseService } = require('../dist/database.service')
const { MAX_FILE_SIZE } = require('../dist/dto/evidencia.dto')

test('HTTP: acceso privado, equipo autorizado, archivos falsos y límite multipart', async () => {
  const keys = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'AUTH_ALLOWED_EMAILS']
  const original = keys.map(k => process.env[k])
  Object.assign(process.env, { DATABASE_URL: 'postgres://test:test@127.0.0.1:1/test', SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'test', AUTH_ALLOWED_EMAILS: 'equipo@example.com' })
  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false })
  try {
    const guard = app.get(AuthGuard)
    let email = 'ajeno@example.com'
    guard.client = { auth: { getUser: async token => token === 'valid' ? { data: { user: { email, email_confirmed_at: '2026-01-01' } } } : { data: {}, error: new Error('expired') } } }
    app.get(DatabaseService).query = async () => ({ rows: [] })
    app.setGlobalPrefix('api'); await app.listen(0, '127.0.0.1')
    const url = await app.getUrl()
    assert.equal((await fetch(`${url}/api/planes`)).status, 401)
    assert.equal((await fetch(`${url}/api/planes`, { headers: { Authorization: 'Bearer expired' } })).status, 401)
    assert.equal((await fetch(`${url}/api/planes`, { headers: { Authorization: 'Bearer valid' } })).status, 403)
    email = 'equipo@example.com'
    assert.equal((await fetch(`${url}/api/planes`, { headers: { Authorization: 'Bearer valid' } })).status, 200)
    const send = async (bytes, filename, mime) => {
      const body = new FormData(); body.append('archivo', new Blob([bytes], { type: mime }), filename)
      return fetch(`${url}/api/sesiones/2/resultados/4/evidencias`, { method: 'POST', headers: { Authorization: 'Bearer valid' }, body })
    }
    assert.equal((await send('no soy imagen', 'programa.exe', 'image/png')).status, 400)
    assert.equal((await send('no soy imagen', 'foto.png', 'image/png')).status, 400)
    assert.equal((await send(Buffer.alloc(MAX_FILE_SIZE + 1), 'grande.png', 'image/png')).status, 413)
    delete process.env.AUTH_ALLOWED_EMAILS
    assert.equal((await fetch(`${url}/api/planes`, { headers: { Authorization: 'Bearer valid' } })).status, 503)
  } finally {
    await app.close()
    keys.forEach((key, index) => { if (original[index] === undefined) delete process.env[key]; else process.env[key] = original[index] })
  }
})
