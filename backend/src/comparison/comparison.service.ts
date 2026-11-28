import { BadRequestException, Injectable } from '@nestjs/common'
import { DatabaseService } from '../database.service'
import { IndicatorsService } from '../indicators.service'
import { Indicators } from '../indicators.types'
import { parseIndicatorFilters } from '../dto/indicadores.dto'
import { fields, object } from '../validation'
import { identificador } from '../scrum/scrum.dto'

export const categorias = ['sin_ayuda', 'con_ayuda', 'no_completado'] as const
const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
const diff = (a: number | null, b: number | null) => a == null || b == null ? null : round(b - a)
export function agregar(rows: Indicators[]): Indicators {
 const esperados = rows.reduce((n, r) => n + r.esperados, 0), evaluados = rows.reduce((n, r) => n + r.evaluados, 0)
 const out: Indicators = { esperados, evaluados, pendientes: esperados - evaluados, cobertura_porcentaje: esperados ? round(evaluados / esperados * 100) : null, por_resultado: {} as Indicators['por_resultado'] }
 for (const k of categorias) {
  const values = rows.map(r => r.por_resultado[k]), cantidad = values.reduce((n, c) => n + c.cantidad, 0)
  const nt = values.reduce((n, c) => n + c.tiempo.n, 0), ne = values.reduce((n, c) => n + c.errores.n, 0)
  const tt = values.reduce((n, c) => n + Number(c.tiempo.total_segundos ?? 0), 0), te = values.reduce((n, c) => n + Number(c.errores.total ?? 0), 0)
  out.por_resultado[k] = { cantidad, porcentaje: evaluados ? round(cantidad / evaluados * 100) : null,
   tiempo: { n: nt, total_segundos: nt ? tt : null, promedio_segundos: nt ? round(tt / nt) : null },
   errores: { n: ne, total: ne ? te : null, promedio: ne ? round(te / ne) : null } }
 }
 return out
}
export function diferencias(a: Indicators, b: Indicators) {
 return Object.fromEntries(categorias.map(k => [k, { porcentaje_pp: diff(a.por_resultado[k].porcentaje, b.por_resultado[k].porcentaje),
  tiempo_segundos: diff(a.por_resultado[k].tiempo.promedio_segundos, b.por_resultado[k].tiempo.promedio_segundos), errores_promedio: diff(a.por_resultado[k].errores.promedio, b.por_resultado[k].errores.promedio) }]))
}
export function parseComparison(value: unknown) {
 const input = object(value); fields(input, ['a', 'b', 'equivalencias'])
 const scope = (v: unknown) => { const s = object(v); fields(s, ['plan_id', 'desde', 'hasta']); const { plan_id, ...q } = s; return parseIndicatorFilters(plan_id, q) }
 const a = scope(input.a), b = scope(input.b)
 if (!Array.isArray(input.equivalencias) || input.equivalencias.length > 100) throw new BadRequestException('equivalencias debe ser una lista de hasta 100 pares.')
 const pairs = input.equivalencias.map(v => { const m = object(v); fields(m, ['tarea_a', 'tarea_b']); return { tarea_a: identificador(m.tarea_a), tarea_b: identificador(m.tarea_b) } })
 if (new Set(pairs.map(m => m.tarea_a)).size !== pairs.length || new Set(pairs.map(m => m.tarea_b)).size !== pairs.length) throw new BadRequestException('Las equivalencias deben ser uno a uno, sin repetir tareas.')
 return { a, b, pairs }
}
@Injectable()
export class ComparisonService {
 constructor(private readonly db: DatabaseService, private readonly metrics: IndicatorsService) {}
 async comparar(value: unknown) {
  const { a, b, pairs } = parseComparison(value)
  return this.db.transaction(async db => {
   await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')
   const query = (s: typeof a) => ({ ...(s.desde ? { desde: s.desde } : {}), ...(s.hasta ? { hasta: s.hasta } : {}) })
   const ra = await this.metrics.report(a.plan_id, query(a), db), rb = await this.metrics.report(b.plan_id, query(b), db)
   const scopeKey = (s: typeof ra) => JSON.stringify([s.filtros.plan_id, s.filtros.desde, s.filtros.hasta])
   if (scopeKey(ra) === scopeKey(rb)) throw new BadRequestException('Selecciona evaluaciones o periodos distintos.')
   const pares = pairs.map(m => {
    const ta = ra.por_tarea.find(t => t.tarea_id === m.tarea_a), tb = rb.por_tarea.find(t => t.tarea_id === m.tarea_b)
    if (!ta || !tb) throw new BadRequestException('Cada tarea debe pertenecer a la evaluacion indicada.')
    const comparable = ta.evaluados > 0 && tb.evaluados > 0
    return { a: ta, b: tb, comparable, variacion: comparable ? diferencias(ta, tb) : null }
   })
   const validos = pares.filter(m => m.comparable), aa = agregar(validos.map(m => m.a)), ab = agregar(validos.map(m => m.b))
   const avisos = ['La variacion se calcula B menos A. Tasas en puntos porcentuales; tiempo en segundos y errores por evaluacion, separados por resultado.']
   if (!validos.length) avisos.push('No existen pares de tareas con evaluaciones registradas en ambos conjuntos. No se calcula un agregado comparable.')
   if (pares.some(m => !m.comparable)) avisos.push('Los pares sin registros evaluados en ambos lados se muestran, pero se excluyen del agregado.')
   if (validos.some(m => m.a.esperados !== m.b.esperados || m.a.evaluados !== m.b.evaluados || m.a.cobertura_porcentaje !== m.b.cobertura_porcentaje)) avisos.push('Las coberturas o denominadores difieren: interpreta las tasas junto con los conteos. Los totales brutos no representan una mejora directamente comparable.')
   return { version: '1.0', generado_en: new Date().toISOString(), estado: validos.length ? 'comparable' : 'sin_comparables',
    fuente_a: { filtros: ra.filtros, sesiones: ra.sesiones_incluidas }, fuente_b: { filtros: rb.filtros, sesiones: rb.sesiones_incluidas }, pares,
    excluidas: { a: ra.por_tarea.filter(t => !pairs.some(m => m.tarea_a === t.tarea_id)), b: rb.por_tarea.filter(t => !pairs.some(m => m.tarea_b === t.tarea_id)) },
    agregado: validos.length ? { a: aa, b: ab, variacion: diferencias(aa, ab) } : null, avisos }
  })
 }
}
