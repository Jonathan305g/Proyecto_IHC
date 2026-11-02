require('reflect-metadata')
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const { PGlite } = require('@electric-sql/pglite')
const { PlansService } = require('../dist/plans.service')
const { TasksService } = require('../dist/tasks.service')
const { SessionsService } = require('../dist/sessions.service')
const { ResultsService } = require('../dist/results.service')
const { EvidencesService } = require('../dist/evidencias.service')
const sql = name => fs.readFile(path.join(__dirname, '../../database', name), 'utf8')

function adapter(pg) {
  const convert = result => ({ rows: result.rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === 'bigint' ? String(value) : value]))), rowCount: result.affectedRows })
  return {
    query: async (sql, args = []) => convert(await pg.query(sql, args)),
    transaction: op => pg.transaction(tx => op({ query: async (sql, args = []) => convert(await tx.query(sql, args)) })),
  }
}

test('PostgreSQL embebido: esquema, migraciones repetibles, datos y flujo completo', async () => {
  const pg = new PGlite()
  try {
    const schema = await sql('01_esquema.sql')
    assert.equal(schema, await sql('schema.sql'), 'El esquema de compatibilidad no puede divergir')
    await pg.exec(schema)
    await pg.exec(schema)
    for (let n = 0; n < 2; n++) {
      for (const file of (await fs.readdir(path.join(__dirname, '../migrations'))).sort()) {
        await pg.exec(await fs.readFile(path.join(__dirname, '../migrations', file), 'utf8'))
      }
      await pg.exec(await sql('02_datos_ejemplo.sql'))
    }
    assert.equal((await pg.query('SELECT COUNT(*)::int AS total FROM public.planes')).rows[0].total, 1)
    assert.equal((await pg.query('SELECT COUNT(*)::int AS total FROM public.sesiones')).rows[0].total, 1)
    const uncovered = await pg.query(`SELECT c.conname FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace
      WHERE c.contype='f' AND n.nspname='public' AND NOT EXISTS (
        SELECT 1 FROM pg_index i WHERE i.indrelid=c.conrelid AND i.indisvalid AND i.indpred IS NULL
        AND ARRAY(SELECT unnest(i.indkey) LIMIT cardinality(c.conkey)) @> c.conkey)`)
    assert.deepEqual(uncovered.rows, [], 'Todas las claves foráneas deben tener un índice que las cubra')
    const db = adapter(pg), plans = new PlansService(db), tasks = new TasksService(db, plans)
    const sessions = new SessionsService(db), results = new ResultsService(db)
    const objects = new Set()
    const evidences = new EvidencesService(db, {
      upload: async key => objects.add(key), remove: async key => objects.delete(key), sign: async key => `https://example.com/${key}`,
    })
    const plan = await plans.create({ nombre: 'Integración', objetivo: 'Validar', cupo: 1, tareas: [{ titulo: 'Buscar', descripcion: 'Buscar una opción', orden: 1 }] })
    const planId = String(plan.id)
    await tasks.updateTask(planId, String(plan.tareas[0].id), { titulo: 'Buscar menú' })
    const session = await sessions.create({ plan_id: planId, codigo_participante: 'INTEGRACION-1' })
    const sessionId = String(session.id), taskId = String(plan.tareas[0].id)
    await assert.rejects(evidences.createFromLink(sessionId, taskId, { tipo: 'enlace', ruta: 'https://example.com' }), /sesión en curso/)
    await sessions.update(sessionId, { accion: 'iniciar', consentimiento_confirmado: true })
    await assert.rejects(tasks.updateTask(planId, taskId, { titulo: 'Cambiar historia' }), /no se pueden cambiar/)
    await assert.rejects(tasks.addTask(planId, { titulo: 'Otra', descripcion: 'Otra tarea', orden: 2 }), /no se pueden cambiar/)
    const evidence = await evidences.createFromLink(sessionId, taskId, { tipo: 'enlace', ruta: 'https://example.com' })
    assert.equal((await sessions.detail(sessionId)).progreso.registradas, 0)
    await assert.rejects(sessions.update(sessionId, { accion: 'cerrar' }), /faltan resultados/)
    const saved = await results.save(sessionId, taskId, { resultado: 'con_ayuda', tiempo_segundos: 45, errores: 1, observacion: 'Confundió el menú' })
    assert.equal(String(saved.id), String(evidence.resultado_id), 'Guardar evaluación conserva las evidencias')
    const again = await results.save(sessionId, taskId, { resultado: 'sin_ayuda', tiempo_segundos: 40, errores: 0 })
    assert.equal(saved.id, again.id, 'El guardado es idempotente')
    assert.equal((await sessions.detail(sessionId)).progreso.registradas, 1)
    assert.equal((await sessions.update(sessionId, { accion: 'cerrar' })).estado, 'cerrada')
    await assert.rejects(evidences.delete(String(evidence.id)), /sesión en curso/)
    await assert.rejects(results.save(sessionId, taskId, { resultado: 'sin_ayuda', tiempo_segundos: 1, errores: 0 }), /sesión en curso/)
    await assert.rejects(sessions.create({ plan_id: planId, codigo_participante: 'OTRO' }), /cupo/)
    const before = (await pg.query('SELECT COUNT(*)::int AS total FROM public.planes')).rows[0].total
    await assert.rejects(plans.create({ nombre: 'Rollback', objetivo: 'Validar', tareas: [{ titulo: 'Demasiado largo'.repeat(30), descripcion: 'X', orden: 1 }] }))
    assert.equal((await pg.query('SELECT COUNT(*)::int AS total FROM public.planes')).rows[0].total, before)
    // Simula una instalación anterior a S2-06 y comprueba que actualizar conserva los datos.
    await pg.exec('ALTER TABLE public.planes DROP COLUMN cupo; ALTER TABLE public.resultados DROP COLUMN con_ayuda;')
    await pg.exec(await fs.readFile(path.join(__dirname, '../migrations/001_s2_06_ejecucion_sesiones.sql'), 'utf8'))
    assert.equal((await pg.query('SELECT COUNT(*)::int AS total FROM public.planes')).rows[0].total, before)
    assert.equal((await sessions.detail(sessionId)).estado, 'cerrada')
  } finally { await pg.close() }
})
