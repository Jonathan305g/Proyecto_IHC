import { expect } from '@playwright/test'
import { setupReview, loginReview } from './sprint3-fixtures.js'
export { loginReview as loginProduct }
export async function setupProduct(page, options = {}) {
 const review = await setupReview(page)
 const state = { review, members: [{ id: '1', alias: 'Equipo producto', activo: true, version: 1 }], sprints: [], calls: [], requests: new Map(), failSave: Boolean(options.failSave), failMove: false }
 const stories = [{ id: '1', titulo: 'Confirmación persistente', descripcion: 'Confirmar guardado', criterio_aceptacion: 'Se muestra mensaje', puntos: 3, estado: 'pendiente', version: 1, orden: 1, prioridad: 2 }, { id: '2', titulo: 'Recuperar filtros', descripcion: 'Conservar filtros', criterio_aceptacion: 'Recupera', puntos: 5, estado: 'pendiente', version: 1, orden: 2, prioridad: 3 }]
 await page.route('**/api/planes/*/**', async route => {
  const req = route.request(), url = new URL(req.url()), method = req.method(), body = req.postData() ? req.postDataJSON() : null
  const match = url.pathname.match(/^\/api\/planes\/(\d+)\/(.+)$/)
  if (!match) return route.fallback()
  const [, p, suffix] = match, reply = (json, status = 200) => route.fulfill({ status, json })
  if (!suffix.startsWith('sprints-producto') && !suffix.startsWith('responsables-producto') && suffix !== 'historias') return route.fallback()
  expect(req.headers().authorization).toMatch(/^Bearer /)
  state.calls.push({ suffix, method, body })
  if (suffix === 'historias') return reply({ plan_id: p, version_orden: 1, historias: p === '1' ? stories : [] })
  if (suffix === 'responsables-producto' && method === 'GET') return reply(state.members)
  if (suffix === 'responsables-producto' && method === 'POST') { const m = { id: String(state.members.length + 1), alias: body.alias, activo: true, version: 1 }; state.members.push(m); return reply(m, 201) }
  if (suffix === 'sprints-producto' && method === 'GET') return reply(state.sprints.filter(s => s.plan_id === p))
  const full = (b, id, version) => { const hs = b.historias.map((h, i) => ({ ...stories.find(s => s.id === h.historia_id), id: h.historia_id, responsable_id: h.responsable_id, responsable: state.members.find(m => m.id === h.responsable_id)?.alias, orden: i + 1 }))
   const total = hs.reduce((n, h) => n + h.puntos, 0)
   return { ...b, id, plan_id: p, version, estado: 'planificado', historias: hs, tareas: [], eventos: [], avance: { puntos_seleccionados: total, capacidad_restante: b.capacidad - total, puntos_entregados: 0, puntos_pendientes: total, porcentaje_puntos: 0, tareas: 0, tareas_terminadas: 0, porcentaje_tareas: null } } }
  if (suffix === 'sprints-producto' && method === 'POST') {
   if (state.failSave) { state.failSave = false; return reply({ message: 'Fallo temporal de conexión' }, 503) }
   const old = state.requests.get(body.solicitud_id); if (old) return reply(old, 201)
   const s = full(body, String(state.sprints.length + 1), 1); state.sprints.push(s); state.requests.set(body.solicitud_id, s); return reply(s, 201)
  }
  const m = suffix.match(/^sprints-producto\/(\d+)$/), s = m && state.sprints.find(s => s.id === m[1])
  if (m && method === 'GET') return s ? reply(s) : reply({ message: 'Sprint inexistente' }, 404)
  if (m && method === 'PUT') { if (s.version !== body.version) return reply({ message: 'El sprint cambió. Recarga.' }, 409); Object.assign(s, full(body, s.id, s.version + 1)); return reply(s) }
  return route.fallback()
 })
 return state
}
