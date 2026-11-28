import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CATEGORIAS_RESULTADO,
  formatPercentage,
  formatSeconds,
  formatErrors,
  formatCount,
  formatDateToIsoLimit,
  validateIndicatorFilters,
  hasActiveFilters,
  describeActiveFilters,
  ECUADOR_TIMEZONE_OFFSET,
  MOCK_S301_REFERENCE_REPORT,
} from '../src/domain/indicadores.js'
import { buildQueryString } from '../src/services/indicadores.js'

test('formatPercentage formatea valores numéricos y distingue null de 0', () => {
  assert.equal(formatPercentage(null), 'Sin datos')
  assert.equal(formatPercentage(undefined), 'Sin datos')
  assert.equal(formatPercentage(0), '0%')
  assert.equal(formatPercentage(50), '50%')
  assert.equal(formatPercentage(66.67), '66.67%')
  assert.equal(formatPercentage(33.3333), '33.33%')
})

test('formatSeconds formatea duraciones con unidad "s" y distingue null de 0', () => {
  assert.equal(formatSeconds(null), 'Sin datos')
  assert.equal(formatSeconds(undefined), 'Sin datos')
  assert.equal(formatSeconds(0), '0 s')
  assert.equal(formatSeconds(15), '15 s')
  assert.equal(formatSeconds(55.5), '55.50 s')
  assert.equal(formatSeconds(12.345), '12.35 s')
})

test('formatErrors formatea promedios de error y distingue null de 0', () => {
  assert.equal(formatErrors(null), 'Sin datos')
  assert.equal(formatErrors(undefined), 'Sin datos')
  assert.equal(formatErrors(0), '0')
  assert.equal(formatErrors(1.5), '1.50')
  assert.equal(formatErrors(3), '3')
})

test('formatCount muestra enteros y unidades opcionales', () => {
  assert.equal(formatCount(null), 'Sin datos')
  assert.equal(formatCount(0, 'sesiones'), '0 sesiones')
  assert.equal(formatCount(6, 'evaluaciones'), '6 evaluaciones')
})

test('reporte de referencia S3-01 cumple coherencia entre general y por_tarea', () => {
  const report = MOCK_S301_REFERENCE_REPORT
  assert.equal(report.version, '1.0')
  assert.equal(report.filtro_valido, true)
  assert.equal(report.sesiones_incluidas, 3)
  assert.equal(report.tareas_seleccionadas, 3)

  // Coherencia general
  assert.equal(report.general.esperados, 9)
  assert.equal(report.general.evaluados, 6)
  assert.equal(report.general.pendientes, 3)
  assert.equal(report.general.cobertura_porcentaje, 66.67)

  // Suma de cantidades por categoría
  const sinAyuda = report.general.por_resultado.sin_ayuda
  const conAyuda = report.general.por_resultado.con_ayuda
  const noComp = report.general.por_resultado.no_completado
  assert.equal(sinAyuda.cantidad + conAyuda.cantidad + noComp.cantidad, report.general.evaluados)

  // Categorías diferenciadas
  assert.equal(sinAyuda.cantidad, 3)
  assert.equal(sinAyuda.porcentaje, 50)
  assert.equal(conAyuda.cantidad, 2)
  assert.equal(conAyuda.porcentaje, 33.33)
  assert.equal(noComp.cantidad, 1)
  assert.equal(noComp.porcentaje, 16.67)

  // Tareas suman el mismo universo esperado
  const sumaEsperados = report.por_tarea.reduce((acc, t) => acc + t.esperados, 0)
  const sumaEvaluados = report.por_tarea.reduce((acc, t) => acc + t.evaluados, 0)
  const sumaPendientes = report.por_tarea.reduce((acc, t) => acc + t.pendientes, 0)
  assert.equal(sumaEsperados, report.general.esperados)
  assert.equal(sumaEvaluados, report.general.evaluados)
  assert.equal(sumaPendientes, report.general.pendientes)

  // Categorías en metadatos
  assert.ok(CATEGORIAS_RESULTADO.sin_ayuda)
  assert.ok(CATEGORIAS_RESULTADO.con_ayuda)
  assert.ok(CATEGORIAS_RESULTADO.no_completado)
  assert.ok(CATEGORIAS_RESULTADO.pendiente)
})

test('plan sin sesiones maneja ceros y nulls coherentemente como "Sin datos"', () => {
  const planVacio = {
    sesiones_incluidas: 0,
    tareas_seleccionadas: 2,
    general: {
      esperados: 0,
      evaluados: 0,
      pendientes: 0,
      cobertura_porcentaje: null,
      por_resultado: {
        sin_ayuda: { cantidad: 0, porcentaje: null, tiempo: { n: 0, total_segundos: null, promedio_segundos: null }, errores: { n: 0, total: 0, promedio: null } },
        con_ayuda: { cantidad: 0, porcentaje: null, tiempo: { n: 0, total_segundos: null, promedio_segundos: null }, errores: { n: 0, total: 0, promedio: null } },
        no_completado: { cantidad: 0, porcentaje: null, tiempo: { n: 0, total_segundos: null, promedio_segundos: null }, errores: { n: 0, total: 0, promedio: null } },
      },
    },
    por_tarea: [
      {
        tarea_id: '1',
        codigo: 'T1',
        titulo: 'Tarea sin sesiones',
        esperados: 0,
        evaluados: 0,
        pendientes: 0,
        cobertura_porcentaje: null,
        por_resultado: {
          sin_ayuda: { cantidad: 0, porcentaje: null, tiempo: { n: 0, total_segundos: null, promedio_segundos: null }, errores: { n: 0, total: 0, promedio: null } },
          con_ayuda: { cantidad: 0, porcentaje: null, tiempo: { n: 0, total_segundos: null, promedio_segundos: null }, errores: { n: 0, total: 0, promedio: null } },
          no_completado: { cantidad: 0, porcentaje: null, tiempo: { n: 0, total_segundos: null, promedio_segundos: null }, errores: { n: 0, total: 0, promedio: null } },
        },
      },
    ],
  }

  // Verificación de formateo
  assert.equal(formatCount(planVacio.sesiones_incluidas, 'sesiones'), '0 sesiones')
  assert.equal(formatPercentage(planVacio.general.cobertura_porcentaje), 'Sin datos')
  assert.equal(formatPercentage(planVacio.general.por_resultado.sin_ayuda.porcentaje), 'Sin datos')
  assert.equal(formatSeconds(planVacio.general.por_resultado.sin_ayuda.tiempo.promedio_segundos), 'Sin datos')
  assert.equal(formatErrors(planVacio.general.por_resultado.sin_ayuda.errores.promedio), 'Sin datos')
  assert.equal(planVacio.general.por_resultado.sin_ayuda.cantidad, 0)
})

test('distinción estricta de éxito sin ayuda y con ayuda', () => {
  const report = MOCK_S301_REFERENCE_REPORT
  const sinAyuda = report.general.por_resultado.sin_ayuda
  const conAyuda = report.general.por_resultado.con_ayuda

  // No se mezclan categorías: 3 sin ayuda + 2 con ayuda = 5 éxitos en total, pero separados
  assert.notEqual(sinAyuda.cantidad, conAyuda.cantidad)
  assert.equal(sinAyuda.cantidad, 3)
  assert.equal(conAyuda.cantidad, 2)
  assert.equal(sinAyuda.porcentaje, 50)
  assert.equal(conAyuda.porcentaje, 33.33)

  // Tiempos promedio diferenciados con unidad en segundos
  assert.equal(formatSeconds(sinAyuda.tiempo.promedio_segundos), '15 s')
  assert.equal(formatSeconds(conAyuda.tiempo.promedio_segundos), '55 s')

  // Errores promedio diferenciados
  assert.equal(formatErrors(sinAyuda.errores.promedio), '0')
  assert.equal(formatErrors(conAyuda.errores.promedio), '1.50')
})

test('buildQueryString serializa parámetros correctamente', () => {
  assert.equal(buildQueryString({}), '')
  assert.equal(
    buildQueryString({ desde: '2026-10-20T00:00:00Z', hasta: '2026-10-22T00:00:00Z' }),
    '?desde=2026-10-20T00%3A00%3A00Z&hasta=2026-10-22T00%3A00%3A00Z'
  )
  assert.equal(
    buildQueryString({ tarea_ids: ['1001', '1002'] }),
    '?tarea_ids=1001%2C1002'
  )
  assert.equal(
    buildQueryString({ tarea_ids: '1001,1002' }),
    '?tarea_ids=1001%2C1002'
  )
})

test('formatDateToIsoLimit convierte fechas YYYY-MM-DD y timestamps según contrato S3-01/S3-04', () => {
  assert.equal(formatDateToIsoLimit(''), null)
  assert.equal(formatDateToIsoLimit(null), null)

  // Desde (inicio inclusivo a las 00:00:00 del día local Ecuador)
  assert.equal(
    formatDateToIsoLimit('2026-10-20', false),
    '2026-10-20T00:00:00-05:00'
  )

  // Hasta (fin exclusivo: inicio del día siguiente calendario)
  assert.equal(
    formatDateToIsoLimit('2026-10-22', true),
    '2026-10-23T00:00:00-05:00'
  )

  // Transiciones de fin de mes y año
  assert.equal(formatDateToIsoLimit('2026-10-31', true), '2026-11-01T00:00:00-05:00')
  assert.equal(formatDateToIsoLimit('2026-12-31', true), '2027-01-01T00:00:00-05:00')
  assert.equal(formatDateToIsoLimit('2024-02-28', true), '2024-02-29T00:00:00-05:00') // bisiesto
  assert.equal(formatDateToIsoLimit('2026-02-28', true), '2026-03-01T00:00:00-05:00') // no bisiesto

  // Mantiene formato si ya es ISO con Z u offset
  assert.equal(
    formatDateToIsoLimit('2026-10-20T05:00:00Z', false),
    '2026-10-20T05:00:00Z'
  )

  // Rechaza fechas inválidas
  assert.throws(() => formatDateToIsoLimit('2026-02-29', false), /Fecha de calendario inválida/)
  assert.throws(() => formatDateToIsoLimit('2026-13-01', false), /Fecha de calendario inválida/)
  assert.throws(() => formatDateToIsoLimit('invalida', false), /Formato de fecha inválido/)
})

test('validateIndicatorFilters valida reglas de selección de tareas (S3-06)', () => {
  const allTaskIds = ['1001', '1002', '1003']

  // Selección vacía de tareas es inválida (contrato S3-01 / S3-04)
  const emptyRes = validateIndicatorFilters({
    selectedTaskIds: [],
    allTaskIds,
  })
  assert.equal(emptyRes.valid, false)
  assert.match(emptyRes.error, /selección de tareas no puede estar vacía/)

  // Todas las tareas seleccionadas normaliza tarea_ids a null (reporte completo)
  const allRes = validateIndicatorFilters({
    selectedTaskIds: ['1001', '1002', '1003'],
    allTaskIds,
  })
  assert.equal(allRes.valid, true)
  assert.equal(allRes.error, null)
  assert.equal(allRes.filters.tarea_ids, null)

  // Subconjunto de tareas conserva el array seleccionado
  const subRes = validateIndicatorFilters({
    selectedTaskIds: ['1001', '1002'],
    allTaskIds,
  })
  assert.equal(subRes.valid, true)
  assert.deepEqual(subRes.filters.tarea_ids, ['1001', '1002'])
})

test('validateIndicatorFilters valida coherencia de período desde < hasta', () => {
  // Rango válido
  const validRange = validateIndicatorFilters({
    desdeDate: '2026-10-20',
    hastaDate: '2026-10-22',
  })
  assert.equal(validRange.valid, true)
  assert.equal(validRange.filters.desde, '2026-10-20T00:00:00-05:00')
  assert.equal(validRange.filters.hasta, '2026-10-23T00:00:00-05:00')

  // Mismo día (válido porque 'hasta' exclusivo se extiende al inicio del día siguiente)
  const sameDay = validateIndicatorFilters({
    desdeDate: '2026-10-20',
    hastaDate: '2026-10-20',
  })
  assert.equal(sameDay.valid, true)
  assert.equal(sameDay.filters.desde, '2026-10-20T00:00:00-05:00')
  assert.equal(sameDay.filters.hasta, '2026-10-21T00:00:00-05:00')

  // Rango invertido
  const inverted = validateIndicatorFilters({
    desdeDate: '2026-10-25',
    hastaDate: '2026-10-20',
  })
  assert.equal(inverted.valid, false)
  assert.match(inverted.error, /debe ser anterior a la fecha de fin/)

  // Rango invertido con ISO timestamps explícitos
  const invertedIso = validateIndicatorFilters({
    desdeDate: '2026-10-22T00:00:00Z',
    hastaDate: '2026-10-20T00:00:00Z',
  })
  assert.equal(invertedIso.valid, false)
  assert.match(invertedIso.error, /debe ser anterior a la fecha de fin/)
})

test('hasActiveFilters y describeActiveFilters informan el estado actual de filtros', () => {
  assert.equal(hasActiveFilters(null), false)
  assert.equal(hasActiveFilters({ desde: null, hasta: null, tarea_ids: null }), false)
  assert.equal(describeActiveFilters(null), 'Reporte completo (sin filtros activos)')

  const withPeriod = { desde: '2026-10-20T00:00:00-05:00', hasta: '2026-10-22T00:00:00-05:00', tarea_ids: null }
  assert.equal(hasActiveFilters(withPeriod), true)
  assert.match(describeActiveFilters(withPeriod), /Período \[2026-10-20 a 2026-10-22\]/)

  const withTasks = { desde: null, hasta: null, tarea_ids: ['1001', '1002'] }
  assert.equal(hasActiveFilters(withTasks), true)
  assert.match(describeActiveFilters(withTasks), /2 tareas seleccionadas/)

  const combined = { desde: '2026-10-20T00:00:00-05:00', hasta: null, tarea_ids: ['1001'] }
  assert.equal(hasActiveFilters(combined), true)
  assert.match(describeActiveFilters(combined), /1 tarea seleccionada/)
})



