import { BadRequestException, ConflictException, Injectable } from '@nestjs/common'
import { fields, object, text } from '../validation'
import { ScrumService, DB } from './scrum.service'
import * as dto from './scrum.dto'

const campos = ['entregas', 'pendientes', 'observaciones', 'aspectos_positivos', 'dificultades'] as const
function borrador(value: unknown) {
 const b = object(value); fields(b, ['version', ...campos, 'acuerdos'])
 const datos: Record<string, string> = {}
 for (const k of campos) { if (typeof b[k] !== 'string' || (b[k] as string).length > 4000) throw new BadRequestException(`${k}: texto de hasta 4000 caracteres.`); datos[k] = (b[k] as string).trim() }
 if (!Array.isArray(b.acuerdos) || b.acuerdos.length > 30) throw new BadRequestException('acuerdos debe tener hasta 30 elementos.')
 const acuerdos = b.acuerdos.map(v => {
  const a = object(v); fields(a, ['id', 'accion', 'responsable_id', 'fecha_compromiso', 'completado'])
  if (typeof a.completado !== 'boolean') throw new BadRequestException('completado debe ser booleano.')
  return { id: dto.uuid(a.id), accion: text(a.accion, 'accion', 2000), responsable_id: dto.identificador(a.responsable_id), fecha_compromiso: dto.fecha(a.fecha_compromiso, 'fecha_compromiso'), completado: a.completado }
 })
 if (new Set(acuerdos.map(a => a.id)).size !== acuerdos.length) throw new BadRequestException('No repitas acuerdos.')
 return { version: dto.entero(b.version, 'version'), datos, acuerdos }
}

@Injectable()
export class CierreService {
 constructor(private readonly scrum: ScrumService) {}
 private async leer(db: DB, p: string, s: string) {
  const sprint = await this.scrum.detalle(db, p, s)
  const row = (await db.query('SELECT entregas,pendientes,observaciones,aspectos_positivos,dificultades,guardado_en,cerrado_en,instantanea FROM public.producto_cierres WHERE sprint_id=$1', [s])).rows[0]
  const acuerdos = (await db.query(`SELECT a.id::text,a.accion,a.responsable_id::text,r.alias responsable,to_char(a.fecha_compromiso,'YYYY-MM-DD') fecha_compromiso,a.completado
    FROM public.producto_acuerdos a JOIN public.producto_responsables r ON r.id=a.responsable_id WHERE a.sprint_id=$1 ORDER BY a.id`, [s])).rows
  const revision = row ? { ...row, instantanea: undefined, acuerdos } : { entregas: '', pendientes: '', observaciones: '', aspectos_positivos: '', dificultades: '', acuerdos: [], guardado_en: null, cerrado_en: null }
  return { ...sprint, revision: row?.instantanea?.revision ?? revision, cierre_snapshot: row?.instantanea ?? null }
 }
 async obtener(p: string, s: string) { return this.scrum.transaccion(async db => { await this.scrum.plan(db, p); return this.leer(db, p, s) }) }
 async guardar(p: string, s: string, value: unknown) {
  const b = borrador(value)
  return this.scrum.transaccion(async db => {
   await this.scrum.plan(db, p); const sprint = await this.scrum.sprint(db, p, s); this.scrum.comprobar(sprint, b.version)
   for (const a of b.acuerdos) {
    await this.scrum.responsableValido(db, p, a.responsable_id)
    if (a.fecha_compromiso < sprint.fecha_inicio) throw new BadRequestException('Un compromiso no puede ser anterior al inicio del sprint.')
    if ((await db.query('SELECT 1 FROM public.producto_acuerdos WHERE id=$1 AND sprint_id<>$2', [a.id, s])).rows.length) throw new ConflictException('El identificador del acuerdo ya pertenece a otro sprint.')
   }
   await db.query(`INSERT INTO public.producto_cierres(sprint_id,entregas,pendientes,observaciones,aspectos_positivos,dificultades)
    VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(sprint_id) DO UPDATE SET entregas=EXCLUDED.entregas,pendientes=EXCLUDED.pendientes,
    observaciones=EXCLUDED.observaciones,aspectos_positivos=EXCLUDED.aspectos_positivos,dificultades=EXCLUDED.dificultades,guardado_en=clock_timestamp()`, [s, ...campos.map(k => b.datos[k])])
   await db.query('DELETE FROM public.producto_acuerdos WHERE sprint_id=$1 AND NOT(id=ANY($2::uuid[]))', [s, b.acuerdos.map(a => a.id)])
   for (const a of b.acuerdos) await db.query(`INSERT INTO public.producto_acuerdos(id,sprint_id,plan_id,accion,responsable_id,fecha_compromiso,completado)
    VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET accion=EXCLUDED.accion,responsable_id=EXCLUDED.responsable_id,fecha_compromiso=EXCLUDED.fecha_compromiso,completado=EXCLUDED.completado`, [a.id, s, p, a.accion, a.responsable_id, a.fecha_compromiso, a.completado])
   await this.scrum.incrementar(db, s); await this.scrum.evento(db, s, 'review_guardada', { acuerdos: b.acuerdos.map(a => a.id) }); return this.leer(db, p, s)
  })
 }
 async cerrar(p: string, s: string, value: unknown) {
  const b = object(value); fields(b, ['version', 'confirmacion', 'motivo_pendientes']); const version = dto.entero(b.version, 'version')
  if (b.confirmacion !== true) throw new BadRequestException('El cierre requiere confirmacion explicita.')
  if (typeof b.motivo_pendientes !== 'string' || b.motivo_pendientes.length > 2000) throw new BadRequestException('motivo_pendientes debe ser texto de hasta 2000 caracteres.')
  const motivo = b.motivo_pendientes.trim()
  return this.scrum.transaccion(async db => {
   await this.scrum.plan(db, p); const sprint = await this.leer(db, p, s)
   if (sprint.estado === 'cerrado') return sprint
   this.scrum.comprobar(sprint, version)
   if (sprint.estado !== 'activo') throw new ConflictException('Activa y revisa el sprint antes de cerrarlo.')
   if (!campos.every(k => sprint.revision[k]?.trim()) || !sprint.revision.acuerdos.length) throw new BadRequestException('Guarda review, retrospectiva y al menos un acuerdo con responsable y fecha.')
   const pendientes = sprint.historias.filter(h => h.estado !== 'terminada')
   if (pendientes.length && !motivo) throw new BadRequestException('Explica el retorno al backlog de las historias incompletas.')
   const instantanea = { ...sprint, estado: 'cerrado', version: sprint.version + 1, cierre_snapshot: undefined, motivo_pendientes: motivo, cerrado_en: new Date().toISOString() }
   await db.query('UPDATE public.producto_cierres SET instantanea=$2::jsonb,cerrado_en=clock_timestamp() WHERE sprint_id=$1', [s, JSON.stringify(instantanea)])
   await db.query("UPDATE public.producto_sprints SET estado='cerrado',version=version+1 WHERE id=$1", [s])
   await db.query('UPDATE public.producto_sprint_historias SET comprometida=false WHERE sprint_id=$1', [s])
   if (pendientes.length) await db.query("UPDATE public.historias SET estado='pendiente',version=version+1,actualizada_en=clock_timestamp() WHERE id=ANY($1::bigint[])", [pendientes.map(h => h.id)])
   await db.query('UPDATE public.planes SET backlog_version=backlog_version+1 WHERE id=$1', [p])
   await this.scrum.evento(db, s, 'cerrado', { retornadas_al_backlog: pendientes.map(h => h.id), puntos_entregados: sprint.avance.puntos_entregados })
   return this.leer(db, p, s)
  })
 }
}
