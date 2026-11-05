import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CATEGORIAS_RESULTADO,
  formatPercentage,
  formatSeconds,
  formatErrors,
  formatCount,
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



