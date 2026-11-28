import { BadRequestException } from '@nestjs/common'
import { fields, id, object, text } from '../validation'

export const estadosTarea = ['pendiente', 'en_progreso', 'en_revision', 'terminada'] as const
export function entero(v: unknown, field: string, min = 1, max = 2147483647): number {
  if (!Number.isSafeInteger(v) || Number(v) < min || Number(v) > max) throw new BadRequestException(`${field}: entero entre ${min} y ${max}.`)
  return Number(v)
}
export function uuid(v: unknown): string {
  if (typeof v !== 'string' || !/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(v)) throw new BadRequestException('solicitud_id debe ser un UUID v4.')
  return v.toLowerCase()
}
export function identificador(v: unknown) { return id(typeof v === 'string' ? v : '') }
export function fecha(v: unknown, field: string): string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isFinite(Date.parse(v + 'T00:00:00Z')) || new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) !== v) throw new BadRequestException(`${field}: fecha real YYYY-MM-DD.`)
  return v
}
export function planificacion(value: unknown, edit = false) {
  const b = object(value)
  fields(b, ['nombre', 'objetivo', 'fecha_inicio', 'fecha_fin', 'capacidad', 'historias', edit ? 'version' : 'solicitud_id'])
  const inicio = fecha(b.fecha_inicio, 'fecha_inicio'), fin = fecha(b.fecha_fin, 'fecha_fin')
  if (fin < inicio) throw new BadRequestException('La fecha final debe ser igual o posterior a la inicial.')
  if (!Array.isArray(b.historias) || b.historias.length > 100) throw new BadRequestException('Selecciona como maximo 100 historias.')
  const historias = b.historias.map(v => {
    const h = object(v); fields(h, ['historia_id', 'responsable_id'])
    return { historia_id: identificador(h.historia_id), responsable_id: h.responsable_id == null ? null : identificador(h.responsable_id) }
  })
  if (new Set(historias.map(h => h.historia_id)).size !== historias.length) throw new BadRequestException('No repitas historias.')
  return { nombre: text(b.nombre, 'nombre', 100), objetivo: text(b.objetivo, 'objetivo', 2000), fecha_inicio: inicio, fecha_fin: fin,
    capacidad: entero(b.capacidad, 'capacidad', 0, 10000), historias,
    version: edit ? entero(b.version, 'version') : null, solicitud_id: edit ? null : uuid(b.solicitud_id) }
}
export function version(value: unknown) { const b = object(value); fields(b, ['version']); return entero(b.version, 'version') }
export function responsable(value: unknown, edit = false) {
  const b = object(value); fields(b, edit ? ['version', 'alias', 'activo'] : ['solicitud_id', 'alias'])
  if (edit && typeof b.activo !== 'boolean') throw new BadRequestException('activo debe ser booleano.')
  return { alias: text(b.alias, 'alias', 120), activo: edit ? b.activo as boolean : true, version: edit ? entero(b.version, 'version') : null, solicitud_id: edit ? null : uuid(b.solicitud_id) }
}
export function tarea(value: unknown, edit = false) {
  const b = object(value); fields(b, ['version', 'titulo', 'responsable_id', ...(edit ? [] : ['historia_id', 'solicitud_id'])])
  return { version: entero(b.version, 'version'), titulo: text(b.titulo, 'titulo', 240), responsable_id: identificador(b.responsable_id),
    historia_id: edit ? null : identificador(b.historia_id), solicitud_id: edit ? null : uuid(b.solicitud_id) }
}
export function estado(value: unknown) {
  const b = object(value); fields(b, ['version', 'estado'])
  if (typeof b.estado !== 'string' || !(estadosTarea as readonly string[]).includes(b.estado)) throw new BadRequestException('Estado de tarea invalido.')
  return { version: entero(b.version, 'version'), estado: b.estado }
}
