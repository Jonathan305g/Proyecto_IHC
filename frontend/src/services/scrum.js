import { request } from './apiClient.js'
const root = p => `/api/planes/${encodeURIComponent(p)}`
const json = (method, body) => ({ method, body: JSON.stringify(body) })
export const scrum = {
 listar: p => request(`${root(p)}/sprints-producto`),
 obtener: (p, s) => request(`${root(p)}/sprints-producto/${encodeURIComponent(s)}`),
 crear: (p, b) => request(`${root(p)}/sprints-producto`, json('POST', b)),
 editar: (p, s, b) => request(`${root(p)}/sprints-producto/${encodeURIComponent(s)}`, json('PUT', b)),
 responsables: p => request(`${root(p)}/responsables-producto`),
 crearResponsable: (p, b) => request(`${root(p)}/responsables-producto`, json('POST', b)),
 editarResponsable: (p, r, b) => request(`${root(p)}/responsables-producto/${encodeURIComponent(r)}`, json('PATCH', b)),
 activar: (p, s, b) => request(`${root(p)}/sprints-producto/${encodeURIComponent(s)}/activar`, json('POST', b)),
 crearTarea: (p, s, b) => request(`${root(p)}/sprints-producto/${encodeURIComponent(s)}/tareas`, json('POST', b)),
 editarTarea: (p, s, t, b) => request(`${root(p)}/sprints-producto/${encodeURIComponent(s)}/tareas/${encodeURIComponent(t)}`, json('PATCH', b)),
 retirarTarea: (p, s, t, b) => request(`${root(p)}/sprints-producto/${encodeURIComponent(s)}/tareas/${encodeURIComponent(t)}/retirar`, json('POST', b)),
 moverTarea: (p, s, t, b) => request(`${root(p)}/sprints-producto/${encodeURIComponent(s)}/tareas/${encodeURIComponent(t)}/estado`, json('POST', b)),
}
