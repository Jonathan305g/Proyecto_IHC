import { request } from './apiClient.js'

/**
 * Servicio para consultar la API de indicadores S3-04 (HU-05).
 * Todas las peticiones van autenticadas con Supabase Bearer token.
 */
export const indicadores = {
  /**
   * Consulta el reporte completo de indicadores de un plan (general + por_tarea).
   * @param {string|number} planId - Identificador del plan
   * @param {object} [filters={}] - Filtros opcionales
   * @param {string} [filters.desde] - Límite inclusivo ISO 8601 con zona
   * @param {string} [filters.hasta] - Límite exclusivo ISO 8601 con zona
   * @param {string|string[]} [filters.tarea_ids] - IDs separados por coma o array
   * @returns {Promise<import('../../../backend/src/indicators.types.js').IndicatorsReport>}
   */
  async getReport(planId, filters = {}) {
    const query = buildQueryString(filters)
    return request(`/api/planes/${planId}/indicadores${query}`)
  },

  /**
   * Consulta únicamente los indicadores generales del plan.
   */
  async getGeneral(planId, filters = {}) {
    const query = buildQueryString(filters)
    return request(`/api/planes/${planId}/indicadores/general${query}`)
  },

  /**
   * Consulta únicamente el desglose por tareas del plan.
   */
  async getTasks(planId, filters = {}) {
    const query = buildQueryString(filters)
    return request(`/api/planes/${planId}/indicadores/tareas${query}`)
  },
}

/**
 * Serializa de forma segura los parámetros URLSearchParams.
 */
export function buildQueryString(filters = {}) {
  const params = new URLSearchParams()
  if (filters.desde) params.set('desde', filters.desde)
  if (filters.hasta) params.set('hasta', filters.hasta)
  if (filters.tarea_ids) {
    const value = Array.isArray(filters.tarea_ids) ? filters.tarea_ids.join(',') : String(filters.tarea_ids).trim()
    if (value) params.set('tarea_ids', value)
  }
  const str = params.toString()
  return str ? `?${str}` : ''
}

