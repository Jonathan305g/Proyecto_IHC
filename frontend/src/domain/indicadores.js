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
