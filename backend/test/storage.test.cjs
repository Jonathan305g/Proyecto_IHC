const { test } = require('node:test')
const assert = require('node:assert/strict')
const { StorageService } = require('../dist/storage.service')
const { DatabaseService } = require('../dist/database.service')

test('Storage privado solicita URL de descarga de 60 segundos y propaga fallos', async () => {
  const original = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SECRET_KEY }
  process.env.SUPABASE_URL = 'https://example.supabase.co'; process.env.SUPABASE_SECRET_KEY = 'test-only'
  try {
    const service = new StorageService(), calls = []
    const bucket = {
      createSignedUrl: async (...args) => { calls.push(args); return { data: { signedUrl: 'https://example.com/signed' } } },
      upload: async () => ({ error: new Error('provider detail') }),
      remove: async () => ({ error: new Error('provider detail') }),
    }
    service.client = { storage: { from: () => bucket } }
    assert.equal(await service.sign('2/4/abc', 'captura.png'), 'https://example.com/signed')
    assert.deepEqual(calls, [['2/4/abc', 60, { download: 'captura.png' }]])
    await assert.rejects(service.upload('2/4/abc', Buffer.from('test'), 'text/plain'), /almacenamiento compartido/)
    await assert.rejects(service.remove('2/4/abc'), /Reintenta/)
  } finally {
    if (original.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = original.url
    if (original.key === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = original.key
  }
})

test('la URI no puede desactivar la verificación TLS configurada', async () => {
  const names = ['DATABASE_URL', 'DATABASE_SSL', 'DATABASE_CA_CERT'], saved = names.map(k => process.env[k])
  Object.assign(process.env, { DATABASE_URL: 'postgres://test:test@localhost/test?sslmode=no-verify', DATABASE_SSL: 'true', DATABASE_CA_CERT: 'linea1\\nlinea2' })
  const db = new DatabaseService()
  try {
    assert.equal(db.pool.options.ssl.rejectUnauthorized, true)
    assert.equal(db.pool.options.ssl.ca, 'linea1\nlinea2')
    assert.ok(!db.pool.options.connectionString.includes('sslmode'))
  } finally {
    await db.onModuleDestroy()
    names.forEach((k, i) => { if (saved[i] === undefined) delete process.env[k]; else process.env[k] = saved[i] })
  }
})
