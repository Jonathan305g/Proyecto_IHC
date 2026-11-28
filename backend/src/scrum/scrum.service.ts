import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { createHash } from 'node:crypto'
import { DatabaseService } from '../database.service'
import { dbError, id } from '../validation'
import * as dto from './scrum.dto'

export type DB = Pick<DatabaseService, 'query'>
const huella = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex')
const columnas = `id::text,plan_id::text,nombre,objetivo,to_char(fecha_inicio,'YYYY-MM-DD') fecha_inicio,
 to_char(fecha_fin,'YYYY-MM-DD') fecha_fin,capacidad,estado,version,creado_en`

@Injectable()
export class ScrumService {
  constructor(readonly db: DatabaseService) {}
  async transaccion<T>(operation: (db: DB) => Promise<T>): Promise<T> {
    try { return await this.db.transaction(operation) } catch (e) { return dbError(e) }
  }
  async plan(db: DB, p: string) {
    id(p)
    if (!(await db.query('SELECT id FROM public.planes WHERE id=$1 FOR UPDATE', [p])).rows.length) throw new NotFoundException('El plan no existe.')
  }
  async sprint(db: DB, p: string, s: string) {
    id(s)
    const row = (await db.query(`SELECT ${columnas} FROM public.producto_sprints WHERE plan_id=$1 AND id=$2 FOR UPDATE`, [p, s])).rows[0]
    if (!row) throw new NotFoundException('El sprint no pertenece al plan.')
    return row
  }
  comprobar(s: any, v: number, soloPlanificado = false) {
    if (s.estado === 'cerrado' || (soloPlanificado && s.estado !== 'planificado')) throw new ConflictException(soloPlanificado ? 'La planificacion solo se edita antes de activar el sprint.' : 'El sprint cerrado conserva su historial y no admite cambios.')
    if (s.version !== v) throw new ConflictException('El sprint cambio. Recarga antes de guardar.')
  }
  async responsableValido(db: DB, p: string, r: string | null) {
    if (r && !(await db.query('SELECT id FROM public.producto_responsables WHERE plan_id=$1 AND id=$2 AND activo', [p, r])).rows.length) throw new BadRequestException('El responsable debe estar activo y pertenecer al plan.')
  }
  async evento(db: DB, s: string, accion: string, detalle: unknown) {
    await db.query('INSERT INTO public.producto_sprint_eventos(sprint_id,accion,detalle) VALUES($1,$2,$3::jsonb)', [s, accion, JSON.stringify(detalle)])
  }
  async incrementar(db: DB, s: string) { await db.query('UPDATE public.producto_sprints SET version=version+1 WHERE id=$1', [s]) }
  async detalle(db: DB, p: string, s: string) {
    const sprint = await this.sprint(db, p, s)
    const historias = (await db.query(`SELECT sh.historia_id::text id,sh.titulo,sh.descripcion,sh.criterio_aceptacion,sh.puntos,sh.estado,
      sh.responsable_id::text,r.alias responsable,sh.orden FROM public.producto_sprint_historias sh
      LEFT JOIN public.producto_responsables r ON r.id=sh.responsable_id WHERE sh.sprint_id=$1 ORDER BY sh.orden`, [s])).rows
    const tareas = (await db.query(`SELECT t.id::text,t.historia_id::text,t.titulo,t.estado,t.responsable_id::text,r.alias responsable
      FROM public.producto_sprint_tareas t LEFT JOIN public.producto_responsables r ON r.id=t.responsable_id WHERE t.sprint_id=$1 ORDER BY t.id`, [s])).rows
    const total = historias.reduce((n, h) => n + h.puntos, 0), entregados = historias.filter(h => h.estado === 'terminada').reduce((n, h) => n + h.puntos, 0)
    const terminadas = tareas.filter(t => t.estado === 'terminada').length
    const eventos = (await db.query('SELECT id::text,accion,detalle,registrado_en FROM public.producto_sprint_eventos WHERE sprint_id=$1 ORDER BY id DESC LIMIT 300', [s])).rows
    return { ...sprint, id: s, plan_id: p, estado: sprint.estado, version: sprint.version, historias, tareas, eventos, avance: { puntos_seleccionados: total, capacidad_restante: sprint.capacidad - total,
      puntos_entregados: entregados, puntos_pendientes: total - entregados, porcentaje_puntos: total ? Math.round(entregados / total * 10000) / 100 : null,
      tareas: tareas.length, tareas_terminadas: terminadas, porcentaje_tareas: tareas.length ? Math.round(terminadas / tareas.length * 10000) / 100 : null } }
  }
  async listar(p: string) {
    return this.transaccion(async db => { await this.plan(db, p); return (await db.query(`SELECT ${columnas} FROM public.producto_sprints WHERE plan_id=$1 ORDER BY fecha_inicio DESC,id DESC`, [p])).rows })
  }
  async obtener(p: string, s: string) { return this.transaccion(async db => { await this.plan(db, p); return this.detalle(db, p, s) }) }
  async responsables(p: string) {
    return this.transaccion(async db => { await this.plan(db, p); return (await db.query('SELECT id::text,alias,activo,version FROM public.producto_responsables WHERE plan_id=$1 ORDER BY alias,id', [p])).rows })
  }
  async guardarResponsable(p: string, value: unknown, r?: string) {
    if (r) id(r)
    const b = dto.responsable(value, !!r)
    return this.transaccion(async db => {
      await this.plan(db, p)
      if (r) {
        const actual = (await db.query('SELECT version FROM public.producto_responsables WHERE plan_id=$1 AND id=$2', [p, r])).rows[0]
        if (!actual) throw new NotFoundException('Responsable inexistente.')
        if (actual.version !== b.version) throw new ConflictException('El responsable cambio. Recarga.')
        if (!b.activo && (await db.query(`SELECT 1 FROM public.producto_sprint_historias WHERE plan_id=$1 AND responsable_id=$2 AND comprometida
          UNION ALL SELECT 1 FROM public.producto_sprint_tareas t JOIN public.producto_sprints s ON s.id=t.sprint_id
          WHERE t.plan_id=$1 AND t.responsable_id=$2 AND s.estado<>'cerrado' LIMIT 1`, [p, r])).rows.length) throw new ConflictException('Reasigna primero el trabajo de los sprints abiertos.')
        await db.query('UPDATE public.producto_responsables SET alias=$3,activo=$4,version=version+1 WHERE plan_id=$1 AND id=$2', [p, r, b.alias, b.activo])
      } else {
        const previo = (await db.query('SELECT id::text,alias FROM public.producto_responsables WHERE plan_id=$1 AND solicitud_id=$2', [p, b.solicitud_id])).rows[0]
        if (previo && previo.alias !== b.alias) throw new ConflictException('La solicitud ya identifica otro responsable.')
        r = previo?.id ?? (await db.query('INSERT INTO public.producto_responsables(plan_id,alias,solicitud_id) VALUES($1,$2,$3) RETURNING id::text', [p, b.alias, b.solicitud_id])).rows[0].id
      }
      return (await db.query('SELECT id::text,alias,activo,version FROM public.producto_responsables WHERE id=$1', [r])).rows[0]
    })
  }
  async guardar(p: string, value: unknown, s?: string) {
    if (s) id(s)
    const b = dto.planificacion(value, !!s), hash = huella(b)
    return this.transaccion(async db => {
      await this.plan(db, p)
      if (s) {
        const actual = await this.sprint(db, p, s); this.comprobar(actual, b.version!, true)
        if ((await db.query('SELECT 1 FROM public.producto_sprint_tareas WHERE sprint_id=$1 LIMIT 1', [s])).rows.length) {
          const seleccion = (await db.query('SELECT historia_id::text FROM public.producto_sprint_historias WHERE sprint_id=$1', [s])).rows.map(h => h.historia_id)
          if (seleccion.some(h => !b.historias.some(v => v.historia_id === h))) throw new ConflictException('Retira primero las tareas de las historias que deseas quitar.')
        }
      } else {
        const previo = (await db.query('SELECT id::text,solicitud_huella FROM public.producto_sprints WHERE plan_id=$1 AND solicitud_id=$2', [p, b.solicitud_id])).rows[0]
        if (previo) {
          if (previo.solicitud_huella !== hash) throw new ConflictException('La solicitud ya identifica otra planificacion.')
          return this.detalle(db, p, previo.id)
        }
      }
      let puntos = 0; const seleccion: any[] = []
      for (const h of b.historias) {
        const row = (await db.query('SELECT id::text,titulo,descripcion,criterio_aceptacion,puntos,estado FROM public.historias WHERE plan_id=$1 AND id=$2 FOR UPDATE', [p, h.historia_id])).rows[0]
        if (!row) throw new BadRequestException('Todas las historias deben pertenecer al plan.')
        if (row.estado !== 'pendiente' || row.puntos == null) throw new BadRequestException('Selecciona historias pendientes con puntos estimados en el backlog.')
        if ((await db.query('SELECT 1 FROM public.producto_sprint_historias WHERE historia_id=$1 AND comprometida AND ($2::bigint IS NULL OR sprint_id<>$2)', [h.historia_id, s ?? null])).rows.length) throw new ConflictException('Una historia ya esta comprometida en otro sprint abierto.')
        await this.responsableValido(db, p, h.responsable_id); puntos += row.puntos; seleccion.push({ ...row, responsable_id: h.responsable_id })
      }
      if (puntos > b.capacidad) throw new BadRequestException('Los puntos seleccionados superan la capacidad.')
      if (!s) s = (await db.query(`INSERT INTO public.producto_sprints(plan_id,nombre,objetivo,fecha_inicio,fecha_fin,capacidad,solicitud_id,solicitud_huella)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id::text`, [p, b.nombre, b.objetivo, b.fecha_inicio, b.fecha_fin, b.capacidad, b.solicitud_id, hash])).rows[0].id
      else await db.query(`UPDATE public.producto_sprints SET nombre=$3,objetivo=$4,fecha_inicio=$5,fecha_fin=$6,capacidad=$7,version=version+1 WHERE plan_id=$1 AND id=$2`, [p, s, b.nombre, b.objetivo, b.fecha_inicio, b.fecha_fin, b.capacidad])
      const keep = seleccion.map(h => h.id)
      await db.query('DELETE FROM public.producto_sprint_historias WHERE sprint_id=$1 AND NOT(historia_id=ANY($2::bigint[]))', [s, keep])
      for (const [index, h] of seleccion.entries()) await db.query(`INSERT INTO public.producto_sprint_historias(sprint_id,historia_id,plan_id,responsable_id,titulo,descripcion,criterio_aceptacion,puntos,orden)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(sprint_id,historia_id) DO UPDATE SET responsable_id=EXCLUDED.responsable_id,orden=EXCLUDED.orden`, [s, h.id, p, h.responsable_id, h.titulo, h.descripcion, h.criterio_aceptacion, h.puntos, index + 1])
      await this.evento(db, s!, b.version ? 'planificacion_editada' : 'planificacion_creada', { historias: keep, puntos })
      return this.detalle(db, p, s!)
    })
  }
  async activar(p: string, s: string, value: unknown) {
    const v = dto.version(value)
    return this.transaccion(async db => {
      await this.plan(db, p); const row = await this.sprint(db, p, s)
      if (row.estado === 'activo') return this.detalle(db, p, s)
      this.comprobar(row, v, true)
      const hs = (await db.query('SELECT responsable_id FROM public.producto_sprint_historias WHERE sprint_id=$1', [s])).rows
      if (!hs.length || hs.some(h => !h.responsable_id)) throw new BadRequestException('Selecciona historias y asigna un responsable a cada una antes de activar.')
      await db.query("UPDATE public.producto_sprints SET estado='activo',version=version+1 WHERE id=$1", [s])
      await this.evento(db, s, 'activado', {}); return this.detalle(db, p, s)
    })
  }
  async guardarTarea(p: string, s: string, value: unknown, t?: string) {
    if (t) id(t)
    const b = dto.tarea(value, !!t)
    return this.transaccion(async db => {
      await this.plan(db, p); const row = await this.sprint(db, p, s)
      if (!t) {
        const previo = (await db.query('SELECT id::text,solicitud_huella FROM public.producto_sprint_tareas WHERE sprint_id=$1 AND solicitud_id=$2', [s, b.solicitud_id])).rows[0]
        const hash = huella({ titulo: b.titulo, historia_id: b.historia_id, responsable_id: b.responsable_id })
        if (previo) { if (previo.solicitud_huella !== hash) throw new ConflictException('La solicitud ya identifica otra tarea.'); return this.detalle(db, p, s) }
        this.comprobar(row, b.version)
        if (!(await db.query('SELECT 1 FROM public.producto_sprint_historias WHERE sprint_id=$1 AND historia_id=$2', [s, b.historia_id])).rows.length) throw new BadRequestException('La historia no fue seleccionada en este sprint.')
        if ((await db.query('SELECT count(*)::int n FROM public.producto_sprint_tareas WHERE sprint_id=$1', [s])).rows[0].n >= 500) throw new ConflictException('Limite de 500 tareas por sprint.')
        await this.responsableValido(db, p, b.responsable_id)
        t = (await db.query(`INSERT INTO public.producto_sprint_tareas(sprint_id,historia_id,plan_id,titulo,responsable_id,solicitud_id,solicitud_huella)
          VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id::text`, [s, b.historia_id, p, b.titulo, b.responsable_id, b.solicitud_id, hash])).rows[0].id
        await this.recalcular(db, s, b.historia_id!)
      } else {
        this.comprobar(row, b.version); await this.responsableValido(db, p, b.responsable_id)
        if (!(await db.query('UPDATE public.producto_sprint_tareas SET titulo=$3,responsable_id=$4 WHERE sprint_id=$1 AND id=$2 RETURNING id', [s, t, b.titulo, b.responsable_id])).rows.length) throw new NotFoundException('La tarea no pertenece al sprint.')
      }
      await this.incrementar(db, s); await this.evento(db, s, 'tarea_guardada', { tarea_id: t }); return this.detalle(db, p, s)
    })
  }
  async retirarTarea(p: string, s: string, t: string, value: unknown) {
    id(t); const v = dto.version(value)
    return this.transaccion(async db => {
      await this.plan(db, p); this.comprobar(await this.sprint(db, p, s), v, true)
      const task = (await db.query('DELETE FROM public.producto_sprint_tareas WHERE sprint_id=$1 AND id=$2 RETURNING historia_id::text', [s, t])).rows[0]
      if (!task) throw new NotFoundException('La tarea no pertenece al sprint.')
      await this.recalcular(db, s, task.historia_id); await this.incrementar(db, s); await this.evento(db, s, 'tarea_retirada', { tarea_id: t }); return this.detalle(db, p, s)
    })
  }
  async recalcular(db: DB, s: string, h: string) {
    const tasks = (await db.query('SELECT estado FROM public.producto_sprint_tareas WHERE sprint_id=$1 AND historia_id=$2', [s, h])).rows
    const estado = tasks.length && tasks.every(t => t.estado === 'terminada') ? 'terminada' : tasks.some(t => t.estado === 'en_revision') ? 'en_revision' : tasks.some(t => t.estado !== 'pendiente') ? 'en_progreso' : 'pendiente'
    await db.query('UPDATE public.producto_sprint_historias SET estado=$3 WHERE sprint_id=$1 AND historia_id=$2', [s, h, estado])
    await db.query('UPDATE public.historias SET estado=$2,version=version+1,actualizada_en=clock_timestamp() WHERE id=$1', [h, estado === 'en_revision' ? 'en_progreso' : estado])
  }
  async mover(p: string, s: string, t: string, value: unknown) {
    id(t); const b = dto.estado(value)
    return this.transaccion(async db => {
      await this.plan(db, p); const row = await this.sprint(db, p, s)
      if (row.estado !== 'activo') throw new ConflictException('Activa el sprint antes de cambiar estados.')
      const task = (await db.query('SELECT historia_id::text,estado FROM public.producto_sprint_tareas WHERE sprint_id=$1 AND id=$2', [s, t])).rows[0]
      if (!task) throw new NotFoundException('La tarea no pertenece al sprint.')
      if (task.estado === b.estado) return this.detalle(db, p, s)
      this.comprobar(row, b.version)
      const permitidos: Record<string, string[]> = { pendiente: ['en_progreso'], en_progreso: ['pendiente', 'en_revision'], en_revision: ['en_progreso', 'terminada'], terminada: ['en_revision'] }
      if (!permitidos[task.estado].includes(b.estado)) throw new BadRequestException('Transicion invalida. Sigue Pendiente, En progreso, En revision y Terminado.')
      await db.query('UPDATE public.producto_sprint_tareas SET estado=$3 WHERE sprint_id=$1 AND id=$2', [s, t, b.estado])
      await this.recalcular(db, s, task.historia_id); await this.incrementar(db, s)
      await this.evento(db, s, 'estado_actualizado', { tarea_id: t, anterior: task.estado, nuevo: b.estado }); return this.detalle(db, p, s)
    })
  }
}
