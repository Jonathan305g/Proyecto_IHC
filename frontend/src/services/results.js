import { request } from './apiClient.js'

// Contrato propuesto a S2-06 (ver frontend/EJECUCION.md). PUT es idempotente por tarea:
// guardar dos veces actualiza el mismo resultado en lugar de duplicarlo.
export const results = {
  list: (sessionId) => request(`/api/sesiones/${sessionId}/resultados`),
  save: (sessionId, taskId, data) =>
    request(`/api/sesiones/${sessionId}/resultados/${taskId}`, { method: 'PUT', body: JSON.stringify(data) }),
}
