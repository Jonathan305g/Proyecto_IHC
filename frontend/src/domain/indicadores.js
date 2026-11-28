// Lógica pura de indicadores y métricas del dashboard (S3-05 / HU-05).
// Sin React ni red, para permitir pruebas unitarias con node:test.

export const CATEGORIAS_RESULTADO = {
  sin_ayuda: {
    key: 'sin_ayuda',
    label: 'Sin ayuda',
    shortLabel: 'Autónomo',
    description: 'Completada de manera autónoma sin requerir asistencia',
    color: '#16a34a',
    bg: '#f0fdf4',
    border: '#bbf7d0',
    badgeClass: 'badge-active',
  },
  con_ayuda: {
    key: 'con_ayuda',
    label: 'Con ayuda',
    shortLabel: 'Asistido',
    description: 'Completada exitosamente recibiendo asistencia o pistas',
    color: '#d97706',
    bg: '#fffbeb',
    border: '#fde68a',
    badgeClass: 'badge-draft',
  },
  no_completado: {
    key: 'no_completado',
    label: 'No completado',
    shortLabel: 'No completado',
    description: 'No se logró completar la tarea o fue abandonada',
    color: '#dc2626',
    bg: '#fef2f2',
    border: '#fecaca',
    badgeClass: 'badge-danger',
  },
  pendiente: {
    key: 'pendiente',
    label: 'Pendiente',
    shortLabel: 'Pendiente',
    description: 'Par sesión/tarea aún sin evaluación registrada',
    color: '#64748b',
    bg: '#f8fafc',
    border: '#e2e8f0',
    badgeClass: 'badge-subtle',
  },
}

export const LISTA_CATEGORIAS = ['sin_ayuda', 'con_ayuda', 'no_completado']

/**
 * Formatea un valor porcentual.
 * Si es null o undefined, devuelve 'Sin datos'.
 * Respeta el 0 como un valor real '0%'.
 * Redondea a 2 decimales si tiene parte fraccionaria.
 */
export function formatPercentage(value, fallback = 'Sin datos') {
  if (value === null || value === undefined) return fallback
  const num = Number(value)
  if (Number.isNaN(num)) return fallback
  return Number.isInteger(num) ? `${num}%` : `${num.toFixed(2)}%`
}

/**
 * Formatea una duración en segundos con su unidad ('s').
 * Si es null o undefined, devuelve 'Sin datos'.
 * Respeta el 0 como '0 s'.
 */
export function formatSeconds(value, fallback = 'Sin datos') {
  if (value === null || value === undefined) return fallback
  const num = Number(value)
  if (Number.isNaN(num)) return fallback
  return Number.isInteger(num) ? `${num} s` : `${num.toFixed(2)} s`
}

/**
 * Formatea el promedio de errores.
 * Si es null o undefined, devuelve 'Sin datos'.
 * Respeta el 0 como '0.00' (o '0').
 */
export function formatErrors(value, fallback = 'Sin datos') {
  if (value === null || value === undefined) return fallback
  const num = Number(value)
  if (Number.isNaN(num)) return fallback
  return Number.isInteger(num) ? `${num}` : `${num.toFixed(2)}`
}

/**
 * Formatea un conteo entero con su unidad opcional.
 */
export function formatCount(value, unit = '', fallback = 'Sin datos') {
  if (value === null || value === undefined) return fallback
  const num = Number(value)
  if (Number.isNaN(num)) return fallback
  return unit ? `${num} ${unit}` : `${num}`
}

/**
 * Zona horaria de Ecuador continental (UTC-05:00 / America/Guayaquil).
 */
export const ECUADOR_TIMEZONE_OFFSET = '-05:00'

/**
 * Convierte una fecha a formato ISO 8601 con zona horaria explícita.
 * Cumple con el contrato S3-01 / S3-04:
 * - Para límites de inicio ('desde'): establece 00:00:00 en la zona seleccionada.
 * - Para límites de fin ('hasta'): calcula el inicio del día siguiente exclusivo (00:00:00),
 *   abarcando completamente el día seleccionado por el usuario en su zona local.
 * Si ya viene en formato ISO completo con Z o zona (contiene 'T'), se valida y conserva.
 */
export function formatDateToIsoLimit(dateString, isEnd = false, offset = ECUADOR_TIMEZONE_OFFSET) {
  if (!dateString || typeof dateString !== 'string') return null
  const trimmed = dateString.trim()
  if (!trimmed) return null

  // Si ya es un timestamp ISO 8601 con zona explícita
  if (trimmed.includes('T')) {
    const isoRegex = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-](\d{2}):(\d{2}))$/
    if (!isoRegex.test(trimmed)) {
      throw new Error(`Formato de fecha ISO inválido: ${trimmed}`)
    }
    return trimmed
  }

  // Si viene en formato fecha 'YYYY-MM-DD'
  const dateRegex = /^(\d{4})-(\d{2})-(\d{2})$/
  const match = dateRegex.exec(trimmed)
  if (!match) {
    throw new Error(`Formato de fecha inválido (se esperaba YYYY-MM-DD): ${trimmed}`)
  }

  const [, year, month, day] = match
  const y = Number(year), m = Number(month), d = Number(day)
  const isLeap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)
  const daysInMonth = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth[m - 1]) {
    throw new Error(`Fecha de calendario inválida: ${trimmed}`)
  }

  if (!isEnd) {
    return `${trimmed}T00:00:00${offset}`
  }

  // Para límite superior ('hasta' exclusivo en SQL), sumar 1 día calendario en UTC
  const nextDate = new Date(Date.UTC(y, m - 1, d + 1))
  const nextDateStr = nextDate.toISOString().slice(0, 10)
  return `${nextDateStr}T00:00:00${offset}`
}

/**
 * Valida los parámetros de filtro antes de enviarlos a la API S3-04 (HU-05 / S3-06).
 * Reglas del contrato:
 * - Selección de tareas no puede estar vacía si se personaliza.
 * - Período debe cumplir desde < hasta.
 * - Restablecer utiliza NULL para período y tareas.
 */
export function validateIndicatorFilters({
  desdeDate = '',
  hastaDate = '',
  selectedTaskIds = [],
  allTaskIds = [],
  offset = ECUADOR_TIMEZONE_OFFSET,
} = {}) {
  // 1. Validar selección de tareas
  const normalizedTaskIds = (selectedTaskIds || []).map(String)
  const normalizedAllIds = (allTaskIds || []).map(String)

  if (normalizedAllIds.length > 0 && normalizedTaskIds.length === 0) {
    return {
      valid: false,
      error: 'La selección de tareas no puede estar vacía. Selecciona al menos una tarea del plan.',
      filters: null,
    }
  }

  // Si todas las tareas del plan están seleccionadas o no hay tareas especificadas,
  // enviar null para que la consulta incluya todas las tareas (contrato S3-01 / S3-04).
  const allSelected =
    normalizedAllIds.length > 0 &&
    normalizedTaskIds.length === normalizedAllIds.length &&
    normalizedAllIds.every((id) => normalizedTaskIds.includes(id))

  const finalTareaIds = allSelected || normalizedTaskIds.length === 0 ? null : normalizedTaskIds

  // 2. Validar fechas
  let desdeIso = null
  let hastaIso = null

  try {
    desdeIso = formatDateToIsoLimit(desdeDate, false, offset)
  } catch (err) {
    return {
      valid: false,
      error: `Fecha "Desde" inválida: ${err.message}`,
      filters: null,
    }
  }

  try {
    hastaIso = formatDateToIsoLimit(hastaDate, true, offset)
  } catch (err) {
    return {
      valid: false,
      error: `Fecha "Hasta" inválida: ${err.message}`,
      filters: null,
    }
  }

  if (desdeIso && hastaIso) {
    const startMillis = Date.parse(desdeIso)
    const endMillis = Date.parse(hastaIso)
    if (startMillis >= endMillis) {
      return {
        valid: false,
        error: 'El período es inválido: la fecha de inicio ("Desde") debe ser anterior a la fecha de fin ("Hasta").',
        filters: null,
      }
    }
  }

  return {
    valid: true,
    error: null,
    filters: {
      desde: desdeIso,
      hasta: hastaIso,
      tarea_ids: finalTareaIds,
    },
  }
}

/**
 * Determina si hay algún filtro actualmente activo.
 */
export function hasActiveFilters(filters) {
  if (!filters) return false
  return Boolean(
    filters.desde ||
    filters.hasta ||
    (Array.isArray(filters.tarea_ids) && filters.tarea_ids.length > 0) ||
    (typeof filters.tarea_ids === 'string' && filters.tarea_ids.trim().length > 0)
  )
}

/**
 * Genera una descripción legible para el usuario de los filtros activos.
 */
export function describeActiveFilters(filters) {
  if (!hasActiveFilters(filters)) return 'Reporte completo (sin filtros activos)'
  const parts = []

  if (filters.desde || filters.hasta) {
    const desdeStr = filters.desde ? filters.desde.slice(0, 10) : 'Inicio'
    const hastaStr = filters.hasta ? filters.hasta.slice(0, 10) : 'Fin'
    parts.push(`Período [${desdeStr} a ${hastaStr}]`)
  }

  if (filters.tarea_ids) {
    const ids = Array.isArray(filters.tarea_ids)
      ? filters.tarea_ids
      : String(filters.tarea_ids).split(',')
    const count = ids.length
    parts.push(`${count} ${count === 1 ? 'tarea seleccionada' : 'tareas seleccionadas'}`)
  }

  return parts.join(' · ')
}

/**
 * Reporte de referencia oficial S3-01 / S3-04 (Caso 1 de verificación: 6 evaluados, 3 pendientes).
 * Puede usarse para pruebas y desarrollo paralelo.
 */
export const MOCK_S301_REFERENCE_REPORT = {
  version: '1.0',
  filtro_valido: true,
  error_filtro: null,
  filtros: {
    plan_id: '101',
    desde: '2026-10-20T00:00:00Z',
    hasta: '2026-10-22T00:00:00Z',
    tarea_ids: null,
  },
  sesiones_incluidas: 3,
  tareas_seleccionadas: 3,
  general: {
    esperados: 9,
    evaluados: 6,
    pendientes: 3,
    cobertura_porcentaje: 66.67,
    por_resultado: {
      sin_ayuda: {
        cantidad: 3,
        porcentaje: 50,
        tiempo: { n: 2, total_segundos: 30, promedio_segundos: 15 },
        errores: { n: 3, total: 0, promedio: 0 },
      },
      con_ayuda: {
        cantidad: 2,
        porcentaje: 33.33,
        tiempo: { n: 2, total_segundos: 110, promedio_segundos: 55 },
        errores: { n: 2, total: 3, promedio: 1.5 },
      },
      no_completado: {
        cantidad: 1,
        porcentaje: 16.67,
        tiempo: { n: 1, total_segundos: 90, promedio_segundos: 90 },
        errores: { n: 1, total: 3, promedio: 3 },
      },
    },
  },
  por_tarea: [
    {
      tarea_id: '1001',
      codigo: 'T1',
      titulo: 'Buscar producto en catálogo',
      esperados: 3,
      evaluados: 3,
      pendientes: 0,
      cobertura_porcentaje: 100,
      por_resultado: {
        sin_ayuda: {
          cantidad: 1,
          porcentaje: 33.33,
          tiempo: { n: 1, total_segundos: 30, promedio_segundos: 30 },
          errores: { n: 1, total: 0, promedio: 0 },
        },
        con_ayuda: {
          cantidad: 1,
          porcentaje: 33.33,
          tiempo: { n: 1, total_segundos: 50, promedio_segundos: 50 },
          errores: { n: 1, total: 1, promedio: 1 },
        },
        no_completado: {
          cantidad: 1,
          porcentaje: 33.33,
          tiempo: { n: 1, total_segundos: 90, promedio_segundos: 90 },
          errores: { n: 1, total: 3, promedio: 3 },
        },
      },
    },
    {
      tarea_id: '1002',
      codigo: 'T2',
      titulo: 'Agregar producto al carrito',
      esperados: 3,
      evaluados: 3,
      pendientes: 0,
      cobertura_porcentaje: 100,
      por_resultado: {
        sin_ayuda: {
          cantidad: 2,
          porcentaje: 66.67,
          tiempo: { n: 1, total_segundos: 0, promedio_segundos: 0 },
          errores: { n: 2, total: 0, promedio: 0 },
        },
        con_ayuda: {
          cantidad: 1,
          porcentaje: 33.33,
          tiempo: { n: 1, total_segundos: 60, promedio_segundos: 60 },
          errores: { n: 1, total: 2, promedio: 2 },
        },
        no_completado: {
          cantidad: 0,
          porcentaje: 0,
          tiempo: { n: 0, total_segundos: null, promedio_segundos: null },
          errores: { n: 0, total: 0, promedio: null },
        },
      },
    },
    {
      tarea_id: '1003',
      codigo: 'T3',
      titulo: 'Completar formulario de checkout',
      esperados: 3,
      evaluados: 0,
      pendientes: 3,
      cobertura_porcentaje: 0,
      por_resultado: {
        sin_ayuda: {
          cantidad: 0,
          porcentaje: null,
          tiempo: { n: 0, total_segundos: null, promedio_segundos: null },
          errores: { n: 0, total: 0, promedio: null },
        },
        con_ayuda: {
          cantidad: 0,
          porcentaje: null,
          tiempo: { n: 0, total_segundos: null, promedio_segundos: null },
          errores: { n: 0, total: 0, promedio: null },
        },
        no_completado: {
          cantidad: 0,
          porcentaje: null,
          tiempo: { n: 0, total_segundos: null, promedio_segundos: null },
          errores: { n: 0, total: 0, promedio: null },
        },
      },
    },
  ],
}

