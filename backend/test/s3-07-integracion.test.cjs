require('reflect-metadata')
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const { randomUUID } = require('node:crypto')
const { PGlite } = require('@electric-sql/pglite')
const { createApplication } = require('../dist/application')
const { DatabaseService } = require('../dist/database.service')
const { AuthGuard } = require('../dist/auth.guard')
const { ProveedorIA } = require('../dist/analisis-ia/proveedor')
const { AnalisisService } = require('../dist/analisis-ia/analisis.service')

test('S3-07 integración: HTTP privado, SQL canónico, grupos durables y recuperación', async t => {
  const keys = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'AUTH_ALLOWED_EMAILS']
  const saved = keys.map(k => process.env[k])
  Object.assign(process.env, { DATABASE_URL: 'postgres://test:test@127.0.0.1:1/test',
    SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'test', AUTH_ALLOWED_EMAILS: 'equipo@example.com' })
  const pg = new PGlite()
  let app
  try {
    await pg.exec(await fs.readFile(path.join(__dirname, '../../database/01_esquema.sql'), 'utf8'))
    const migration = await fs.readFile(path.join(__dirname, '../migrations/20261118000000_s3_07_ejecuciones_ia.sql'), 'utf8')
    await pg.exec("INSERT INTO public.planes(id,nombre,objetivo) OVERRIDING SYSTEM VALUE VALUES (101,'IA','Probar'),(202,'Otro','Aislamiento'); INSERT INTO public.analisis_ia(plan_id) VALUES(101);")
    await pg.exec(migration); await pg.exec(migration)
    await pg.exec(`
      INSERT INTO public.tareas(id,plan_id,titulo,descripcion,criterio_exito,orden) OVERRIDING SYSTEM VALUE VALUES
        (1001,101,'Guardar','Guardar cambios','Reconocer confirmación',1),(2001,202,'Otra','Otro plan',null,1);
      INSERT INTO public.participantes(id,codigo) OVERRIDING SYSTEM VALUE VALUES(1,'S307-ANONIMO');
      INSERT INTO public.sesiones(id,plan_id,participante_id,estado,consentimiento_confirmado,iniciada_en,cerrada_en)
        OVERRIDING SYSTEM VALUE SELECT n,101,1,'cerrada',true,'2026-11-01T10:00Z'::timestamptz,'2026-11-01T11:00Z'::timestamptz FROM generate_series(1,57)n;
      INSERT INTO public.sesiones(id,plan_id,participante_id,estado,consentimiento_confirmado,iniciada_en,cerrada_en)
        OVERRIDING SYSTEM VALUE VALUES(61,202,1,'cerrada',true,'2026-11-01T10:00Z','2026-11-01T11:00Z');
      INSERT INTO public.resultados(id,plan_id,sesion_id,tarea_id,completada,observaciones)
        OVERRIDING SYSTEM VALUE SELECT n,101,n,1001,true,'La confirmación pasó desapercibida.' FROM generate_series(1,56)n;
      INSERT INTO public.resultados(id,plan_id,sesion_id,tarea_id,completada,observaciones)
        OVERRIDING SYSTEM VALUE VALUES(61,202,61,2001,true,'Otro plan'),(9007199254740993,101,57,1001,true,'Necesitó ayuda.');
      UPDATE public.sesiones SET estado='en_curso',cerrada_en=null WHERE id=52;
      UPDATE public.sesiones SET consentimiento_confirmado=false WHERE id=53;
      UPDATE public.resultados SET completada=null WHERE id=54;
      UPDATE public.resultados SET observaciones='   ' WHERE id=55;
      UPDATE public.sesiones SET iniciada_en=null,cerrada_en=null WHERE id=56;
    `)
    app = await createApplication(false)
    let email = 'equipo@example.com', confirmed = true
    app.get(AuthGuard).client = { auth: { getUser: async token => token === 'valid'
      ? { data: { user: { email, email_confirmed_at: confirmed ? '2026-01-01' : null } } }
      : { data: {}, error: Error('expired') } } }
    const convert = result => ({ rows: result.rows.map(row => Object.fromEntries(Object.entries(row)
      .map(([key, value]) => [key, typeof value === 'bigint' ? String(value) : value]))), rowCount: result.affectedRows })
    const db = app.get(DatabaseService)
    db.query = async (sql, args = []) => convert(await pg.query(sql, args))
    db.transaction = op => pg.transaction(tx => op({ query: async (sql, args = []) => convert(await tx.query(sql, args)) }))
    const provider = app.get(ProveedorIA), demo = new ProveedorIA({ IA_MODE: 'demo' })
    let calls = [], handle = input => demo.analizar(input)
    provider.analizar = async input => { calls.push(structuredClone(input)); return handle(input) }
    await app.listen(0, '127.0.0.1')
    const base = `${await app.getUrl()}/api/planes`
    const route = (analysis = '', plan = '101') => `${plan}/analisis-ia${analysis ? `/${analysis}` : ''}`
    const send = async (url, method = 'GET', body, token = 'valid', raw = false) => {
      const res = await fetch(`${base}/${url}`, { method,
        headers: { 'Content-Type': 'application/json', ...(token === null ? {} : { Authorization: `Bearer ${token}` }) },
        ...(body === undefined ? {} : { body: raw ? body : JSON.stringify(body) }) })
      return { status: res.status, body: await res.json(), headers: res.headers }
    }
    const crear = async (ids = ['1'], solicitud_id = randomUUID()) => {
      const res = await send(route(), 'POST', { solicitud_id, resultado_ids: ids })
      assert.equal(res.status, 201, JSON.stringify(res.body)); return res.body
    }
    const revision = data => ({ observaciones: data.grupos.flatMap(g => g.solicitud.observaciones.map(o => ({
      resultado_id: o.id.slice(10), texto: o.texto, titulo_tarea: o.tarea.titulo, criterio_exito: o.tarea.criterio_exito,
    }))) })
    const preparar = async (ids = ['1']) => {
      const data = await crear(ids)
      const res = await send(route(`${data.id}/revision`), 'PUT', revision(data))
      assert.equal(res.status, 200, JSON.stringify(res.body)); return res.body
    }
    const ejecutar = data => send(route(`${data.id}/ejecutar`), 'POST', {})
    const retry = data => send(route(`${data.id}/reintentar`), 'POST', {})
    const ids51 = Array.from({ length: 51 }, (_, i) => String(i + 1))

    await t.test('migración repetible conserva análisis anteriores y la API no los ejecuta', async () => {
      const legacy = await send(route('1'))
      assert.equal(legacy.status, 404)
      assert.equal((await pg.query('SELECT count(*)::int AS n FROM public.analisis_ia WHERE ejecucion IS NULL')).rows[0].n, 1)
    })
    await t.test('las cinco rutas aplican AuthGuard, 401/403 y no llaman al proveedor', async () => {
      const requests = [[route(), 'POST', {}], [route('1'), 'GET'], [route('1/revision'), 'PUT', {}],
        [route('1/ejecutar'), 'POST', {}], [route('1/reintentar'), 'POST', {}]]
      for (const [url, method, body] of requests) {
        for (const token of [null, 'expired']) assert.equal((await send(url, method, body, token)).status, 401)
        email = 'ajeno@example.com'; assert.equal((await send(url, method, body)).status, 403)
        email = 'equipo@example.com'; confirmed = false; assert.equal((await send(url, method, body)).status, 403)
        confirmed = true
      }
      assert.equal(calls.length, 0)
    })
    await t.test('entrada malformada, IDs, selección vacía y relaciones falsificadas', async () => {
      const invalid = [null, [], {}, { solicitud_id: randomUUID(), resultado_ids: [] },
        { solicitud_id: randomUUID(), resultado_ids: ['1', '1'] }, { solicitud_id: randomUUID(), resultado_ids: [1] },
        { solicitud_id: randomUUID(), resultado_ids: ['9223372036854775808'] },
        { solicitud_id: randomUUID(), resultado_ids: ['1'], privacidad_revisada: true },
        { solicitud_id: randomUUID(), resultado_ids: ['1'], observaciones: [{ texto: 'Inventado' }] }]
      for (const body of invalid) assert.equal((await send(route(), 'POST', body)).status, 400)
      assert.equal((await send(route(), 'POST', '{', 'valid', true)).status, 400)
      const oversized = await send(route('1/revision'), 'PUT', { observaciones: ['x'.repeat(110 * 1024)] })
      assert.equal(oversized.status, 413)
      assert.equal(oversized.body.code, 'PAYLOAD_TOO_LARGE')
      assert.equal((await send(route('', '0'), 'POST', {})).status, 400)
      assert.equal((await send(route('', '999'), 'POST', { solicitud_id: randomUUID(), resultado_ids: ['1'] })).status, 404)
      assert.equal(calls.length, 0)
    })
    await t.test('SQL S3-02 rechaza la selección completa si hay una fuente ajena/no elegible', async () => {
      for (const badId of ['61', '52', '53', '54', '55', '56', '999']) {
        const res = await send(route(), 'POST', { solicitud_id: randomUUID(), resultado_ids: ['1', badId] })
        assert.equal(res.status, 400, badId)
        assert.equal(res.body.details[0].rule, 'IA_ORIGEN_INVALIDO')
      }
      assert.equal(calls.length, 0)
    })
    await t.test('creación idempotente, estado pendiente y revisión vinculada a fuentes del servidor', async () => {
      const data = await crear(['9007199254740993', '1'])
      assert.equal(data.estado, 'pendiente'); assert.equal(data.revision_en, null)
      assert.equal((await crear(['1', '9007199254740993'], data.solicitud_id)).id, data.id)
      assert.equal((await send(route(), 'POST', { solicitud_id: data.solicitud_id, resultado_ids: ['1'] })).status, 409)
      const pending = await ejecutar(data)
      assert.equal(pending.status, 400); assert.equal(pending.body.details[0].rule, 'IA_PRIVACIDAD_PENDIENTE')
      const body = revision(data); body.observaciones[0].texto = 'Texto revisado por la persona autorizada.'
      body.observaciones[0].titulo_tarea = 'Guardar sin datos personales'
      const reviewed = await send(route(`${data.id}/revision`), 'PUT', body)
      assert.equal(reviewed.status, 200); assert.ok(reviewed.body.revision_en)
      assert.equal((await retry(data)).status, 409)
      const completed = await ejecutar(data)
      assert.equal(completed.status, 200); assert.equal(completed.body.estado, 'completado')
      assert.deepEqual(completed.body.grupos[0].respuesta.observaciones_sin_hallazgo, ['resultado:1', 'resultado:9007199254740993'])
      assert.equal(calls.at(-1).observaciones[0].texto, body.observaciones[0].texto)
      assert.equal(calls.at(-1).observaciones[0].tarea.id, '1001')
      assert.equal(completed.body.grupos[0].meta.modo, 'demo'); assert.ok(completed.body.grupos[0].meta.advertencia)
      const before = calls.length
      assert.equal((await ejecutar(data)).status, 200); assert.equal(calls.length, before)
      assert.equal((await send(route(`${data.id}/revision`), 'PUT', body)).status, 409)
      assert.equal(completed.headers.get('Cache-Control'), 'no-store')
      assert.equal(completed.headers.get('X-Content-Type-Options'), 'nosniff')
    })
    await t.test('revisión exige cobertura exacta, rechaza texto vacío y banderas del cliente', async () => {
      const data = await crear(['1', '2'])
      const body = revision(data)
      for (const observations of [[body.observaciones[0]], [{ ...body.observaciones[0], resultado_id: '61' }, body.observaciones[1]],
        [{ ...body.observaciones[0], texto: '' }, body.observaciones[1]]]) {
        assert.equal((await send(route(`${data.id}/revision`), 'PUT', { observaciones: observations })).status, 400)
      }
      assert.equal((await send(route(`${data.id}/ejecutar`), 'POST', { privacidad_revisada: true })).status, 400)
      assert.equal((await send(route(`${data.id}/reintentar`), 'POST', { plan_id: '202' })).status, 400)
      assert.equal((await send(route(data.id))).body.revision_en, null)
    })
    await t.test('aislamiento del plan en consulta, revisión, ejecución y reintento', async () => {
      const data = await crear()
      for (const [suffix, method, body] of [['', 'GET'], ['/revision', 'PUT', revision(data)],
        ['/ejecutar', 'POST', {}], ['/reintentar', 'POST', {}]]) {
        assert.equal((await send(route(`${data.id}${suffix}`, '202'), method, body)).status, 404)
      }
    })
    await t.test('dos grupos: conserva borradores válidos y reintenta solo el fallido sin duplicar', async () => {
      const data = await preparar(ids51)
      const start = calls.length
      handle = async input => {
        if (input.observaciones[0].id === 'resultado:51') return { ok: false, error: { code: 'IA_TIEMPO_AGOTADO' }, meta: { estado: 'fallido', modo: 'gemini', proveedor: 'gemini', modelo: 'gemini-test', intentos: 1 } }
        const valid = await demo.analizar(input)
        valid.data.hallazgos = [{ observacion_ids: input.observaciones.map(o => o.id), resumen: 'Confirmación poco visible.',
          categoria: 'retroalimentacion', severidad: 'media', mejora_sugerida: 'Mostrar un mensaje claro.' }]
        valid.data.observaciones_sin_hallazgo = []
        return valid
      }
      const partial = await ejecutar(data)
      assert.equal(partial.status, 200); assert.equal(partial.body.estado, 'parcial')
      assert.equal(calls.length, start + 2)
      const accepted = partial.body.grupos[0]
      assert.equal(accepted.respuesta.estado, 'borrador')
      assert.equal(accepted.respuesta.hallazgos[0].observacion_ids.length, 50)
      assert.equal(partial.body.grupos[1].error.code, 'IA_TIEMPO_AGOTADO')
      assert.equal((await ejecutar(data)).status, 409)
      handle = input => demo.analizar(input)
      const completed = await retry(data)
      assert.equal(completed.status, 200); assert.equal(completed.body.estado, 'completado')
      assert.deepEqual(completed.body.grupos[0], accepted)
      assert.equal(completed.body.grupos[1].intentos, 2)
      assert.equal(calls.length, start + 3)
      assert.deepEqual(calls.at(-1).observaciones.map(o => o.id), ['resultado:51'])
      assert.equal((await retry(data)).status, 200); assert.equal(calls.length, start + 3)
    })
    await t.test('en curso es observable, bloquea concurrencia del análisis y del plan', async () => {
      const data = await preparar(), other = await preparar(['2'])
      let release, entered
      const ready = new Promise(resolve => { entered = resolve })
      handle = input => new Promise(resolve => { release = async () => resolve(await demo.analizar(input)); entered() })
      const running = ejecutar(data)
      try {
        await ready
        const state = await send(route(data.id))
        assert.equal(state.body.estado, 'procesando'); assert.equal(state.body.grupos[0].estado, 'procesando')
        const before = calls.length
        assert.equal((await ejecutar(data)).status, 409)
        assert.equal((await ejecutar(other)).status, 409)
        assert.equal((await retry(data)).status, 409)
        assert.equal(calls.length, before)
        await assert.rejects(pg.query('INSERT INTO public.analisis_ia(plan_id,bloqueo) VALUES(101,$1)', [randomUUID()]),
          error => error.code === '23505', 'El índice también impide dos reservas desde conexiones ajenas al servicio')
      } finally { await release(); assert.equal((await running).status, 200); handle = input => demo.analizar(input) }
    })
    await t.test('contrato inválido se persiste fallido, HTTP 422 controlado y reintentos acotados', async () => {
      const data = await preparar(), before = calls.length
      handle = async () => ({ ok: true, data: { estado: 'aprobado', secreto: 'no-exponer' }, meta: { modo: 'gemini' } })
      for (let n = 1; n <= 3; n++) {
        const res = n === 1 ? await ejecutar(data) : await retry(data)
        assert.equal(res.status, 422); assert.equal(res.body.details[1].rule, 'IA_ESQUEMA_INVALIDO')
        assert.equal(res.body.code, 'HTTP_ERROR')
        assert.ok(!JSON.stringify(res.body).includes('no-exponer'))
      }
      assert.equal((await retry(data)).status, 409); assert.equal(calls.length, before + 3)
      const failed = (await send(route(data.id))).body
      assert.equal(failed.estado, 'fallido'); assert.equal(failed.grupos[0].intentos, 3)
      assert.equal(failed.grupos[0].reintentable, false); assert.equal(failed.grupos[0].respuesta, undefined)
      handle = input => demo.analizar(input)
    })
    await t.test('configuración/red/proveedor fallido: HTTP 503, sin secretos ni fallback', async () => {
      for (const code of ['IA_CONFIGURACION_INVALIDA', 'IA_ERROR_CONEXION', 'IA_PROVEEDOR_NO_DISPONIBLE']) {
        const data = await preparar()
        handle = async () => ({ ok: false, error: { code, message: 'credencial-no-exponer', details: ['privado'] }, meta: { modo: 'disabled' } })
        const res = await ejecutar(data)
        assert.equal(res.status, 503); assert.equal(res.body.code, 'SERVICE_UNAVAILABLE')
        assert.equal(res.body.details[1].rule, code)
        assert.ok(!JSON.stringify((await send(route(data.id))).body).includes('credencial-no-exponer'))
      }
      handle = input => demo.analizar(input)
    })
    await t.test('reinicio recupera el diario y reserva vencida conserva el grupo completado', async () => {
      const data = await preparar(ids51)
      const result = await ejecutar(data); assert.equal(result.status, 200)
      const stored = (await pg.query('SELECT ejecucion FROM public.analisis_ia WHERE id=$1', [data.id])).rows[0].ejecucion
      const accepted = stored.grupos[0]
      stored.grupos[1].estado = 'procesando'; delete stored.grupos[1].respuesta
      // Simula caída después del commit del primer grupo y antes de persistir el segundo.
      await pg.query("UPDATE public.analisis_ia SET estado='procesando',ejecucion=$2::jsonb,bloqueo=$3,bloqueado_hasta=clock_timestamp()-interval '1 second',terminado_en=null WHERE id=$1",
        [data.id, JSON.stringify(stored), randomUUID()])
      const restarted = new AnalisisService(db, provider)
      const recovered = await restarted.consultar('101', data.id)
      assert.equal(recovered.estado, 'parcial')
      assert.deepEqual(recovered.grupos[0].respuesta, accepted.respuesta)
      assert.equal(recovered.grupos[1].error.code, 'IA_EJECUCION_INTERRUMPIDA')
      const before = calls.length
      const retried = await restarted.ejecutar('101', data.id, {}, true)
      assert.equal(retried.estado, 'completado'); assert.equal(calls.length, before + 1)
      assert.deepEqual(retried.grupos[0].respuesta, accepted.respuesta)
    })
    await t.test('un trabajador vencido no sobrescribe resultados de una reserva nueva', async () => {
      const data = await preparar()
      let release, entered
      const ready = new Promise(resolve => { entered = resolve })
      handle = input => new Promise(resolve => { release = async () => resolve(await demo.analizar(input)); entered() })
      const running = ejecutar(data)
      await ready
      await pg.query("UPDATE public.analisis_ia SET bloqueado_hasta=clock_timestamp()-interval '1 second' WHERE id=$1", [data.id])
      assert.equal((await send(route(data.id))).body.estado, 'fallido')
      handle = input => demo.analizar(input)
      const retried = await retry(data); assert.equal(retried.status, 200)
      await release()
      assert.equal((await running).status, 409)
      assert.deepEqual((await send(route(data.id))).body, retried.body)
    })
    await t.test('un fallo al guardar otro grupo conserva el avance confirmado y permite recuperarlo', async () => {
      const data = await preparar(ids51), actualQuery = db.query
      let writes = 0
      db.query = async (sql, args) => {
        if (sql.includes('AND bloqueo=$6') && ++writes === 2) throw Error('Conexión privada interrumpida')
        return actualQuery(sql, args)
      }
      try { assert.equal((await ejecutar(data)).status, 500) }
      finally { db.query = actualQuery }
      const interrupted = (await send(route(data.id))).body
      assert.equal(interrupted.grupos[0].estado, 'completado')
      assert.equal(interrupted.grupos[1].estado, 'procesando')
      await pg.query("UPDATE public.analisis_ia SET bloqueado_hasta=clock_timestamp()-interval '1 second' WHERE id=$1", [data.id])
      assert.equal((await send(route(data.id))).body.estado, 'parcial')
      const before = calls.length, completed = await retry(data)
      assert.equal(completed.status, 200); assert.equal(calls.length, before + 1)
      assert.deepEqual(completed.body.grupos[0].respuesta, interrupted.grupos[0].respuesta)
    })
    await t.test('fuentes modificadas o consentimiento revocado impiden ejecutar el snapshot', async () => {
      const data = await preparar(), before = calls.length
      await pg.query("UPDATE public.resultados SET observaciones='Cambió después de la revisión' WHERE id=1")
      assert.equal((await ejecutar(data)).status, 409)
      await pg.query("UPDATE public.resultados SET observaciones='La confirmación pasó desapercibida.' WHERE id=1")
      await pg.query('UPDATE public.sesiones SET consentimiento_confirmado=false WHERE id=1')
      assert.equal((await ejecutar(data)).status, 400)
      await pg.query('UPDATE public.sesiones SET consentimiento_confirmado=true WHERE id=1')
      assert.equal(calls.length, before)
    })
    await t.test('errores de BD ocultos y ninguna aprobación, hallazgo o historia creada', async () => {
      const actual = db.transaction
      db.transaction = async () => { throw Error('postgres://usuario:secreto@privado') }
      try {
        const res = await send(route('2'))
        assert.equal(res.status, 500)
        assert.deepEqual(res.body, { code: 'INTERNAL_ERROR', message: 'No se pudo completar la solicitud.', details: [] })
      } finally { db.transaction = actual }
      for (const table of ['hallazgos', 'historias']) assert.equal((await pg.query(`SELECT count(*)::int AS n FROM public.${table}`)).rows[0].n, 0)
      assert.equal((await pg.query('SELECT observaciones FROM public.resultados WHERE id=1')).rows[0].observaciones, 'La confirmación pasó desapercibida.')
    })
  } finally {
    if (app) await app.close()
    await pg.close()
    keys.forEach((key, i) => { if (saved[i] === undefined) delete process.env[key]; else process.env[key] = saved[i] })
  }
})
