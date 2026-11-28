const { test } = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const fs = require('node:fs/promises')
const path = require('node:path')
const { fixture } = require('./helpers/sprint4.cjs')

test('S4-02: contrato Scrum, SQL real y estados recuperables', async t => {
 const f = await fixture(), { send, api, pg } = f
 const ruta = s => `sprints-producto/${s.id}`
 let responsable, sprint, task
 const input = extra => ({ solicitud_id: randomUUID(), nombre: 'Mejoras de guardado', objetivo: 'Confirmar y recuperar', fecha_inicio: '2026-11-27', fecha_fin: '2026-12-10', capacidad: 8, historias: [{ historia_id: '1', responsable_id: responsable?.id }], ...extra })
 try {
  await t.test('migracion repetible, RLS y cobertura de las claves foraneas', async () => {
   const file = (await fs.readdir(path.join(__dirname, '../migrations'))).find(n => n.includes('_s4_02_'))
   await pg.exec(await fs.readFile(path.join(__dirname, '../migrations', file), 'utf8'))
   const rows = (await pg.query("SELECT relname,relrowsecurity FROM pg_class WHERE relname LIKE 'producto_%' AND relkind='r'")).rows
   assert.equal(rows.length >= 5, true); assert.equal(rows.every(r => r.relrowsecurity), true)
   const uncovered = await pg.query(`SELECT c.conname FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace
    WHERE c.contype='f' AND n.nspname='public' AND NOT EXISTS(SELECT 1 FROM pg_index i WHERE i.indrelid=c.conrelid AND i.indisvalid AND i.indpred IS NULL AND ARRAY(SELECT unnest(i.indkey) LIMIT cardinality(c.conkey)) @> c.conkey)`)
   assert.deepEqual(uncovered.rows, [])
  })
  await t.test('rutas privadas: token y equipo autorizados', async () => {
   for (const [r, m, b] of [['responsables-producto', 'GET'], ['responsables-producto', 'POST', {}], ['responsables-producto/1', 'PATCH', {}], ['sprints-producto', 'GET'], ['sprints-producto', 'POST', {}], ['sprints-producto/1', 'GET'], ['sprints-producto/1', 'PUT', {}], ['sprints-producto/1/activar', 'POST', {}], ['sprints-producto/1/tareas', 'POST', {}], ['sprints-producto/1/tareas/1', 'PATCH', {}], ['sprints-producto/1/tareas/1/estado', 'POST', {}], ['sprints-producto/1/tareas/1/retirar', 'POST', {}]]) {
    assert.equal((await send(r, m, b, null)).status, 401); f.setEmail('ajeno@example.com'); assert.equal((await send(r, m, b)).status, 403); f.setEmail('equipo@example.com')
   }
  })
  await t.test('responsable: creacion idempotente y rechazo de otra intencion', async () => {
   const body = { solicitud_id: randomUUID(), alias: 'Equipo de producto A' }
   const r = await send('responsables-producto', 'POST', body); assert.equal(r.status, 201); responsable = r.body
   assert.equal((await send('responsables-producto', 'POST', body)).body.id, responsable.id)
   assert.equal((await send('responsables-producto', 'POST', { ...body, alias: 'Otro' })).status, 409)
  })
  await t.test('fechas reales, capacidad, campos, IDs y seleccion estrictos', async () => {
   for (const b of [input({ fecha_inicio: '2026-02-30' }), input({ fecha_fin: '2026-01-01' }), input({ capacidad: 2 }), input({ capacidad: '8' }), input({ historias: [{ historia_id: '3' }] }), input({ historias: [{ historia_id: '4' }] }), input({ historias: [{ historia_id: '1' }, { historia_id: '1' }] }), input({ academico: true }), input({ historias: [{ historia_id: '1', responsable_id: '999' }] })]) assert.equal((await send('sprints-producto', 'POST', b)).status, 400)
   assert.equal((await api('/planes/999/sprints-producto')).status, 404)
  })
  await t.test('planificacion guarda y recupera puntos, responsables y solicitud', async () => {
   const body = input(); const r = await send('sprints-producto', 'POST', body)
   assert.equal(r.status, 201, JSON.stringify(r.body)); sprint = r.body
   assert.equal(sprint.avance.puntos_seleccionados, 3); assert.equal(sprint.avance.capacidad_restante, 5)
   assert.equal(sprint.historias[0].responsable, responsable.alias)
   assert.equal((await send('sprints-producto', 'POST', body)).body.id, sprint.id)
   assert.equal((await send('sprints-producto', 'POST', { ...body, nombre: 'Distinto' })).status, 409)
   assert.equal((await send(ruta(sprint))).body.historias.length, 1)
  })
  await t.test('historia comprometida no se asigna a otro sprint ni altera estimacion en backlog', async () => {
   assert.equal((await send('sprints-producto', 'POST', input())).status, 409)
   assert.equal((await send('historias/1', 'PATCH', { version: 1, puntos: 99 })).status, 400)
   assert.equal((await pg.query('SELECT puntos FROM public.historias WHERE id=1')).rows[0].puntos, 3)
  })
  await t.test('edicion planificada, quitar historia y version obsoleta', async () => {
   const { solicitud_id, ...body } = input({ historias: [{ historia_id: '2', responsable_id: responsable.id }] })
   assert.equal((await send(ruta(sprint), 'PUT', { ...body, version: 999 })).status, 409)
   const r = await send(ruta(sprint), 'PUT', { ...body, version: sprint.version }); assert.equal(r.status, 200, JSON.stringify(r.body)); sprint = r.body
   assert.deepEqual(sprint.historias.map(h => h.id), ['2']); assert.equal(sprint.avance.puntos_seleccionados, 5)
   const retry = await send('sprints-producto', 'POST', input()); assert.equal(retry.status, 201)
  })
  await t.test('tarea: origen seleccionado, reintento de solicitud y version', async () => {
   const body = { version: sprint.version, solicitud_id: randomUUID(), historia_id: '2', titulo: 'Implementar retorno', responsable_id: responsable.id }
   assert.equal((await send(ruta(sprint) + '/tareas', 'POST', { ...body, historia_id: '4' })).status, 400)
   const r = await send(ruta(sprint) + '/tareas', 'POST', body); assert.equal(r.status, 201, JSON.stringify(r.body)); sprint = r.body; task = sprint.tareas[0]
   assert.equal((await send(ruta(sprint) + '/tareas', 'POST', body)).body.tareas.length, 1)
   assert.equal((await send(ruta(sprint) + '/tareas', 'POST', { ...body, titulo: 'Duplicado diferente' })).status, 409)
   assert.equal((await send(ruta(sprint) + `/tareas/${task.id}/estado`, 'POST', { version: sprint.version, estado: 'en_progreso' })).status, 409)
  })
  await t.test('activacion, transiciones controladas y progreso calculado', async () => {
   sprint = (await send(ruta(sprint) + '/activar', 'POST', { version: sprint.version })).body
   assert.equal(sprint.estado, 'activo')
   assert.equal((await send(ruta(sprint) + `/tareas/${task.id}/estado`, 'POST', { version: sprint.version, estado: 'terminada' })).status, 400)
   for (const estado of ['en_progreso', 'en_revision', 'terminada']) {
    const r = await send(ruta(sprint) + `/tareas/${task.id}/estado`, 'POST', { version: sprint.version, estado }); assert.equal(r.status, 200, JSON.stringify(r.body)); sprint = r.body
   }
   assert.equal(sprint.avance.puntos_entregados, 5); assert.equal(sprint.avance.porcentaje_puntos, 100)
   assert.equal(sprint.avance.porcentaje_tareas, 100)
   assert.equal((await pg.query('SELECT estado FROM public.historias WHERE id=2')).rows[0].estado, 'terminada')
   const v = sprint.version
   sprint = (await send(ruta(sprint) + `/tareas/${task.id}/estado`, 'POST', { version: v - 1, estado: 'terminada' })).body
   assert.equal(sprint.version, v)
  })
  await t.test('recarga y cambio inverso conservan historial; referencias y cambios concurrentes se rechazan', async () => {
   assert.equal((await send(ruta(sprint) + `/tareas/${task.id}/estado`, 'POST', { version: 1, estado: 'en_revision' })).status, 409)
   sprint = (await send(ruta(sprint) + `/tareas/${task.id}/estado`, 'POST', { version: sprint.version, estado: 'en_revision' })).body
   const loaded = await send(ruta(sprint)); assert.equal(loaded.body.avance.puntos_entregados, 0)
   assert.equal(loaded.body.eventos.filter(e => e.accion === 'estado_actualizado').length, 4)
   assert.equal((await api(`/planes/202/sprints-producto/${sprint.id}`)).status, 404)
   assert.equal((await send(ruta(sprint) + '/tareas/999/estado', 'POST', { version: sprint.version, estado: 'en_progreso' })).status, 404)
   assert.equal((await send(`responsables-producto/${responsable.id}`, 'PATCH', { version: responsable.version, alias: responsable.alias, activo: false })).status, 409)
  })
 } finally { await f.close() }
})
