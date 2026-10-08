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
