const { test } = require('node:test')
const assert = require('node:assert/strict')
const { DatabaseService } = require('../dist/database.service.js')

test('revierte el plan cuando falla una tarea y libera la conexión', async () => {
  const statements = []
  let released = false
  const client = {
    query: async (sql) => {
      statements.push(sql)
      if (sql.startsWith('INSERT INTO public.tareas')) throw new Error('Tarea inválida')
      return { rows: [{ id: '17' }] }
    },
    release: () => { released = true },
  }
  const db = Object.create(DatabaseService.prototype)
  db.pool = { connect: async () => client }

  await assert.rejects(db.transaction(async (connection) => {
    await connection.query('INSERT INTO public.planes (nombre, objetivo) VALUES ($1, $2) RETURNING id')
    await connection.query('INSERT INTO public.tareas (plan_id, titulo) VALUES ($1, $2)')
  }), /Tarea inválida/)

  assert.deepEqual(statements, [
    'BEGIN',
    'INSERT INTO public.planes (nombre, objetivo) VALUES ($1, $2) RETURNING id',
    'INSERT INTO public.tareas (plan_id, titulo) VALUES ($1, $2)',
    'ROLLBACK',
  ])
  assert.equal(released, true)
})

test('revierte participante y sesión si falla la creación; libera la conexión', async () => {
  const { SessionsService } = require('../dist/sessions.service')
  const statements = []
  let released = false
  const client = {
    query: async sql => {
      statements.push(sql)
      if (sql.includes('COUNT(*)')) return { rows: [{ total: '0' }] }
      if (sql.includes('AS siguiente')) return { rows: [{ siguiente: '1' }] }
      if (sql.startsWith('INSERT INTO public.sesiones')) throw new Error('Fallo al crear sesión')
      return { rows: [{ id: '1', cupo: 5, estado: 'activo' }] }
    },
    release: () => { released = true },
  }
  const db = Object.create(DatabaseService.prototype)
  db.pool = { connect: async () => client }
  await assert.rejects(new SessionsService(db).create({ plan_id: '1', consentimiento_confirmado: true }), /Fallo al crear sesión/)
  assert.ok(statements.some(sql => sql.startsWith('INSERT INTO public.participantes')))
  assert.equal(statements.at(-1), 'ROLLBACK')
  assert.ok(!statements.includes('COMMIT'))
  assert.equal(released, true)
})
