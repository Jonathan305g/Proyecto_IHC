require('reflect-metadata')
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createApplication } = require('../dist/application')
const { DatabaseService } = require('../dist/database.service')
const { AuthGuard } = require('../dist/auth.guard')

test('S3-04 HTTP: tres rutas privadas, validación y contrato de errores', async () => {
  const keys = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'AUTH_ALLOWED_EMAILS']
  const saved = keys.map(key => process.env[key])
  Object.assign(process.env, {
    DATABASE_URL: 'postgres://test:test@127.0.0.1:1/test', SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'test', AUTH_ALLOWED_EMAILS: 'equipo@example.com',
  })
  let app
  try {
    app = await createApplication(false)
    // Se conserva canActivate y su registro global; solo se controla el emisor externo.
    let email = 'equipo@example.com', confirmed = true
    app.get(AuthGuard).client = { auth: { getUser: async token => token === 'valid'
      ? { data: { user: { email, email_confirmed_at: confirmed ? '2026-01-01' : null } } }
      : { data: {}, error: new Error('expired') } } }
    let queries = 0, fail = false
    const report = { version: '1.0', filtro_valido: true, error_filtro: null,
      filtros: { plan_id: '101', desde: null, hasta: null, tarea_ids: null },
      sesiones_incluidas: 0, tareas_seleccionadas: 0, general: { esperados: 0 }, por_tarea: [] }
    app.get(DatabaseService).query = async (_sql, params) => {
      queries++
      if (fail) throw new Error('postgres://usuario:secreto@privado/base')
      if (params[0] === '999') return { rows: [{ reporte: { filtro_valido: false, error_filtro: 'PLAN_INEXISTENTE' } }] }
      return { rows: [{ reporte: report }] }
    }
    await app.listen(0, '127.0.0.1')
    const base = `${await app.getUrl()}/api/planes`
    const send = async (path, token = 'valid') => {
      const response = await fetch(`${base}/${path}`, { headers: token === null ? {} : { Authorization: `Bearer ${token}` } })
      return { status: response.status, body: await response.json(), headers: response.headers }
    }
    for (const suffix of ['', '/general', '/tareas']) {
      const route = `101/indicadores${suffix}`
      for (const token of [null, 'expired']) {
        const response = await send(route, token)
        assert.equal(response.status, 401)
        assert.equal(response.body.code, 'UNAUTHORIZED')
        assert.deepEqual(Object.keys(response.body), ['code', 'message', 'details'])
      }
      email = 'ajeno@example.com'
      assert.equal((await send(route)).status, 403)
      email = 'equipo@example.com'; confirmed = false
      assert.equal((await send(route)).status, 403)
      confirmed = true
      assert.equal(queries, suffix === '' ? 0 : suffix === '/general' ? 1 : 2)
      const response = await send(route)
      const expected = { ...report }
      if (suffix === '/general') delete expected.por_tarea
      if (suffix === '/tareas') delete expected.general
      assert.equal(response.status, 200)
      assert.deepEqual(response.body, expected)
      assert.equal(response.headers.get('Cache-Control'), 'no-store')
      assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff')
    }
    for (const suffix of ['', '/general', '/tareas']) {
      const before = queries
      for (const query of ['?desde=2026-02-29T00:00:00Z', '?tarea_ids=', '?tarea_ids=1001&tarea_ids=1002',
        '?desde=2026-10-20T00:00:00Z&desde=2026-10-21T00:00:00Z', '?plan_id=202',
        '?hasta=2026-10-20T00:00:00', '?tarea_ids[]=1001', '?tarea_ids=1001%2C1001']) {
        const response = await send(`101/indicadores${suffix}${query}`)
        assert.equal(response.status, 400, query)
        assert.equal(response.body.code, 'INVALID_REQUEST')
        assert.deepEqual(Object.keys(response.body), ['code', 'message', 'details'])
      }
      assert.equal(queries, before)
      assert.equal((await send(`0/indicadores${suffix}`)).status, 400)
      const missing = await send(`999/indicadores${suffix}`)
      assert.equal(missing.status, 404)
      assert.deepEqual(missing.body, { code: 'NOT_FOUND', message: 'El plan no existe.', details: [{ field: 'plan_id', rule: 'PLAN_INEXISTENTE' }] })
    }
    fail = true
    assert.deepEqual((await send('101/indicadores')).body, {
      code: 'INTERNAL_ERROR', message: 'No se pudo completar la solicitud.', details: [],
    })
  } finally {
    if (app) await app.close()
    keys.forEach((key, i) => { if (saved[i] === undefined) delete process.env[key]; else process.env[key] = saved[i] })
  }
})
