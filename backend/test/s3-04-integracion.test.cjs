require('reflect-metadata')
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const { PGlite } = require('@electric-sql/pglite')
const { createApplication } = require('../dist/application')
const { DatabaseService } = require('../dist/database.service')
const { IndicatorsService } = require('../dist/indicators.service')
const { AuthGuard } = require('../dist/auth.guard')
const { normalizeError } = require('../dist/api-error.filter')
const root = path.join(__dirname, '../../database')

function queryFrom([, desde, hasta, tarea_ids]) {
  return {
    ...(desde === null ? {} : { desde }), ...(hasta === null ? {} : { hasta }),
    ...(tarea_ids === null ? {} : { tarea_ids: tarea_ids.map(String).join(',') }),
  }
}

test('S3-04 integración: servicio y HTTP contra los 15 casos oficiales en PostgreSQL desechable', async t => {
  const keys = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'AUTH_ALLOWED_EMAILS']
  const saved = keys.map(key => process.env[key])
  Object.assign(process.env, {
    DATABASE_URL: 'postgres://test:test@127.0.0.1:1/test', SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'test', AUTH_ALLOWED_EMAILS: 'equipo@example.com',
  })
  const pg = new PGlite()
  let app
  try {
    await pg.exec(await fs.readFile(path.join(root, '01_esquema.sql'), 'utf8'))
    await pg.exec("SET ihc.s301_fixture = 'true'; SET TIME ZONE 'UTC';")
    await pg.exec(await fs.readFile(path.join(root, 'sprint3/s3-01/datos_verificacion.sql'), 'utf8'))
    // OVERRIDING SYSTEM VALUE no avanza las secuencias del fixture. Preparar
    // altas posteriores solo en esta BD desechable; conservar el fixture oficial.
    await pg.exec(`
      SELECT setval(pg_get_serial_sequence('public.planes','id'), (SELECT max(id) FROM public.planes));
      SELECT setval(pg_get_serial_sequence('public.tareas','id'), (SELECT max(id) FROM public.tareas));
      SELECT setval(pg_get_serial_sequence('public.participantes','id'), (SELECT max(id) FROM public.participantes));
      SELECT setval(pg_get_serial_sequence('public.sesiones','id'), (SELECT max(id) FROM public.sesiones));
      SELECT setval(pg_get_serial_sequence('public.resultados','id'), (SELECT max(id) FROM public.resultados));
    `)
    const sql = await fs.readFile(path.join(root, 'sprint3/s3-01/metricas.sql'), 'utf8')
    const cases = JSON.parse(await fs.readFile(path.join(root, 'sprint3/s3-01/resultados_esperados.json'), 'utf8')).casos
    assert.equal(cases.length, 15)
    app = await createApplication(false)
    app.get(AuthGuard).client = { auth: { getUser: async token => token === 'valid'
      ? { data: { user: { email: 'equipo@example.com', email_confirmed_at: '2026-01-01' } } }
      : { data: {}, error: new Error('expired') } } }
    // Solo se adapta el transporte de BD. Servicios, SQL, controladores y guard son reales.
    const convert = result => {
      const bigintFields = new Set(result.fields.filter(field => field.dataTypeID === 20).map(field => field.name))
      return { rows: result.rows.map(row => Object.fromEntries(Object.entries(row)
        .map(([key, value]) => [key, value !== null && bigintFields.has(key) ? String(value) : value]))), rowCount: result.affectedRows }
    }
    let queries = 0
    const db = app.get(DatabaseService)
    db.query = async (sql, params = []) => { queries++; return convert(await pg.query(sql, params)) }
    db.transaction = op => pg.transaction(tx => op({ query: async (sql, params = []) => convert(await tx.query(sql, params)) }))
    const service = app.get(IndicatorsService)
    await app.listen(0, '127.0.0.1')
    const base = `${await app.getUrl()}/api`
    const send = async (route, method = 'GET', body) => {
      const response = await fetch(`${base}${route}`, { method,
        headers: { Authorization: 'Bearer valid', 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
      return { status: response.status, body: await response.json() }
    }
    const route = (plan, query, suffix = '') => `/planes/${plan}/indicadores${suffix}?${new URLSearchParams(query)}`
    const report = async (plan, query = {}) => {
      const response = await send(route(plan, query))
      assert.equal(response.status, 200, JSON.stringify(response.body))
      return response.body
    }
    for (const example of cases) await t.test(example.nombre, async () => {
      const params = example.parametros, plan = String(params[0]), query = queryFrom(params)
      if (example.esperado.filtro_valido === false) {
        const status = example.esperado.error_filtro === 'PLAN_INEXISTENTE' ? 404 : 400
        await assert.rejects(service.report(plan, query), e => normalizeError(e).status === status)
        for (const suffix of ['', '/general', '/tareas']) {
          const response = await send(route(plan, query, suffix))
          assert.equal(response.status, status)
          assert.equal(response.body.code, status === 404 ? 'NOT_FOUND' : 'INVALID_REQUEST')
          assert.deepEqual(Object.keys(response.body), ['code', 'message', 'details'])
          assert.ok(response.body.details.length > 0)
        }
      } else {
        const before = queries
        const actual = await service.report(plan, query)
        assert.equal(queries, before + 1, 'Una instantánea SQL por reporte')
        for (const [key, expected] of Object.entries(example.esperado)) assert.deepEqual(actual[key], expected, key)
        assert.deepEqual(actual, (await pg.query(sql, params)).rows[0].reporte)
        for (const suffix of ['', '/general', '/tareas']) {
          const expected = { ...actual }
          if (suffix === '/general') delete expected.por_tarea
          if (suffix === '/tareas') delete expected.general
          const response = await send(route(plan, query, suffix))
          assert.equal(response.status, 200)
          assert.deepEqual(response.body, expected)
        }
      }
    })
    await t.test('fecha de cierre semiabierta, offsets, microsegundos y límites unilaterales', async () => {
      const utc = await report('101', { desde: '2026-10-20T00:00:00Z', hasta: '2026-10-21T00:00:00Z' })
      assert.deepEqual(utc, await report('101', { desde: '2026-10-19T19:00:00-05:00', hasta: '2026-10-20T19:00:00-05:00' }))
      assert.equal(utc.sesiones_incluidas, 2)
      const inclusive = await report('101', { desde: '2026-10-21T00:00:00Z', hasta: '2026-10-21T00:00:00.000001Z' })
      assert.equal(inclusive.sesiones_incluidas, 1)
      assert.equal(inclusive.general.evaluados, 2)
      assert.equal((await report('101', { desde: '2026-10-21T00:00:00.000001Z', hasta: '2026-10-22T00:00:00Z' })).sesiones_incluidas, 0)
      assert.equal((await report('101')).sesiones_incluidas, 4)
      assert.equal((await report('101', { hasta: '2026-10-21T00:00:00Z' })).sesiones_incluidas, 2)
      assert.equal((await report('101', { desde: '2026-11-01T00:00:00Z' })).general.evaluados, 1)
    })
    await t.test('selección múltiple por IDs y restablecimiento conserva el plan', async () => {
      const subset = await report('101', { ...queryFrom(cases[0].parametros), tarea_ids: '1002,1001' })
      assert.deepEqual(subset.filtros.tarea_ids, ['1001', '1002'])
      assert.deepEqual(subset.por_tarea.map(task => task.tarea_id), ['1001', '1002'])
      assert.equal(subset.general.esperados, 6)
      assert.equal(subset.general.pendientes, 0)
      const reset = await report('101')
      assert.deepEqual(reset.filtros, { plan_id: '101', desde: null, hasta: null, tarea_ids: null })
      assert.equal(reset.tareas_seleccionadas, 3)
    })
    await t.test('BIGINT exactos y plan con tareas pero sin sesiones', async () => {
      await pg.query("INSERT INTO public.planes(id,nombre,objetivo) OVERRIDING SYSTEM VALUE VALUES ($1,'BIGINT','Sin sesiones')", ['9223372036854775807'])
      await pg.query("INSERT INTO public.tareas(id,plan_id,titulo,descripcion,orden) OVERRIDING SYSTEM VALUE VALUES ($1,$2,'Tarea','Sin sesiones',1)", ['9007199254740993', '9223372036854775807'])
      const empty = await report('9223372036854775807', { tarea_ids: '9007199254740993' })
      assert.equal(empty.filtros.plan_id, '9223372036854775807')
      assert.equal(empty.por_tarea[0].tarea_id, '9007199254740993')
      assert.equal(empty.sesiones_incluidas, 0)
      assert.equal(empty.tareas_seleccionadas, 1)
      assert.equal(empty.general.esperados, 0)
      assert.equal(empty.general.cobertura_porcentaje, null)
      for (const value of Object.values(empty.por_tarea[0].por_resultado)) {
        assert.equal(value.cantidad, 0)
        assert.equal(value.porcentaje, null)
        assert.equal(value.tiempo.total_segundos, null)
        assert.equal(value.errores.total, null)
      }
    })
    await t.test('HTTP integrado: crear plan, ejecutar sesión, adjuntar evidencias, cerrar y consultar', async () => {
      const created = await send('/planes', 'POST', { nombre: 'Flujo S3-04', objetivo: 'Comprobar integración',
        tareas: [{ titulo: 'Guardar', descripcion: 'Guardar cambios', orden: 1 }] })
      assert.equal(created.status, 201)
      const plan = created.body.id, task = created.body.tareas[0].id
      assert.equal((await report(plan)).sesiones_incluidas, 0)
      const session = await send('/sesiones', 'POST', { plan_id: plan, consentimiento_confirmado: true })
      assert.equal(session.status, 201)
      const sessionId = session.body.id
      const saved = await send(`/sesiones/${sessionId}/resultados/${task}`, 'PUT', { resultado: 'con_ayuda', tiempo_segundos: 45, errores: 2 })
      assert.equal(saved.status, 200)
      for (let n = 0; n < 2; n++) {
        assert.equal((await send(`/sesiones/${sessionId}/resultados/${task}/evidencias`, 'POST', { tipo: 'enlace', ruta: `https://example.org/s304-${n}` })).status, 201)
      }
      assert.equal((await report(plan)).general.evaluados, 0, 'Una sesión en curso aún no se incluye')
      assert.equal((await send(`/sesiones/${sessionId}`, 'PATCH', { accion: 'cerrar' })).status, 200)
      const closed = await report(plan)
      assert.equal(closed.sesiones_incluidas, 1)
      assert.equal(closed.general.esperados, 1)
      assert.equal(closed.general.evaluados, 1)
      assert.equal(closed.general.pendientes, 0)
      assert.equal(closed.general.cobertura_porcentaje, 100)
      assert.deepEqual(closed.general.por_resultado.con_ayuda, { cantidad: 1, porcentaje: 100,
        tiempo: { n: 1, total_segundos: 45, promedio_segundos: 45 }, errores: { n: 1, total: 2, promedio: 2 } })
      assert.equal(closed.por_tarea[0].tarea_id, task)
    })
    await t.test('lectura sin duplicación por evidencias ni cambios en resultados existentes', async () => {
      const query = queryFrom(cases[0].parametros), before = await report('101', query)
      const results = (await pg.query('SELECT * FROM public.resultados WHERE plan_id=101 ORDER BY id')).rows
      await pg.query("INSERT INTO public.evidencias(resultado_id,tipo,ruta) VALUES (1,'enlace','https://example.org/s304-extra')")
      assert.deepEqual(await report('101', query), before)
      assert.deepEqual((await pg.query('SELECT * FROM public.resultados WHERE plan_id=101 ORDER BY id')).rows, results)
    })
  } finally {
    if (app) await app.close()
    await pg.close()
    keys.forEach((key, i) => { if (saved[i] === undefined) delete process.env[key]; else process.env[key] = saved[i] })
  }
})
