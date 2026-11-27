import { expect } from '@playwright/test'
export async function setupReview(page, options = {}) {
 const user = { id: 'e53d7134-8f1d-4e98-8ad0-7d49856c6df9', aud: 'authenticated', role: 'authenticated', email: 'equipo@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
 const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.test-signature`
 await page.route('https://test.supabase.co/auth/v1/**', route => route.fulfill({ json: { access_token: token, refresh_token: 'refresh-test', token_type: 'bearer', expires_in: 3600, user } }))
 const source = { resultado_id: '1', plan_id: '1', tarea_id: '4', titulo_tarea: 'Guardar cambios', criterio_exito: 'Confirmar el guardado', resultado: 'con_ayuda', observacion_original: 'La confirmación pasó desapercibida.' }
 const finding = { id: '1', plan_id: '1', analisis_id: '7', resumen: 'Confirmación poco visible', mejora_sugerida: 'Mostrar una confirmación persistente', categoria: 'retroalimentacion', severidad: 'media', criterio_aceptacion: null, version: 1, estado: 'pendiente', historia_id: null, observaciones: [{ resultado_id: '1', texto_original: source.observacion_original, texto_revisado: source.observacion_original, tarea_titulo: source.titulo_tarea }], propuesta_ia: { resumen: 'Confirmación poco visible', mejora_sugerida: 'Mostrar una confirmación persistente', categoria: 'retroalimentacion', severidad: 'media' } }
 const group = { id: '1', estado: 'completado', intentos: 1, reintentable: false, meta: { modo: 'gemini' }, solicitud: { observaciones: [{ id: 'resultado:1', texto: source.observacion_original, tarea: { titulo: source.titulo_tarea, criterio_exito: source.criterio_exito } }] } }
 const analysis = { id: '7', plan_id: '1', estado: options.partial ? 'parcial' : 'completado', revision_en: '2026-11-27T12:00:00Z', max_intentos: 3, grupos: [group] }
 if (options.partial) analysis.grupos.push({ id: '2', estado: 'fallido', intentos: 1, reintentable: true, error: { code: 'IA_TIEMPO_AGOTADO', message: 'Tiempo agotado' }, solicitud: { observaciones: [] } })
 const state = { findings: options.empty ? [] : [finding], analyses: options.empty ? [] : [analysis], stories: [], approvals: 0, version: 1, calls: [], lost: options.approvalResponseLost,
  manualLost: options.manualResponseLost, orderConflict: options.orderConflict, failList: false, requests: new Map() }
 if (options.seedStories) state.stories = [1, 2, 3].map(n => ({ id: String(n), plan_id: '1', hallazgo_id: null, titulo: `Mejora manual ${n}`, descripcion: `Descripción ${n}`, criterio_aceptacion: `Criterio ${n}`, prioridad: 3, puntos: null, estado: 'pendiente', orden: n, version: 1, origen: 'manual' }))
 await page.route('**/api/**', async route => {
  const req = route.request(), url = new URL(req.url()), method = req.method(), body = req.postData() ? req.postDataJSON() : null
  expect(req.headers().authorization).toBe(`Bearer ${token}`)
  state.calls.push({ path: url.pathname, method, body })
  const reply = (json, status = 200) => route.fulfill({ status, json })
  if (url.pathname === '/api/planes') return reply([{ id: '1', nombre: 'Plan de guardado' }, { id: '2', nombre: 'Otro plan' }])
  const m = url.pathname.match(/^\/api\/planes\/(\d+)\/(.*)$/)
  if (!m) return reply({ message: 'Ruta no prevista en prueba' }, 404)
  const [, p, suffix] = m
  if (p !== '1') return reply(suffix === 'historias' ? { plan_id: p, version_orden: 1, historias: [] } : [])
  if (suffix === 'observaciones-ia') return reply([source])
  if (suffix === 'analisis-ia' && method === 'GET') return reply(state.analyses)
  if (suffix === 'analisis-ia' && method === 'POST') { analysis.estado = 'pendiente'; analysis.revision_en = null; analysis.grupos = [{ ...group, estado: 'pendiente', intentos: 0 }]; state.analyses = [analysis]; return reply(analysis, 201) }
  if (suffix === 'analisis-ia/7') return reply(analysis)
  if (suffix === 'analisis-ia/7/revision') { analysis.revision_en = new Date().toISOString(); analysis.grupos[0].solicitud.observaciones[0].texto = body.observaciones[0].texto; return reply(analysis) }
  if (/analisis-ia\/7\/(ejecutar|reintentar)$/.test(suffix)) { analysis.estado = 'completado'; analysis.grupos.forEach(g => { if (g.estado !== 'completado') { g.intentos++; g.estado = 'completado'; g.reintentable = false; g.meta = { modo: 'gemini' }; delete g.error } }); return reply(analysis) }
  if (suffix === 'analisis-ia/7/hallazgos') { if (!state.findings.length) state.findings = [finding]; return reply({ hallazgos: state.findings, aviso: analysis.estado === 'parcial' ? 'Importados grupos válidos; hay grupos fallidos.' : null }) }
  if (suffix === 'hallazgos') return reply(state.findings)
  if (suffix === 'hallazgos/1' && method === 'PUT') { if (body.version !== finding.version) return reply({ message: 'El hallazgo cambió. Recarga.' }, 409); Object.assign(finding, body, { version: finding.version + 1 }); return reply(finding) }
  if (suffix === 'hallazgos/1/aprobar') {
   state.approvals++
   if (!finding.historia_id) { finding.estado = 'aprobado'; finding.historia_id = '1'; finding.version++; state.stories.push({ id: '1', plan_id: '1', hallazgo_id: '1', titulo: body.titulo, descripcion: finding.mejora_sugerida, criterio_aceptacion: finding.criterio_aceptacion, prioridad: 3, puntos: null, estado: 'pendiente', orden: 1, version: 1, origen: 'hallazgo', hallazgo_resumen: finding.resumen }); state.version++ }
   if (state.lost) { state.lost = false; return reply({ message: 'Se perdió la confirmación HTTP' }, 503) }
   return reply({ hallazgo: finding, historia: state.stories[0] })
  }
  if (suffix === 'hallazgos/1/descartar') { finding.estado = 'rechazado'; finding.comentario_revision = body.comentario; finding.version++; return reply(finding) }
  if (suffix === 'hallazgos/1') return reply(finding)
  if (suffix === 'historias' && method === 'GET') {
   if (state.failList) return reply({ message: 'No se pudo consultar el backlog' }, 503)
   const stories = state.stories.filter(s => (!url.searchParams.get('estado') || s.estado === url.searchParams.get('estado')) && (!url.searchParams.get('prioridad') || String(s.prioridad) === url.searchParams.get('prioridad'))).sort((a, b) => a.orden - b.orden)
   return reply({ plan_id: '1', version_orden: state.version, historias: stories })
  }
  if (suffix === 'historias' && method === 'POST') {
   let s = state.requests.get(body.solicitud_id)
   if (!s) { s = { ...body, id: String(Math.max(0, ...state.stories.map(s => Number(s.id))) + 1), plan_id: '1', hallazgo_id: null, orden: state.stories.length + 1, version: 1, origen: 'manual' }; state.stories.push(s); state.requests.set(body.solicitud_id, s); state.version++ }
   if (state.manualLost) { state.manualLost = false; return reply({ message: 'Confirmación de guardado perdida' }, 503) }
   return reply(s, 201)
  }
  if (suffix === 'historias/orden') {
   if (state.orderConflict) { state.orderConflict = false; state.version++; return reply({ message: 'El orden cambió. Recarga el backlog.' }, 409) }
   if (body.version_orden !== state.version) return reply({ message: 'Versión de orden obsoleta' }, 409)
   body.historia_ids.forEach((id, i) => { state.stories.find(s => s.id === id).orden = i + 1 }); state.version++
   return reply({ version_orden: state.version, historia_ids: body.historia_ids })
  }
  const detail = suffix.match(/^historias\/(\d+)$/)
  if (detail && method === 'GET') { const s = state.stories.find(s => s.id === detail[1]); return s ? reply({ ...s, hallazgo: s.hallazgo_id ? finding : null }) : reply({ message: 'Historia inexistente' }, 404) }
  if (detail && method === 'PATCH') { const s = state.stories.find(s => s.id === detail[1]); if (s.version !== body.version) return reply({ message: 'La historia cambió. Recarga.' }, 409); Object.assign(s, body, { version: s.version + 1 }); return reply(s) }
  return reply({ message: 'Ruta no prevista en prueba: ' + suffix }, 501)
 })
 return state
}
export async function loginReview(page, url = '/revision?plan_id=1&hallazgo_id=1') {
 await page.goto(url)
 await page.getByLabel('Correo del equipo').fill('equipo@example.com')
 await page.getByLabel('Contraseña').fill('password-test-only')
 await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
 await expect(page.getByRole('button', { name: 'Cerrar mi sesión' })).toBeVisible()
}
