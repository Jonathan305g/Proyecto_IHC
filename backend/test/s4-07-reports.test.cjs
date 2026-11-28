const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const { fixture } = require('./helpers/sprint4.cjs')
const { pdf, markdown } = require('../dist/reports/render')
test('S4-07: informes privados, filtrados y coherentes en Markdown y PDF', async t => {
 const f = await fixture(), { pg, api, app } = f
 let preview, md
 const body = { plan_id: '101', desde: '2026-11-01T00:00:00Z', hasta: '2026-12-01T00:00:00Z', secciones: ['resultados', 'hallazgos', 'historias'] }
 try {
  await pg.exec(`UPDATE public.planes SET nombre='Evaluación de navegación y diseño español' WHERE id=101;
   INSERT INTO public.tareas(id,plan_id,titulo,descripcion,orden) OVERRIDING SYSTEM VALUE VALUES(1,101,'Guardar y volver','Confirmar',1);
   INSERT INTO public.participantes(id,codigo) OVERRIDING SYSTEM VALUE VALUES(1,'NO-EXPORTAR-IDENTIDAD');
   INSERT INTO public.sesiones(id,plan_id,participante_id,estado,consentimiento_confirmado,iniciada_en,cerrada_en) OVERRIDING SYSTEM VALUE VALUES
    (1,101,1,'cerrada',true,'2026-11-01T10:00Z','2026-11-01T11:00Z'),(2,101,1,'cerrada',true,'2026-12-02T10:00Z','2026-12-02T11:00Z');
   INSERT INTO public.resultados(id,plan_id,sesion_id,tarea_id,completada,con_ayuda,duracion_segundos,cantidad_errores,observaciones) OVERRIDING SYSTEM VALUE VALUES
    (9007199254740993,101,1,1,true,false,60,1,'No exportar texto original con datos privados'),(2,101,2,1,true,false,30,0,'Fuera de noviembre');
   INSERT INTO public.analisis_ia(id,plan_id) OVERRIDING SYSTEM VALUE VALUES(1,101);
   INSERT INTO public.hallazgos(id,plan_id,analisis_id,resumen,sugerencia,estado,criterio_aceptacion) OVERRIDING SYSTEM VALUE VALUES
    (1,101,1,'Confirmación para persona@example.com','Mostrar mensaje en español','aprobado','El mensaje es visible'),
    (2,101,1,'BORRADOR-EXCLUIDO','Pendiente','pendiente',NULL),
    (3,101,1,'FUERA-DE-PERIODO','Diciembre','aprobado','Fuera'),(4,101,1,'ORIGEN-MIXTO','No mezclar','aprobado','Ambas fechas');
   INSERT INTO public.hallazgo_observaciones(hallazgo_id,plan_id,resultado_id,texto_original,texto_revisado,tarea_titulo) VALUES
    (1,101,9007199254740993,'Texto original privado','Texto revisado','Guardar'),(2,101,9007199254740993,'Texto','Texto','Guardar'),
    (3,101,2,'Texto','Texto','Guardar'),(4,101,9007199254740993,'Texto','Texto','Guardar'),(4,101,2,'Texto','Texto','Guardar');
   INSERT INTO public.historias(plan_id,hallazgo_id,titulo,descripcion,criterio_aceptacion,puntos,orden) VALUES
    (101,1,'Historia aprobada','Mejora para persona@example.com','Confirmación en español',3,4),
    (101,3,'Historia fuera del periodo','Fuera','Fuera',3,5);`)
  await t.test('autenticacion, secciones y referencias antes de generar', async () => {
   assert.equal((await api('/informes/previsualizar', 'POST', body, null)).status, 401)
   assert.equal((await api('/informes/123/pdf', 'GET', undefined, null)).status, 401)
   for (const b of [{ ...body, secciones: [] }, { ...body, secciones: ['hallazgos', 'hallazgos'] }, { ...body, secciones: ['credenciales'] }, { ...body, comparacion: {} }, { ...body, secciones: ['comparacion'] }]) assert.equal((await api('/informes/previsualizar', 'POST', b)).status, 400)
   assert.equal((await api('/informes/previsualizar', 'POST', { ...body, plan_id: '999' })).status, 404)
  })
  await t.test('alcance completo del origen, aprobacion y redaccion sin perder IDs o fechas', async () => {
   const r = await api('/informes/previsualizar', 'POST', body); assert.equal(r.status, 200, JSON.stringify(r.body)); preview = r.body
   const content = JSON.stringify(preview.documento)
   for (const value of ['BORRADOR-EXCLUIDO', 'FUERA-DE-PERIODO', 'ORIGEN-MIXTO', 'Historia fuera del periodo', 'persona@example.com', 'NO-EXPORTAR-IDENTIDAD', 'Texto original privado']) assert.equal(content.includes(value), false, value)
   for (const value of ['Historia aprobada', '9007199254740993', '2026-11-01', 'CORREO_OMITIDO', 'español']) assert.equal(content.includes(value), true, value)
   assert.equal(r.headers.get('cache-control'), 'no-store')
  })
  await t.test('ambas descargas representan la misma vista previa aunque cambie la base', async () => {
   await pg.query("UPDATE public.hallazgos SET resumen='CAMBIO-POSTERIOR' WHERE id=1")
   const m = await api(`/informes/${preview.reporte_id}/markdown`); assert.equal(m.status, 200); md = m.body.toString('utf8')
   assert.equal(md.includes('CAMBIO-POSTERIOR'), false); assert.equal(md.includes('Confirmación para'), true)
   assert.match(m.headers.get('content-disposition'), /attachment; filename="informe-plan-101-.*\.md"/)
   const p = await api(`/informes/${preview.reporte_id}/pdf`); assert.equal(p.status, 200, p.body.toString()); assert.equal(p.body.subarray(0, 5).toString(), '%PDF-')
   assert.equal(p.headers.get('content-type'), 'application/pdf'); assert.equal(p.headers.get('cache-control'), 'no-store')
   if (process.env.S4_EVIDENCE_DIR) { await fs.mkdir(process.env.S4_EVIDENCE_DIR, { recursive: true }); await fs.writeFile(path.join(process.env.S4_EVIDENCE_DIR, 'S4-07_referencia.pdf'), p.body); await fs.writeFile(path.join(process.env.S4_EVIDENCE_DIR, 'S4-07_referencia.md'), md) }
  })
  await t.test('sin datos y comparacion no comparable se explican sin incluir borradores', async () => {
   const r = await api('/informes/previsualizar', 'POST', { plan_id: '202', secciones: ['hallazgos', 'historias'] }); assert.equal(r.status, 200); assert.match(JSON.stringify(r.body), /No hay hallazgos aprobados/)
   const c = await api('/informes/previsualizar', 'POST', { ...body, secciones: ['comparacion'], comparacion: { a: { plan_id: '101', desde: body.desde, hasta: body.hasta }, b: { plan_id: '202' }, equivalencias: [] } }); assert.equal(c.status, 200, JSON.stringify(c.body)); assert.match(JSON.stringify(c.body), /se omite esa seccion/)
   assert.equal((await api('/informes/previsualizar', 'POST', { ...body, secciones: ['comparacion'], comparacion: { a: { plan_id: '202' }, b: { plan_id: '101' }, equivalencias: [] } })).status, 400)
  })
  await t.test('caducidad y formato invalido producen errores controlados', async () => {
   assert.equal((await api(`/informes/${preview.reporte_id}/html`)).status, 400)
   const { ReportsService } = require('../dist/reports/reports.service'), service = app.get(ReportsService)
   const now = Date.now; Date.now = () => now() + 600001
   try { await assert.rejects(service.descargar(preview.reporte_id, 'pdf'), /expiro/) } finally { Date.now = now }
  })
  await t.test('PDF largo pagina tablas y conserva caracteres espanoles', async () => {
   const document = { titulo: 'Evaluación técnica de navegación', plan_id: '101', generado_en: '2026-11-27', avisos: [], bloques: [{ tipo: 'texto', texto: 'Español: acción, revisión, ñ, ¿cómo?, pingüino.' }, { tipo: 'tabla', columnas: ['Tarea', 'Resultado', 'Tiempo (s)'], filas: Array.from({ length: 130 }, (_, i) => [`Tarea ${i + 1}`, 'Éxito sin ayuda', String(i)]) }, { tipo: 'texto', texto: 'Fin del informe y última comprobación.' }] }
   const buffer = await pdf(document); assert.equal(buffer.subarray(0, 5).toString(), '%PDF-'); assert.equal(markdown(document).includes('última comprobación'), true)
   if (process.env.S4_EVIDENCE_DIR) await fs.writeFile(path.join(process.env.S4_EVIDENCE_DIR, 'S4-07_paginacion.pdf'), buffer)
  })
 } finally { await f.close() }
})
