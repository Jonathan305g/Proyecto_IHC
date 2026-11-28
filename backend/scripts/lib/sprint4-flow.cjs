const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
// request usa HTTP autenticado; el transporte y la BD los decide quien ejecuta.
async function sprint4Flow({ request, marker, onStep = () => {} }) {
 const createEvaluation = async (name, index) => {
  const plan = await request('POST', '/planes', { nombre: name, objetivo: 'Comprobar el recorrido integrado', cupo: 1, tareas: [{ titulo: 'Guardar cambios', descripcion: 'Guardar la edicion', criterio_exito: 'Se confirma la accion', orden: 1 }, { titulo: 'Volver al listado', descripcion: 'Recuperar el listado', criterio_exito: 'El listado conserva filtros', orden: 2 }] }, 201)
  const p = String(plan.id), tasks = plan.tareas.map(t => String(t.id)), code = `S4-${marker.slice(-20)}-${index}`
  await request('PATCH', `/planes/${p}`, { estado: 'activo' })
  const session = await request('POST', '/sesiones', { plan_id: p, codigo_participante: code }, 201), sid = String(session.id)
  await request('PATCH', `/sesiones/${sid}`, { accion: 'iniciar', consentimiento_confirmado: true })
  const evidence = await request('POST', `/sesiones/${sid}/resultados/${tasks[0]}/evidencias`, { tipo: 'enlace', ruta: 'https://example.org/evidencia-integracion' }, 201)
  for (const [n, t] of tasks.entries()) await request('PUT', `/sesiones/${sid}/resultados/${t}`, { resultado: index === 1 && n === 0 ? 'con_ayuda' : 'sin_ayuda', tiempo_segundos: index === 1 ? 45 : 30, errores: index === 1 ? 1 : 0, observacion: n === 0 ? 'La confirmacion de guardado no aparece y se repite la accion.' : 'Al volver se pierden los filtros del listado.' })
  await request('PATCH', `/sesiones/${sid}`, { accion: 'cerrar' })
  assert.equal(String((await request('GET', `/evidencias/${evidence.id}`)).id), String(evidence.id))
  await request('PUT', `/sesiones/${sid}/resultados/${tasks[0]}`, { resultado: 'sin_ayuda', tiempo_segundos: 1, errores: 0 }, 409)
  return { p, tasks, code }
 }
 const a = await createEvaluation(marker, 1); onStep('Plan, sesion, consentimiento, resultados y evidencia recuperados')
 const base = `/planes/${a.p}`, sources = await request('GET', `${base}/observaciones-ia`)
 const analysis = await request('POST', `${base}/analisis-ia`, { solicitud_id: randomUUID(), resultado_ids: sources.map(o => o.resultado_id) }, 201)
 const privacy = analysis.grupos.flatMap(g => g.solicitud.observaciones.map(o => ({ resultado_id: o.id.slice(10), texto: o.texto, titulo_tarea: o.tarea.titulo, criterio_exito: o.tarea.criterio_exito })))
 await request('PUT', `${base}/analisis-ia/${analysis.id}/revision`, { observaciones: privacy })
 const executed = await request('POST', `${base}/analisis-ia/${analysis.id}/ejecutar`, {})
 assert.equal(executed.estado, 'completado', 'El proveedor no completo el analisis')
 const imported = await request('POST', `${base}/analisis-ia/${analysis.id}/hallazgos`, {})
 assert.ok(imported.hallazgos.length, 'El proveedor no propuso hallazgos revisables para continuar')
 let h = imported.hallazgos[0]
 h = await request('PUT', `${base}/hallazgos/${h.id}`, { version: h.version, resumen: h.resumen, categoria: h.categoria, severidad: h.severidad, mejora_sugerida: h.mejora_sugerida, criterio_aceptacion: 'Al guardar aparece una confirmacion persistente operable por teclado.' })
 const approval = { version: h.version, titulo: 'Confirmar guardado de forma accesible', prioridad: 2, puntos: 3 }
 const approved = await request('POST', `${base}/hallazgos/${h.id}/aprobar`, approval), story = approved.historia
 assert.equal((await request('POST', `${base}/hallazgos/${h.id}/aprobar`, approval)).historia.id, story.id)
 assert.equal((await request('GET', `${base}/historias`)).historias.some(s => s.id === story.id), true)
 onStep('IA, privacidad, aprobacion humana y backlog sin duplicacion')
 const member = await request('POST', `${base}/responsables-producto`, { solicitud_id: randomUUID(), alias: 'Equipo de comprobacion' }, 201)
 const today = new Date().toISOString().slice(0, 10), end = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
 let sprint = await request('POST', `${base}/sprints-producto`, { solicitud_id: randomUUID(), nombre: 'Sprint de comprobacion', objetivo: 'Entregar confirmacion', fecha_inicio: today, fecha_fin: end, capacidad: 3, historias: [{ historia_id: story.id, responsable_id: member.id }] }, 201)
 const sb = `${base}/sprints-producto/${sprint.id}`
 sprint = await request('POST', `${sb}/tareas`, { version: sprint.version, solicitud_id: randomUUID(), historia_id: story.id, titulo: 'Implementar confirmacion', responsable_id: member.id }, 201)
 const task = sprint.tareas[0]
 sprint = await request('POST', `${sb}/activar`, { version: sprint.version })
 for (const estado of ['en_progreso', 'en_revision', 'terminada']) sprint = await request('POST', `${sb}/tareas/${task.id}/estado`, { version: sprint.version, estado })
 assert.equal(sprint.avance.puntos_entregados, 3); assert.equal((await request('GET', sb)).avance.porcentaje_puntos, 100)
 sprint = await request('PUT', `${sb}/cierre`, { version: sprint.version, entregas: 'Confirmacion accesible entregada', pendientes: 'Ninguna historia pendiente', observaciones: 'Recorrido tecnico comprobado', aspectos_positivos: 'Origen y criterios conservados', dificultades: 'Comprobar redes y estados', acuerdos: [{ id: randomUUID(), accion: 'Mantener la regresion del recorrido', responsable_id: member.id, fecha_compromiso: end, completado: false }] })
 sprint = await request('POST', `${sb}/cerrar`, { version: sprint.version, confirmacion: true, motivo_pendientes: '' })
 assert.equal(sprint.estado, 'cerrado'); assert.equal(sprint.cierre_snapshot.avance.puntos_entregados, 3)
 onStep('Planificacion, tablero, progreso, review, acuerdos y cierre persistentes')
 const b = await createEvaluation(marker + '-B', 2), comparison = { a: { plan_id: a.p }, b: { plan_id: b.p }, equivalencias: a.tasks.map((t, i) => ({ tarea_a: t, tarea_b: b.tasks[i] })) }
 const compared = await request('POST', '/comparaciones', comparison)
 assert.equal(compared.estado, 'comparable'); assert.equal(compared.agregado.variacion.sin_ayuda.porcentaje_pp, 50)
 const report = await request('POST', '/informes/previsualizar', { plan_id: a.p, secciones: ['resultados', 'hallazgos', 'historias', 'comparacion'], comparacion: comparison })
 const md = await request('GET', `/informes/${report.reporte_id}/markdown`), pdf = await request('GET', `/informes/${report.reporte_id}/pdf`)
 assert.equal(Buffer.isBuffer(md), true); assert.match(md.toString('utf8'), /Historias procedentes/); assert.equal(pdf.subarray(0, 5).toString(), '%PDF-')
 onStep('Comparacion de dos evaluaciones y descargas Markdown/PDF coherentes')
 return { planes: [a.p, b.p], participantes: [a.code, b.code], sprint_id: sprint.id, historia_id: story.id, analisis_id: analysis.id }
}
module.exports = { sprint4Flow }
