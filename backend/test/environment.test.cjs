const { test } = require('node:test')
const assert = require('node:assert/strict')
const { configurationIssues, readiness } = require('../scripts/environment.cjs')

const env = { DATABASE_URL: 'postgres://usuario:clave-prueba@db.proyecto.supabase.co:5432/postgres', DATABASE_SSL: 'true',
  SUPABASE_URL: 'https://proyecto.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_prueba', SUPABASE_SECRET_KEY: 'sb_secret_prueba',
  AUTH_ALLOWED_EMAILS: 'William@uta.edu.ec', FRONTEND_ORIGIN: 'http://localhost:5173' }
const frontend = { VITE_SUPABASE_URL: env.SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY: env.SUPABASE_PUBLISHABLE_KEY, VITE_API_BASE_URL: 'http://localhost:3000' }

test('preflight rechaza plantillas, TLS desactivado y proyectos diferentes sin revelar valores', () => {
  const errors = configurationIssues({ ...env, DATABASE_SSL: 'false', AUTH_ALLOWED_EMAILS: 'integrante@example.com' }, { ...frontend, VITE_SUPABASE_URL: 'https://otro.supabase.co', VITE_CLAVE: 'sb_secret_no-debe-aparecer' })
  for (const field of ['DATABASE_SSL', 'AUTH_ALLOWED_EMAILS', 'VITE_SUPABASE_URL', 'VITE_CLAVE']) assert.ok(errors.some(e => e.field === field))
  assert.ok(!JSON.stringify(errors).includes('sb_secret_no-debe-aparecer'))
  assert.deepEqual(configurationIssues(env, frontend), [])
})

test('preflight falla antes de conectar si faltan credenciales', async () => {
  let called = false
  const checks = await readiness({ env: {}, frontend: {}, db: { query() { called = true } } })
  assert.ok(checks.some(c => !c.ok))
  assert.equal(called, false)
})

function dependencies({ missingUser = false, signup = false, storageError = false } = {}) {
  return { env, frontend,
    db: { async query(sql) {
      if (sql.includes('pg_class')) return { rows: [{ tablas: 15, protegidas: 15 }] }
      if (sql.includes('pg_constraint')) return { rows: [] }
      return { rows: missingUser ? [] : [{ email: 'william@uta.edu.ec', email_confirmed_at: new Date() }] }
    } },
    admin: { storage: { async getBucket() { return { data: { public: false, file_size_limit: 15728640 }, error: storageError } } } },
    fetcher: async () => ({ ok: true, json: async () => ({ disable_signup: !signup }) }),
  }
}

test('preflight no aprueba cuentas ausentes, registro abierto ni claves de Storage inválidas', async () => {
  const checks = await readiness(dependencies({ missingUser: true, signup: true, storageError: true }))
  assert.deepEqual(checks.filter(c => !c.ok).map(c => c.name), ['Cuentas autorizadas', 'Registro público desactivado', 'Bucket privado'])
})

test('preflight aprueba únicamente las comprobaciones efectuadas', async () => {
  const checks = await readiness(dependencies())
  assert.equal(checks.length, 5)
  assert.ok(checks.every(c => c.ok))
})
