import { BadRequestException } from '@nestjs/common'
import { fields, id, nonempty, object, text } from '../validation'

export const categorias = ['navegacion','comprension','accesibilidad','retroalimentacion','eficiencia','prevencion_errores','contenido','otro'] as const
export const severidades = ['baja','media','alta','critica'] as const
const estados = ['pendiente','en_progreso','terminada']
function entero(value: unknown, name: string, max: number) {
  if (!Number.isSafeInteger(value) || Number(value)<1 || Number(value)>max) throw new BadRequestException(`${name} debe ser un entero entre 1 y ${max}.`)
  return value as number
}
function opcion(value: unknown, values: readonly string[], name: string) {
  if (typeof value!=='string' || !values.includes(value)) throw new BadRequestException(`${name} no es valido.`)
  return value
}
export function version(value: unknown) { return entero(value,'version',2147483647) }
export function borrador(value: unknown) {
  const b=object(value); fields(b,['version','resumen','categoria','severidad','mejora_sugerida','criterio_aceptacion'])
  return { version:version(b.version), resumen:text(b.resumen,'resumen',1000),
    categoria:opcion(b.categoria,categorias,'categoria'), severidad:opcion(b.severidad,severidades,'severidad'),
    sugerencia:text(b.mejora_sugerida,'mejora_sugerida',1500),
    criterio:b.criterio_aceptacion===null || b.criterio_aceptacion==='' ? null : text(b.criterio_aceptacion,'criterio_aceptacion',3000) }
}
export function aprobacion(value: unknown) {
  const b=object(value); fields(b,['version','titulo','prioridad','puntos'])
  return {version:version(b.version), titulo:text(b.titulo,'titulo',180),
    prioridad:b.prioridad===undefined?3:entero(b.prioridad,'prioridad',5),
    puntos:b.puntos==null?null:entero(b.puntos,'puntos',100)}
}
export function descarte(value: unknown) {
  const b=object(value); fields(b,['version','comentario']); return {version:version(b.version),comentario:text(b.comentario,'comentario',2000)}
}
export function historia(value: unknown, editar=false) {
  const b=object(value); fields(b,['titulo','descripcion','criterio_aceptacion','prioridad','puntos','estado',...(editar?['version']:['solicitud_id'])])
  const out: Record<string,unknown>={}
  if (!editar) {
    if(typeof b.solicitud_id!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(b.solicitud_id)) throw new BadRequestException('solicitud_id debe ser un UUID v4.')
    out.solicitud_id=b.solicitud_id.toLowerCase()
  }
  if (editar) {out.version=version(b.version); nonempty(Object.fromEntries(Object.entries(b).filter(([k])=>k!=='version')))}
  for (const [key,max] of [['titulo',180],['descripcion',4000],['criterio_aceptacion',3000]] as const) {
    if (!editar || b[key]!==undefined) out[key]=text(b[key],key,max)
  }
  if (!editar || b.prioridad!==undefined) out.prioridad=b.prioridad===undefined?3:entero(b.prioridad,'prioridad',5)
  if (!editar || b.puntos!==undefined) out.puntos=b.puntos==null?null:entero(b.puntos,'puntos',100)
  if (!editar || b.estado!==undefined) out.estado=b.estado===undefined?'pendiente':opcion(b.estado,estados,'estado')
  return out
}
export function filtros(value: unknown, hallazgos=false) {
  const q=object(value); fields(q,hallazgos?['estado','analisis_id']:['estado','prioridad'])
  return {estado:q.estado===undefined?null:opcion(q.estado,hallazgos?['pendiente','aprobado','rechazado']:estados,'estado'),
    prioridad:q.prioridad===undefined?null:typeof q.prioridad==='string' && /^[1-5]$/.test(q.prioridad)?Number(q.prioridad):entero(q.prioridad,'prioridad',5),
    analisis_id:q.analisis_id===undefined?null:id(typeof q.analisis_id==='string'?q.analisis_id:'')}
}
export function orden(value: unknown) {
  const b=object(value); fields(b,['version_orden','historia_ids'])
  if (!Array.isArray(b.historia_ids) || b.historia_ids.length>1000) throw new BadRequestException('historia_ids debe ser una lista de hasta 1000 IDs.')
  const ids=b.historia_ids.map(v=>id(typeof v==='string'?v:''))
  if (new Set(ids).size!==ids.length) throw new BadRequestException('No repitas historias.')
  return {version:version(b.version_orden),ids}
}
export function vacio(value: unknown) {fields(object(value??{}),[])}
