require('reflect-metadata')
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { NestFactory } = require('@nestjs/core')
const { AppModule } = require('../dist/app.module')
const { DatabaseService } = require('../dist/database.service')
const { normalizeError } = require('../dist/api-error.filter')

test('normaliza errores PostgreSQL y oculta detalles internos', () => {
  for (const code of ['23505', '23503']) assert.equal(normalizeError({ code, detail: 'secreto' }).status, 409)
  for (const code of ['23514', '23502', '22001', '22003', '22P02']) assert.equal(normalizeError({ code }).status, 400)
  for (const error of [null, undefined, new Error('DATABASE_URL secreta'), { code: '08006', detail: 'secreto' }]) {
    assert.deepEqual(normalizeError(error), { status: 500, body: { code: 'INTERNAL_ERROR', message: 'No se pudo completar la solicitud.', details: [] } })
  }
})

test('mantiene las diez rutas de S2-04 y uniforma errores HTTP', async () => {
  // URL ficticia: todas las operaciones se reemplazan antes de atender solicitudes.
  const previousUrl = process.env.DATABASE_URL
  process.env.DATABASE_URL = 'postgres://test:test@127.0.0.1:1/test'
  const app = await NestFactory.create(AppModule, { logger: false })
  const db = app.get(DatabaseService)
  const plan = { id: '1', nombre: 'Prueba', objetivo: 'Buscar curso', estado: 'borrador' }
  const tarea = { id: '4', plan_id: '1', titulo: 'Buscar', descripcion: 'Buscar curso', orden: 1, codigo: null, criterio_exito: null }
  const session = { id: '2', plan_id: '1', participante_id: '3', participante_codigo: 'P1', estado: 'pendiente', consentimiento_confirmado: false }
  let statements = []
  const query = async (sql) => {
    statements.push(sql)
    if (sql.includes('WHERE id = $1') && statements.at(-1).includes('public.planes') && missingPlan) return { rows: [], rowCount: 0 }
    if (sql.includes('FROM public.sesiones s')) return { rows: [session], rowCount: 1 }
    if (sql.includes('FROM public.tareas')) return { rows: [tarea], rowCount: 1 }
    return { rows: [plan], rowCount: 1 }
  }
  let missingPlan = false
  db.query = query
  db.transaction = async (operation) => operation({ query })
  try {
    app.setGlobalPrefix('api')
    await app.listen(0, '127.0.0.1')
    const url = await app.getUrl()
    const send = async (method, path, body) => {
      const response = await fetch(`${url}/api${path}`, { method, headers: { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
      return { status: response.status, body: await response.json() }
    }
    const requests = [
      ['GET', '/planes', undefined, 200],
      ['GET', '/planes/1', undefined, 200],
      ['POST', '/planes', { nombre: 'Prueba', objetivo: 'Buscar', tareas: [{ titulo: 'Buscar', descripcion: 'Curso', orden: 1 }] }, 201],
      ['PATCH', '/planes/1', { estado: 'activo' }, 200],
      ['POST', '/planes/1/tareas', { titulo: 'Buscar', descripcion: 'Curso', orden: 2 }, 201],
      ['PATCH', '/planes/1/tareas/4', { codigo: null }, 200],
      ['GET', '/sesiones', undefined, 200],
      ['GET', '/sesiones/2', undefined, 200],
      ['POST', '/sesiones', { plan_id: '1', codigo_participante: 'P1' }, 201],
      ['PATCH', '/sesiones/2', { accion: 'iniciar', consentimiento_confirmado: true }, 200],
      ['PATCH', '/sesiones/2', { accion: 'cerrar', consentimiento_confirmado: false }, 200],
    ]
    for (const [method, path, body, status] of requests) {
      const response = await send(method, path, body)
      assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(response.body)}`)
      if (path === '/planes/1' || path.startsWith('/planes/1/tareas')) assert.deepEqual(response.body.tareas, [tarea])
      if (path === '/sesiones/2') assert.deepEqual(response.body.tareas, [tarea])
    }
    statements = []
    const invalid = await send('POST', '/sesiones', { plan_id: {}, codigo_participante: 'P1' })
    assert.equal(invalid.status, 400)
    assert.deepEqual(Object.keys(invalid.body), ['code', 'message', 'details'])
    assert.equal(statements.length, 0)
    const unknown = await send('PATCH', '/planes/1', { otro: true })
    assert.deepEqual(unknown.body.details, [{ field: 'otro', message: 'Campo no admitido.' }])
    missingPlan = true
    assert.equal((await send('GET', '/planes/99')).status, 404)
    missingPlan = false
    const malformed = await fetch(`${url}/api/planes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' })
    assert.equal(malformed.status, 400)
    assert.equal((await malformed.json()).code, 'INVALID_REQUEST')
    const notFound = await send('GET', '/inexistente')
    assert.equal(notFound.status, 404)
    assert.equal(notFound.body.code, 'NOT_FOUND')
    db.query = async () => { throw { code: '23505', detail: 'secreto' } }
    assert.equal((await send('PATCH', '/planes/1', { estado: 'activo' })).status, 409)
    db.query = async () => { throw new Error('secreto') }
    assert.deepEqual((await send('GET', '/planes')).body, { code: 'INTERNAL_ERROR', message: 'No se pudo completar la solicitud.', details: [] })
    db.query = async (sql) => sql.startsWith('UPDATE') ? { rowCount: 0, rows: [] } : { rowCount: 1, rows: [{ id: '2' }] }
    const conflict = await send('PATCH', '/sesiones/2', { accion: 'iniciar', consentimiento_confirmado: true })
    assert.equal(conflict.status, 409)
    assert.equal(conflict.body.code, 'CONFLICT')
  } finally {
    await app.close()
    if (previousUrl === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = previousUrl
  }
})
