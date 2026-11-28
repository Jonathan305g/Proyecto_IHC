const { test } = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const { fixture } = require('./helpers/sprint4.cjs')
test('S4-04: review y cierre persistentes, atomicos y trazables', async t => {
 const f = await fixture(), { send, pg } = f; let s, r
 const path = suffix => `sprints-producto/${s.id}/${suffix}`
 const review = () => ({ version: s.version, entregas: 'Confirmacion entregada', pendientes: 'Retorno pendiente', observaciones: 'Revisar con equipo', aspectos_positivos: 'Confirmacion visible', dificultades: 'Retorno no terminado', acuerdos: [{ id: randomUUID(), accion: 'Verificar retorno por teclado', responsable_id: r.id, fecha_compromiso: '2026-12-12', completado: false }] })
 try {
  r = (await send('responsables-producto', 'POST', { solicitud_id: randomUUID(), alias: 'Producto' })).body
  s = (await send('sprints-producto', 'POST', { solicitud_id: randomUUID(), nombre: 'Cierre', objetivo: 'Cerrar mejoras', fecha_inicio: '2026-11-27', fecha_fin: '2026-12-10', capacidad: 8, historias: [{ historia_id: '1', responsable_id: r.id }, { historia_id: '2', responsable_id: r.id }] })).body
  await t.test('rutas de cierre privadas, sin referencias ajenas', async () => {
   for (const [suffix, method] of [['cierre', 'GET'], ['cierre', 'PUT'], ['cerrar', 'POST']]) assert.equal((await send(path(suffix), method, method === 'GET' ? undefined : {}, null)).status, 401)
   assert.equal((await f.api(`/planes/202/sprints-producto/${s.id}/cierre`)).status, 404)
  })
  await t.test('borrador incompleto se conserva; cerrar antes de activar se rechaza', async () => {
   const b = { version: s.version, entregas: '', pendientes: '', observaciones: '', aspectos_positivos: '', dificultades: '', acuerdos: [] }
   const result = await send(path('cierre'), 'PUT', b); assert.equal(result.status, 200, JSON.stringify(result.body)); s = result.body
   assert.equal((await send(path('cierre'))).body.revision.entregas, '')
   assert.equal((await send(path('cerrar'), 'POST', { version: s.version, confirmacion: true, motivo_pendientes: '' })).status, 409)
  })
  await t.test('acuerdos exigen responsable del plan, fecha real e IDs unicos', async () => {
   const b = review()
   for (const a of [{ ...b.acuerdos[0], responsable_id: '999' }, { ...b.acuerdos[0], fecha_compromiso: '2026-02-30' }, { ...b.acuerdos[0], fecha_compromiso: '2026-01-01' }]) assert.equal((await send(path('cierre'), 'PUT', { ...b, acuerdos: [a] })).status, 400)
   assert.equal((await send(path('cierre'), 'PUT', { ...b, acuerdos: [b.acuerdos[0], b.acuerdos[0]] })).status, 400)
   assert.equal((await send(path('cierre'), 'PUT', { ...b, version: 999 })).status, 409)
   const result = await send(path('cierre'), 'PUT', b); assert.equal(result.status, 200); s = result.body
   const loaded = (await send(path('cierre'))).body; assert.equal(loaded.revision.acuerdos[0].accion, b.acuerdos[0].accion)
   const edited = await send(path('cierre'), 'PUT', { ...b, version: s.version, observaciones: 'Review editada' }); s = edited.body; assert.equal(s.revision.acuerdos.length, 1)
  })
  await t.test('tablero y review muestran los mismos puntos entregados y pendientes', async () => {
   s = (await send(path('tareas'), 'POST', { version: s.version, solicitud_id: randomUUID(), historia_id: '1', titulo: 'Confirmar', responsable_id: r.id })).body
   const task = s.tareas[0]
   s = (await send(path('activar'), 'POST', { version: s.version })).body
   for (const estado of ['en_progreso', 'en_revision', 'terminada']) s = (await send(path(`tareas/${task.id}/estado`), 'POST', { version: s.version, estado })).body
   const loaded = (await send(path('cierre'))).body; assert.equal(loaded.avance.puntos_entregados, 3); assert.equal(loaded.avance.puntos_pendientes, 5)
  })
  await t.test('confirmacion y motivo de pendientes obligatorios; fallo atomico conserva sprint activo', async () => {
   assert.equal((await send(path('cerrar'), 'POST', { version: s.version, confirmacion: false, motivo_pendientes: 'Retornar' })).status, 400)
   assert.equal((await send(path('cerrar'), 'POST', { version: s.version, confirmacion: true, motivo_pendientes: '' })).status, 400)
   const tx = f.db.transaction
   f.db.transaction = op => tx(db => op({ query: (sql, args) => { if (sql.includes("SET estado='cerrado'")) throw Error('Fallo interno controlado'); return db.query(sql, args) } }))
   assert.equal((await send(path('cerrar'), 'POST', { version: s.version, confirmacion: true, motivo_pendientes: 'Volver al backlog' })).status, 500)
   f.db.transaction = tx
   assert.equal((await send(path('cierre'))).body.estado, 'activo'); assert.equal((await pg.query('SELECT instantanea FROM public.producto_cierres')).rows[0].instantanea, null)
  })
  await t.test('cierre conserva snapshot, libera incompletas y repetir no duplica eventos', async () => {
   const b = { version: s.version, confirmacion: true, motivo_pendientes: 'Volver al backlog para otro sprint' }
   const result = await send(path('cerrar'), 'POST', b); assert.equal(result.status, 200, JSON.stringify(result.body)); s = result.body
   assert.equal(s.estado, 'cerrado'); assert.equal(s.cierre_snapshot.avance.puntos_entregados, 3)
   assert.equal((await send(path('cerrar'), 'POST', b)).body.estado, 'cerrado')
   assert.equal((await pg.query("SELECT count(*)::int n FROM public.producto_sprint_eventos WHERE accion='cerrado'")).rows[0].n, 1)
   assert.equal((await pg.query('SELECT estado FROM public.historias WHERE id=2')).rows[0].estado, 'pendiente')
   assert.equal((await pg.query('SELECT count(*)::int n FROM public.producto_sprint_historias WHERE comprometida')).rows[0].n, 0)
   assert.equal((await send(path('cierre'), 'PUT', review())).status, 409)
   const r = await send('sprints-producto', 'POST', { solicitud_id: randomUUID(), nombre: 'Siguiente', objetivo: 'Completar retorno', fecha_inicio: '2026-12-11', fecha_fin: '2026-12-20', capacidad: 5, historias: [{ historia_id: '2' }] }); assert.equal(r.status, 201)
  })
 } finally { await f.close() }
})
