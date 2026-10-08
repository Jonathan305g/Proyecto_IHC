import { request } from './apiClient.js'

const json = (method, data) => ({ method, body: JSON.stringify(data) })

export const plans = {
  list: () => request('/api/planes'),
  detail: (id) => request(`/api/planes/${id}`),
  create: (data) => request('/api/planes', json('POST', data)),
  update: (id, data) => request(`/api/planes/${id}`, json('PATCH', data)),
  addTask: (id, data) => request(`/api/planes/${id}/tareas`, json('POST', data)),
  updateTask: (planId, taskId, data) => request(`/api/planes/${planId}/tareas/${taskId}`, json('PATCH', data)),
}

export const sessions = {
  list: () => request('/api/sesiones'),
  detail: (id) => request(`/api/sesiones/${id}`),
  create: (data) => request('/api/sesiones', json('POST', data)),
  update: (id, data) => request(`/api/sesiones/${id}`, json('PATCH', data)),
}
