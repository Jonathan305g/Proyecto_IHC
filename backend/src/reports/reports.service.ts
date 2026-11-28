import { BadRequestException, Injectable, NotFoundException, PayloadTooLargeException } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { DatabaseService } from '../database.service'
import { IndicatorsService } from '../indicators.service'
import { ComparisonService } from '../comparison/comparison.service'
import { parseIndicatorFilters } from '../dto/indicadores.dto'
import { fields, object } from '../validation'
import { redactarDatosDirectos } from '../analisis-ia/contrato'
import { Block, markdown, pdf, ReportDocument } from './render'
const clean = (v: unknown) => redactarDatosDirectos(String(v ?? '')).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
const plain = (v: unknown) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
const val = (v: unknown) => v == null ? 'Sin datos' : String(v)
const labels = { sin_ayuda: 'Éxito sin ayuda', con_ayuda: 'Éxito con ayuda', no_completado: 'No completado' }
@Injectable()
export class ReportsService {
 private readonly cache = new Map<string, { documento: ReportDocument; markdown: string; creado: number; pdf?: Buffer }>()
 constructor(private readonly db: DatabaseService, private readonly metrics: IndicatorsService, private readonly comparison: ComparisonService) {}
 private limpiar() { for (const [key, r] of this.cache) if (Date.now() - r.creado > 10 * 60 * 1000) this.cache.delete(key) }
 async preparar(value: unknown) {
  const b = object(value); fields(b, ['plan_id', 'desde', 'hasta', 'secciones', 'comparacion'])
  const f = parseIndicatorFilters(b.plan_id, { ...(b.desde !== undefined ? { desde: b.desde } : {}), ...(b.hasta !== undefined ? { hasta: b.hasta } : {}) })
  if (!Array.isArray(b.secciones) || !b.secciones.length || b.secciones.length > 4 || b.secciones.some(s => !['resultados', 'hallazgos', 'historias', 'comparacion'].includes(s)) || new Set(b.secciones).size !== b.secciones.length) throw new BadRequestException('Selecciona secciones validas, sin repetir.')
  const sections = b.secciones as string[]
  if (sections.includes('comparacion') !== (b.comparacion !== undefined)) throw new BadRequestException('Incluye la configuracion de comparacion solo al seleccionar esa seccion.')
  const result = await this.db.transaction(async db => {
   await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')
   const plan = (await db.query('SELECT id::text,nombre,objetivo FROM public.planes WHERE id=$1', [f.plan_id])).rows[0]
   if (!plan) throw new NotFoundException('El plan no existe.')
   const metrics = await this.metrics.report(f.plan_id, { ...(f.desde ? { desde: f.desde } : {}), ...(f.hasta ? { hasta: f.hasta } : {}) }, db)
   if (metrics.por_tarea.length > 100) throw new PayloadTooLargeException('El informe admite hasta 100 tareas. Divide el plan para exportar.')
   const eligible = (await db.query(`SELECT r.id::text FROM public.resultados r JOIN public.sesiones s ON (s.id,s.plan_id)=(r.sesion_id,r.plan_id)
     WHERE r.plan_id=$1 AND s.estado='cerrada' AND s.consentimiento_confirmado IS TRUE AND s.iniciada_en IS NOT NULL
     AND s.cerrada_en>=s.iniciada_en AND ($2::timestamptz IS NULL OR s.cerrada_en>=$2) AND ($3::timestamptz IS NULL OR s.cerrada_en<$3)
     AND ((r.completada IS TRUE AND r.con_ayuda IS NOT NULL) OR (r.completada IS FALSE AND r.con_ayuda IS FALSE))`, [f.plan_id, f.desde, f.hasta])).rows.map(r => r.id)
   const findings = sections.some(s => s === 'hallazgos' || s === 'historias') ? (await db.query(`SELECT h.id::text,h.resumen,h.sugerencia,h.categoria,h.severidad,h.criterio_aceptacion,
      ARRAY(SELECT o.resultado_id::text FROM public.hallazgo_observaciones o WHERE o.hallazgo_id=h.id ORDER BY o.resultado_id) origenes
      FROM public.hallazgos h WHERE h.plan_id=$1 AND h.estado='aprobado'
      AND EXISTS(SELECT 1 FROM public.hallazgo_observaciones o WHERE o.hallazgo_id=h.id)
      AND NOT EXISTS(SELECT 1 FROM public.hallazgo_observaciones o WHERE o.hallazgo_id=h.id AND NOT(o.resultado_id=ANY($2::bigint[])))
      ORDER BY h.id LIMIT 201`, [f.plan_id, eligible])).rows : []
   if (findings.length > 200) throw new PayloadTooLargeException('Reduce el periodo: hay mas de 200 hallazgos aprobados.')
   const stories = sections.includes('historias') ? (await db.query(`SELECT id::text,hallazgo_id::text,titulo,descripcion,criterio_aceptacion,prioridad,puntos,estado FROM public.historias
      WHERE plan_id=$1 AND hallazgo_id=ANY($2::bigint[]) ORDER BY orden LIMIT 201`, [f.plan_id, findings.map(h => h.id)])).rows : []
   if (stories.length > 200) throw new PayloadTooLargeException('Reduce el periodo: hay mas de 200 historias.')
   return { plan, metrics, findings, stories }
  })
  result.plan.nombre = clean(result.plan.nombre); result.plan.objetivo = clean(result.plan.objetivo)
  result.metrics.por_tarea.forEach(t => { t.titulo = clean(t.titulo) })
  result.findings.forEach(h => { for (const k of ['resumen', 'sugerencia', 'criterio_aceptacion']) if (h[k] != null) h[k] = clean(h[k]) })
  result.stories.forEach(s => { for (const k of ['titulo', 'descripcion', 'criterio_aceptacion']) if (s[k] != null) s[k] = clean(s[k]) })
  let comparison: any = null
  const avisos = ['Incluye solo registros elegibles y hallazgos aprobados. No contiene identidades de participantes, credenciales ni textos originales de observaciones.', 'Revisa el contenido aprobado antes de compartir: la redaccion automatica de identificadores directos no sustituye la revision humana.']
  if (sections.includes('comparacion')) {
   comparison = await this.comparison.comparar(b.comparacion)
   const key = (s: any) => JSON.stringify([s.plan_id, s.desde, s.hasta])
   if (key(comparison.fuente_a.filtros) !== key(result.metrics.filtros)) throw new BadRequestException('La evaluacion A de la comparacion debe coincidir con el plan y periodo del informe.')
   if (!comparison.agregado) { comparison = null; avisos.push('Comparacion solicitada sin datos comparables: se omite esa seccion.') }
   else comparison.pares.forEach((p: any) => { p.a.titulo = clean(p.a.titulo); p.b.titulo = clean(p.b.titulo) })
  }
  const bloques: Block[] = [], title = (texto: string) => bloques.push({ tipo: 'titulo', texto: plain(texto) }), paragraph = (texto: string) => bloques.push({ tipo: 'texto', texto: plain(texto) })
  const table = (columnas: string[], filas: unknown[][]) => bloques.push({ tipo: 'tabla', columnas, filas: filas.map(r => r.map(plain)) })
  paragraph(`Plan #${f.plan_id}: ${result.plan.nombre}\nObjetivo: ${result.plan.objetivo}\nPeriodo de cierre: ${result.metrics.filtros.desde || 'sin limite inicial'} / ${result.metrics.filtros.hasta || 'sin limite final'} (hasta exclusivo).\nGenerado: ${new Date().toISOString()}\nSecciones solicitadas: ${sections.join(', ')}`)
  avisos.forEach(paragraph)
  if (sections.includes('resultados')) {
   title('Resultados de evaluacion')
   paragraph(`Sesiones incluidas: ${result.metrics.sesiones_incluidas}. Evaluados: ${result.metrics.general.evaluados}/${result.metrics.general.esperados}. Cobertura: ${val(result.metrics.general.cobertura_porcentaje)}%. Pendientes: ${result.metrics.general.pendientes}.`)
   for (const m of [{ ...result.metrics.general, titulo: 'General' }, ...result.metrics.por_tarea]) {
    title(m.titulo); table(['Resultado', 'Cantidad', 'Tasa (%)', 'Tiempo medio (s)', 'n tiempo', 'Errores medios', 'n errores'], Object.entries(labels).map(([k, label]) => { const c = m.por_resultado[k as keyof typeof labels]; return [label, c.cantidad, val(c.porcentaje), val(c.tiempo.promedio_segundos), c.tiempo.n, val(c.errores.promedio), c.errores.n] }))
   }
  }
  if (sections.includes('hallazgos')) {
   title('Hallazgos aprobados')
   if (!result.findings.length) paragraph('No hay hallazgos aprobados cuyas observaciones de origen esten integramente dentro del alcance seleccionado.')
   for (const h of result.findings) { title(`Hallazgo #${h.id}: ${h.resumen}`); paragraph(`Categoria: ${h.categoria}. Severidad: ${h.severidad}.\nMejora: ${h.sugerencia}\nCriterio: ${h.criterio_aceptacion || 'No registrado'}\nOrigen: resultados ${h.origenes.map((v: string) => '#' + v).join(', ')} del plan #${f.plan_id}.`) }
  }
  if (sections.includes('historias')) {
   title('Historias procedentes de hallazgos aprobados')
   if (!result.stories.length) paragraph('No hay historias vinculadas a hallazgos aprobados dentro de este alcance.')
   for (const s of result.stories) { title(`Historia #${s.id}: ${s.titulo}`); paragraph(`${s.descripcion}\nCriterio: ${s.criterio_aceptacion || 'No registrado'}\nPrioridad: ${s.prioridad}. Puntos: ${s.puntos ?? 'Sin estimar'}. Estado: ${s.estado}.\nOrigen: hallazgo #${s.hallazgo_id}, plan #${f.plan_id}.`) }
  }
  if (comparison) {
   title('Comparacion de evaluaciones'); paragraph(`A: plan #${comparison.fuente_a.filtros.plan_id}, ${comparison.fuente_a.filtros.desde || 'sin inicio'} / ${comparison.fuente_a.filtros.hasta || 'sin fin'}. B: plan #${comparison.fuente_b.filtros.plan_id}, ${comparison.fuente_b.filtros.desde || 'sin inicio'} / ${comparison.fuente_b.filtros.hasta || 'sin fin'}.`)
   comparison.avisos.forEach(paragraph)
   for (const pair of [{ ...comparison.agregado, titulo: 'Agregado comparable' }, ...comparison.pares.filter((p: any) => p.comparable).map((p: any) => ({ ...p, titulo: `Tarea #${p.a.tarea_id} ${p.a.titulo} / #${p.b.tarea_id} ${p.b.titulo}` }))]) {
    title(pair.titulo); paragraph(`Evaluados A: ${pair.a.evaluados}/${pair.a.esperados}. B: ${pair.b.evaluados}/${pair.b.esperados}. Variacion B menos A.`)
    table(['Resultado', 'Tasa A (%)', 'Tasa B (%)', 'Variacion (pp)'], Object.entries(labels).map(([k, label]) => [label, val(pair.a.por_resultado[k].porcentaje), val(pair.b.por_resultado[k].porcentaje), val(pair.variacion[k].porcentaje_pp)]))
    table(['Resultado', 'Tiempo A (s), n', 'Tiempo B (s), n', 'Variacion (s)'], Object.entries(labels).map(([k, label]) => [label, `${val(pair.a.por_resultado[k].tiempo.promedio_segundos)}; n=${pair.a.por_resultado[k].tiempo.n}`, `${val(pair.b.por_resultado[k].tiempo.promedio_segundos)}; n=${pair.b.por_resultado[k].tiempo.n}`, val(pair.variacion[k].tiempo_segundos)]))
    table(['Resultado', 'Errores A, n', 'Errores B, n', 'Variacion errores'], Object.entries(labels).map(([k, label]) => [label, `${val(pair.a.por_resultado[k].errores.promedio)}; n=${pair.a.por_resultado[k].errores.n}`, `${val(pair.b.por_resultado[k].errores.promedio)}; n=${pair.b.por_resultado[k].errores.n}`, val(pair.variacion[k].errores_promedio)]))
   }
   paragraph(`Excluidas sin equivalencia A: ${comparison.excluidas.a.map((t: any) => '#' + t.tarea_id).join(', ') || 'ninguna'}. B: ${comparison.excluidas.b.map((t: any) => '#' + t.tarea_id).join(', ') || 'ninguna'}.`)
  }
  const documento: ReportDocument = { titulo: 'Informe de evaluación de usabilidad', plan_id: f.plan_id, generado_en: new Date().toISOString(), bloques, avisos }
  const md = markdown(documento)
  if (Buffer.byteLength(md) > 256 * 1024) throw new PayloadTooLargeException('El informe es demasiado extenso. Reduce el periodo o las secciones.')
  this.limpiar(); while (this.cache.size >= 20) this.cache.delete(this.cache.keys().next().value!)
  const reporte_id = randomUUID(); this.cache.set(reporte_id, { documento, markdown: md, creado: Date.now() })
  return { reporte_id, expira_en: new Date(Date.now() + 10 * 60 * 1000).toISOString(), documento }
 }
 async descargar(reporte: string, formato: string) {
  if (!['markdown', 'pdf'].includes(formato)) throw new BadRequestException('Formato invalido.')
  this.limpiar(); const r = this.cache.get(reporte)
  if (!r) throw new NotFoundException('La vista previa expiro o el servidor se reinicio. Genera otra para descargar.')
  if (formato === 'pdf' && !r.pdf) r.pdf = await pdf(r.documento)
  return { bytes: formato === 'pdf' ? r.pdf! : Buffer.from(r.markdown, 'utf8'), type: formato === 'pdf' ? 'application/pdf' : 'text/markdown; charset=utf-8', filename: `informe-plan-${r.documento.plan_id}-${reporte.slice(0, 8)}.${formato === 'pdf' ? 'pdf' : 'md'}` }
 }
}
