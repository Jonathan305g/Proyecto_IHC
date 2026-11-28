const { test } = require('node:test')
const assert = require('node:assert/strict')
const { fixture } = require('./helpers/sprint4.cjs')
const { agregar } = require('../dist/comparison/comparison.service')
test('S4-06: comparacion SQL contra dos conjuntos calculados a mano', async t => {
 const f = await fixture(), { pg, api } = f
 try {
  await pg.exec(`INSERT INTO public.tareas(id,plan_id,titulo,descripcion,orden) OVERRIDING SYSTEM VALUE VALUES
   (1,101,'Guardar A','Confirmar',1),(2,101,'Buscar A','Buscar',2),(3,101,'Exclusiva A','Otra',3),
   (11,202,'Guardar B','Confirmar',1),(12,202,'Buscar B','Buscar',2),(13,202,'Exclusiva B','Otra',3);
   INSERT INTO public.participantes(id,codigo) OVERRIDING SYSTEM VALUE VALUES(1,'ANONIMO-S406');
   INSERT INTO public.sesiones(id,plan_id,participante_id,estado,consentimiento_confirmado,iniciada_en,cerrada_en) OVERRIDING SYSTEM VALUE VALUES
    (1,101,1,'cerrada',true,'2026-11-01T10:00Z','2026-11-01T11:00Z'),(2,101,1,'cerrada',true,'2026-11-02T10:00Z','2026-11-02T11:00Z'),
    (3,202,1,'cerrada',true,'2026-11-03T10:00Z','2026-11-03T11:00Z'),(4,202,1,'cerrada',true,'2026-11-04T10:00Z','2026-11-04T11:00Z');
   INSERT INTO public.resultados(plan_id,sesion_id,tarea_id,completada,con_ayuda,duracion_segundos,cantidad_errores) VALUES
    (101,1,1,true,false,60,1),(101,2,1,true,true,90,2),(101,1,2,false,false,120,3),(101,2,2,true,false,NULL,0),
    (202,3,11,true,false,40,0),(202,4,11,true,false,60,1),(202,3,12,true,false,10,0),(202,4,12,true,true,20,1);`)
  const body = { a: { plan_id: '101' }, b: { plan_id: '202' }, equivalencias: [{ tarea_a: '1', tarea_b: '11' }] }
  await t.test('ruta privada y contrato estricto antes de SQL', async () => {
   assert.equal((await api('/comparaciones', 'POST', body, null)).status, 401)
   for (const b of [{ ...body, extra: true }, { ...body, a: { plan_id: 101 } }, { ...body, a: { plan_id: '101', desde: '2026-02-30T00:00:00Z' } }, { ...body, equivalencias: [body.equivalencias[0], body.equivalencias[0]] }, { ...body, equivalencias: [{ tarea_a: '11', tarea_b: '1' }] }, { ...body, b: { plan_id: '101' } }]) assert.equal((await api('/comparaciones', 'POST', b)).status, 400)
  })
  await t.test('referencia 1: exito autonomo +50 pp, tiempo -10 s y errores -0.5', async () => {
   const r = await api('/comparaciones', 'POST', body); assert.equal(r.status, 200, JSON.stringify(r.body)); const v = r.body
   assert.equal(v.agregado.a.evaluados, 2); assert.equal(v.agregado.b.evaluados, 2)
   assert.deepEqual(v.agregado.variacion.sin_ayuda, { porcentaje_pp: 50, tiempo_segundos: -10, errores_promedio: -0.5 })
   assert.equal(v.agregado.variacion.con_ayuda.tiempo_segundos, null)
   assert.deepEqual(v.excluidas.a.map(t => t.tarea_id), ['2', '3']); assert.deepEqual(v.excluidas.b.map(t => t.tarea_id), ['12', '13'])
  })
  await t.test('referencia 2: agregado ponderado de pares y NULL separado de cero', async () => {
   const r = await api('/comparaciones', 'POST', { ...body, equivalencias: [...body.equivalencias, { tarea_a: '2', tarea_b: '12' }] })
   assert.equal(r.status, 200); const v = r.body
   assert.equal(v.agregado.a.evaluados, 4); assert.equal(v.agregado.variacion.sin_ayuda.porcentaje_pp, 25)
   assert.equal(v.agregado.a.por_resultado.sin_ayuda.tiempo.n, 1); assert.equal(v.agregado.b.por_resultado.sin_ayuda.tiempo.n, 3)
   assert.equal(v.agregado.variacion.sin_ayuda.tiempo_segundos, -23.33); assert.equal(v.agregado.variacion.sin_ayuda.errores_promedio, -0.17)
   assert.equal(v.agregado.b.por_resultado.no_completado.tiempo.promedio_segundos, null)
  })
  await t.test('periodo sin datos, equivalencias vacias y tareas exclusivas no inventan variacion', async () => {
   const r = await api('/comparaciones', 'POST', { ...body, b: { plan_id: '202', desde: '2030-01-01T00:00:00Z' } })
   assert.equal(r.body.estado, 'sin_comparables'); assert.equal(r.body.agregado, null); assert.equal(r.body.pares[0].variacion, null)
   const empty = await api('/comparaciones', 'POST', { ...body, equivalencias: [] }); assert.equal(empty.body.agregado, null); assert.equal(empty.body.excluidas.a.length, 3)
  })
  await t.test('coberturas desiguales se muestran junto con aviso y denominadores', async () => {
   await pg.query('DELETE FROM public.resultados WHERE sesion_id=4 AND tarea_id=11')
   const r = await api('/comparaciones', 'POST', body); assert.equal(r.body.agregado.a.evaluados, 2); assert.equal(r.body.agregado.b.evaluados, 1)
   assert.equal(r.body.agregado.b.cobertura_porcentaje, 50); assert.equal(r.body.avisos.some(s => s.includes('denominadores difieren')), true)
  })
  await t.test('sin registros el agregador conserva conteos cero y medidas nulas', () => { const r = agregar([]); assert.equal(r.evaluados, 0); assert.equal(r.cobertura_porcentaje, null); assert.equal(r.por_resultado.sin_ayuda.tiempo.promedio_segundos, null) })
 } finally { await f.close() }
})
