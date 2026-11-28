import { setupProduct } from './sprint4-fixtures.js'
export function referenceComparison(empty = false) {
 const cat = (cantidad, pct, time, errors) => ({ cantidad, porcentaje: pct, tiempo: { n: cantidad, total_segundos: time == null ? null : time * cantidad, promedio_segundos: time }, errores: { n: cantidad, total: errors == null ? null : errors * cantidad, promedio: errors } })
 const a = { tarea_id: '1', titulo: 'Guardar A', esperados: 2, evaluados: 2, pendientes: 0, cobertura_porcentaje: 100, por_resultado: { sin_ayuda: cat(1, 50, 60, 1), con_ayuda: cat(1, 50, 90, 2), no_completado: cat(0, 0, null, null) } }
 const b = { ...a, tarea_id: '11', titulo: 'Guardar B', por_resultado: { sin_ayuda: cat(2, 100, 50, 0.5), con_ayuda: cat(0, 0, null, null), no_completado: cat(0, 0, null, null) } }
 const variacion = { sin_ayuda: { porcentaje_pp: 50, tiempo_segundos: -10, errores_promedio: -0.5 }, con_ayuda: { porcentaje_pp: -50, tiempo_segundos: null, errores_promedio: null }, no_completado: { porcentaje_pp: 0, tiempo_segundos: null, errores_promedio: null } }
 return { estado: empty ? 'sin_comparables' : 'comparable', fuente_a: { filtros: { plan_id: '1' } }, fuente_b: { filtros: { plan_id: '2' } }, avisos: empty ? ['No existen pares de tareas con evaluaciones registradas en ambos conjuntos.'] : ['La variación se calcula B menos A.'], pares: empty ? [] : [{ a, b, comparable: true, variacion }], agregado: empty ? null : { a, b, variacion }, excluidas: { a: [{ tarea_id: '2', titulo: 'Exclusiva A' }], b: [{ tarea_id: '12', titulo: 'Exclusiva B' }] } }
}
export async function setupComparison(page) {
 const state = await setupProduct(page)
 await page.route('**/api/planes/*', route => { const id = new URL(route.request().url()).pathname.split('/').pop(); return route.fulfill({ json: { id, nombre: `Evaluación ${id}`, tareas: id === '1' ? [{ id: '1', titulo: 'Guardar A' }, { id: '2', titulo: 'Exclusiva A' }] : [{ id: '11', titulo: 'Guardar B' }, { id: '12', titulo: 'Exclusiva B' }] } }) })
 await page.route('**/api/comparaciones', route => route.fulfill({ json: referenceComparison(route.request().postDataJSON().equivalencias.length === 0) }))
 return state
}
