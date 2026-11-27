import { request } from './apiClient.js'
const base = plan => `/api/planes/${encodeURIComponent(plan)}/historias`
export const backlog = {
  listar(plan, filters = {}) {
    const q = new URLSearchParams()
    if (filters.estado) q.set('estado', filters.estado)
    if (filters.prioridad) q.set('prioridad', filters.prioridad)
    return request(`${base(plan)}${q.size ? `?${q}` : ''}`)
  },
  crear: (plan, body) => request(base(plan), { method: 'POST', body: JSON.stringify(body) }),
  editar: (plan, story, body) => request(`${base(plan)}/${encodeURIComponent(story)}`, { method: 'PATCH', body: JSON.stringify(body) }),
  ordenar: (plan, body) => request(`${base(plan)}/orden`, { method: 'PUT', body: JSON.stringify(body) }),
}
