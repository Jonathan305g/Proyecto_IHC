import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { DatabaseService } from '../database.service'
import { dbError, id } from '../validation'
import { validarRespuesta } from '../analisis-ia/contrato'
import { EjecucionAnalisis } from '../analisis-ia/analisis.types'
import * as dto from './backlog.dto'

type DB=Pick<DatabaseService,'query'>
const seleccion=readFileSync(join(__dirname,'../../contracts/s3-02/seleccionar_observaciones.sql'),'utf8')
const columnasHallazgo=`h.id::text,h.plan_id::text,h.analisis_id::text,h.resultado_id::text,
 h.resumen,h.sugerencia AS mejora_sugerida,h.categoria,h.severidad,h.criterio_aceptacion,h.estado,
 h.version,h.propuesta_ia,h.grupo_id,h.comentario_revision,h.creado_en,h.revisado_en,
 (SELECT id::text FROM public.historias WHERE hallazgo_id=h.id) AS historia_id,
 coalesce((SELECT jsonb_agg(jsonb_build_object('resultado_id',o.resultado_id::text,
   'texto_original',o.texto_original,'texto_revisado',o.texto_revisado,'tarea_titulo',o.tarea_titulo)
   ORDER BY o.resultado_id) FROM public.hallazgo_observaciones o WHERE o.hallazgo_id=h.id),'[]'::jsonb) AS observaciones`
const columnasHistoria=`s.id::text,s.plan_id::text,s.hallazgo_id::text,s.codigo,s.titulo,s.descripcion,
 s.criterio_aceptacion,s.prioridad,s.puntos,s.estado,s.orden,s.version,s.creada_en,s.actualizada_en,
 h.resumen AS hallazgo_resumen,CASE WHEN s.hallazgo_id IS NULL THEN 'manual' ELSE 'hallazgo' END AS origen`

@Injectable()
export class BacklogService {
  constructor(private readonly db:DatabaseService) {}
  private async tx<T>(operation:(db:DB)=>Promise<T>):Promise<T> {
    try {return await this.db.transaction(operation)} catch(e) {return dbError(e)}
  }
  private async plan(db:DB,p:string,lock=false) {
    id(p)
    const row=(await db.query('SELECT id::text,backlog_version FROM public.planes WHERE id=$1'+(lock?' FOR UPDATE':''),[p])).rows[0]
    if(!row) throw new NotFoundException('El plan no existe.')
    return row
  }
  private async leerHallazgo(db:DB,p:string,h:string,lock=false) {
    id(p);id(h)
    if(lock) await db.query('SELECT id FROM public.hallazgos WHERE plan_id=$1 AND id=$2 FOR UPDATE',[p,h])
    const row=(await db.query(`SELECT ${columnasHallazgo} FROM public.hallazgos h WHERE h.plan_id=$1 AND h.id=$2`,[p,h])).rows[0]
    if(!row) throw new NotFoundException('El hallazgo no existe en este plan.')
    return row
  }
  private async leerHistoria(db:DB,p:string,h:string) {
    id(p);id(h)
    const row=(await db.query(`SELECT ${columnasHistoria} FROM public.historias s LEFT JOIN public.hallazgos h ON h.id=s.hallazgo_id
      WHERE s.plan_id=$1 AND s.id=$2`,[p,h])).rows[0]
    if(!row) throw new NotFoundException('La historia no existe en este plan.')
    return row
  }
  private editable(row:any,v:number) {
    if(row.estado!=='pendiente') throw new ConflictException('Solo se puede editar un hallazgo pendiente de revision.')
    if(row.version!==v) throw new ConflictException('El hallazgo cambio. Recarga antes de guardar.')
  }
  async observaciones(p:string) {
    await this.plan(this.db,p)
    const ids=(await this.db.query(`SELECT r.id::text FROM public.resultados r JOIN public.sesiones s ON (s.id,s.plan_id)=(r.sesion_id,r.plan_id)
      WHERE r.plan_id=$1 AND s.estado='cerrada' AND s.consentimiento_confirmado IS TRUE
      AND s.iniciada_en IS NOT NULL AND s.cerrada_en>=s.iniciada_en AND r.completada IS NOT NULL
      AND nullif(btrim(r.observaciones),'') IS NOT NULL ORDER BY r.id LIMIT 1000`,[p])).rows.map(r=>r.id)
    return ids.length?(await this.db.query(seleccion,[p,ids])).rows:[]
  }
  async analisis(p:string) {
    await this.plan(this.db,p)
    return (await this.db.query(`SELECT id::text,plan_id::text,estado,iniciado_en,terminado_en,revision_en,
      jsonb_array_length(ejecucion->'grupos') AS grupos FROM public.analisis_ia
      WHERE plan_id=$1 AND ejecucion IS NOT NULL ORDER BY id DESC LIMIT 100`,[p])).rows
  }
  async importar(p:string,a:string,body:unknown) {
    id(p);id(a);dto.vacio(body)
    return this.tx(async db=>{
      await this.plan(db,p,true)
      const row=(await db.query('SELECT estado,revision_en,ejecucion FROM public.analisis_ia WHERE plan_id=$1 AND id=$2 FOR UPDATE',[p,a])).rows[0]
      if(!row?.ejecucion) throw new NotFoundException('El analisis no pertenece a este plan o no tiene diario S3-07.')
      if(!['completado','parcial'].includes(row.estado) || !row.revision_en) throw new ConflictException('El analisis debe tener grupos terminados y revision de privacidad.')
      const ejecucion=row.ejecucion as EjecucionAnalisis
      const ids:string[]=[]
      for(const g of ejecucion.grupos.filter(g=>g.estado==='completado')) {
        if(g.meta?.modo!=='gemini') throw new ConflictException('Las respuestas de demostracion no se incorporan al backlog.')
        const validada=validarRespuesta(g.respuesta,g.solicitud)
        if(!validada.ok) throw new BadRequestException('El borrador guardado no cumple el contrato S3-02.')
        const originales=(await db.query(seleccion,[p,g.solicitud.observaciones.map(o=>o.id.slice(10))])).rows
        if(originales.length!==g.solicitud.observaciones.length) throw new ConflictException('Las fuentes ya no son elegibles; comprueba consentimiento y sesion.')
        for(const [index,propuesta] of validada.data.hallazgos.entries()) {
          const existing=(await db.query('SELECT id::text FROM public.hallazgos WHERE analisis_id=$1 AND grupo_id=$2 AND indice_propuesta=$3',[a,g.id,index])).rows[0]
          if(existing) {ids.push(existing.id);continue}
          const nuevo=(await db.query(`INSERT INTO public.hallazgos(plan_id,analisis_id,resumen,sugerencia,categoria,severidad,grupo_id,indice_propuesta,propuesta_ia)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) RETURNING id::text`,[p,a,propuesta.resumen,propuesta.mejora_sugerida,
            propuesta.categoria,propuesta.severidad,g.id,index,JSON.stringify(propuesta)])).rows[0]
          for(const origen of propuesta.observacion_ids) {
            const rid=origen.slice(10), original=originales.find(o=>o.resultado_id===rid), revisada=g.solicitud.observaciones.find(o=>o.id===origen)!
            if(!original) throw new ConflictException('Falta una observacion de origen.')
            await db.query(`INSERT INTO public.hallazgo_observaciones(hallazgo_id,plan_id,resultado_id,texto_original,texto_revisado,tarea_titulo)
              VALUES($1,$2,$3,$4,$5,$6)`,[nuevo.id,p,rid,original.observacion_original,revisada.texto,revisada.tarea.titulo])
          }
          ids.push(nuevo.id)
        }
      }
      return {analisis_id:a,estado:row.estado,hallazgos:await Promise.all(ids.map(h=>this.leerHallazgo(db,p,h))),
        aviso:row.estado==='parcial'?'Se importaron solo grupos validos; los fallidos siguen disponibles para reintento.':null}
    })
  }
  async hallazgos(p:string,q:unknown={}) {
    await this.plan(this.db,p);const f=dto.filtros(q,true)
    return (await this.db.query(`SELECT ${columnasHallazgo} FROM public.hallazgos h WHERE h.plan_id=$1
      AND ($2::text IS NULL OR h.estado=$2) AND ($3::bigint IS NULL OR h.analisis_id=$3) ORDER BY h.id DESC`,[p,f.estado,f.analisis_id])).rows
  }
  async hallazgo(p:string,h:string) {return this.leerHallazgo(this.db,p,h)}
  async guardar(p:string,h:string,body:unknown) {
    id(p);id(h);const b=dto.borrador(body)
    return this.tx(async db=>{
      await this.plan(db,p,true);const row=await this.leerHallazgo(db,p,h,true);this.editable(row,b.version)
      await db.query(`UPDATE public.hallazgos SET resumen=$3,sugerencia=$4,categoria=$5,severidad=$6,
        criterio_aceptacion=$7,version=version+1 WHERE plan_id=$1 AND id=$2`,[p,h,b.resumen,b.sugerencia,b.categoria,b.severidad,b.criterio])
      return this.leerHallazgo(db,p,h)
    })
  }
  private async siguiente(db:DB,p:string) {
    const {n,maximo}=(await db.query('SELECT count(*)::int n,coalesce(max(orden),0)::int maximo FROM public.historias WHERE plan_id=$1',[p])).rows[0]
    if(n>=1000) throw new ConflictException('El plan alcanzo el limite de 1000 historias.')
    return maximo+1
  }
  async aprobar(p:string,h:string,body:unknown) {
    id(p);id(h);const b=dto.aprobacion(body)
    return this.tx(async db=>{
      await this.plan(db,p,true);const row=await this.leerHallazgo(db,p,h,true)
      if(row.estado==='aprobado' && row.historia_id) return {hallazgo:row,historia:await this.leerHistoria(db,p,row.historia_id),reutilizada:true}
      this.editable(row,b.version)
      if(!row.criterio_aceptacion?.trim()) throw new BadRequestException('Guarda un criterio de aceptacion antes de aprobar.')
      if(!row.observaciones.length) throw new ConflictException('El hallazgo no conserva observaciones de origen.')
      const orden=await this.siguiente(db,p)
      await db.query(`UPDATE public.hallazgos SET estado='aprobado',revisado_en=clock_timestamp(),version=version+1 WHERE plan_id=$1 AND id=$2`,[p,h])
      const story=(await db.query(`INSERT INTO public.historias(plan_id,hallazgo_id,titulo,descripcion,criterio_aceptacion,prioridad,puntos,orden)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id::text`,[p,h,b.titulo,`${row.resumen}\n\nMejora: ${row.mejora_sugerida}`,row.criterio_aceptacion,b.prioridad,b.puntos,orden])).rows[0]
      await db.query('UPDATE public.planes SET backlog_version=backlog_version+1 WHERE id=$1',[p])
      return {hallazgo:await this.leerHallazgo(db,p,h),historia:await this.leerHistoria(db,p,story.id),reutilizada:false}
    })
  }
  async descartar(p:string,h:string,body:unknown) {
    id(p);id(h);const b=dto.descarte(body)
    return this.tx(async db=>{
      await this.plan(db,p,true);const row=await this.leerHallazgo(db,p,h,true)
      if(row.estado==='rechazado' && row.comentario_revision===b.comentario) return row
      this.editable(row,b.version)
      await db.query(`UPDATE public.hallazgos SET estado='rechazado',comentario_revision=$3,revisado_en=clock_timestamp(),version=version+1
        WHERE plan_id=$1 AND id=$2`,[p,h,b.comentario])
      return this.leerHallazgo(db,p,h)
    })
  }
  async historias(p:string,q:unknown={}) {
    return this.tx(async db=>{
      const plan=await this.plan(db,p,true),f=dto.filtros(q)
      const rows=(await db.query(`SELECT ${columnasHistoria} FROM public.historias s LEFT JOIN public.hallazgos h ON h.id=s.hallazgo_id
        WHERE s.plan_id=$1 AND ($2::text IS NULL OR s.estado=$2) AND ($3::int IS NULL OR s.prioridad=$3)
        ORDER BY s.orden,s.id`,[p,f.estado,f.prioridad])).rows
      return {plan_id:p,version_orden:plan.backlog_version,historias:rows}
    })
  }
  async historia(p:string,h:string) {
    const row=await this.leerHistoria(this.db,p,h)
    return {...row,hallazgo:row.hallazgo_id?await this.leerHallazgo(this.db,p,row.hallazgo_id):null}
  }
  async crearHistoria(p:string,body:unknown) {
    id(p);const b=dto.historia(body)
    return this.tx(async db=>{
      await this.plan(db,p,true)
      const huella=createHash('sha256').update(JSON.stringify(b)).digest('hex')
      const previo=(await db.query('SELECT id::text,solicitud_huella FROM public.historias WHERE plan_id=$1 AND solicitud_id=$2',[p,b.solicitud_id])).rows[0]
      if(previo) {
        if(previo.solicitud_huella!==huella) throw new ConflictException('solicitud_id ya identifica otra historia. Consulta el backlog antes de crear otra.')
        return this.leerHistoria(db,p,previo.id)
      }
      const orden=await this.siguiente(db,p)
      const s=(await db.query(`INSERT INTO public.historias(plan_id,titulo,descripcion,criterio_aceptacion,prioridad,puntos,estado,orden,solicitud_id,solicitud_huella)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id::text`,[p,b.titulo,b.descripcion,b.criterio_aceptacion,b.prioridad,b.puntos,b.estado,orden,b.solicitud_id,huella])).rows[0]
      await db.query('UPDATE public.planes SET backlog_version=backlog_version+1 WHERE id=$1',[p])
      return this.leerHistoria(db,p,s.id)
    })
  }
  async editarHistoria(p:string,h:string,body:unknown) {
    id(p);id(h);const b=dto.historia(body,true)
    return this.tx(async db=>{
      await this.plan(db,p,true);const actual=await this.leerHistoria(db,p,h)
      if(actual.version!==b.version) throw new ConflictException('La historia cambio. Recarga antes de editar.')
      const entries=Object.entries(b).filter(([key])=>key!=='version')
      await db.query(`UPDATE public.historias SET ${entries.map(([key],i)=>`${key}=$${i+3}`).join(',')},
        version=version+1,actualizada_en=clock_timestamp() WHERE plan_id=$1 AND id=$2`,[p,h,...entries.map(([,value])=>value)])
      return this.leerHistoria(db,p,h)
    })
  }
  async ordenar(p:string,body:unknown) {
    id(p);const b=dto.orden(body)
    return this.tx(async db=>{
      const plan=await this.plan(db,p,true)
      if(plan.backlog_version!==b.version) throw new ConflictException('El orden cambio. Recarga el backlog antes de mover historias.')
      const all=(await db.query('SELECT id::text FROM public.historias WHERE plan_id=$1',[p])).rows.map(r=>r.id)
      if(all.length!==b.ids.length || all.some(r=>!b.ids.includes(r))) throw new BadRequestException('El orden debe incluir todas las historias del plan, sin filtros ni IDs ajenos.')
      for(const [index,h] of b.ids.entries()) await db.query('UPDATE public.historias SET orden=$3 WHERE plan_id=$1 AND id=$2',[p,h,index+1])
      await db.query('UPDATE public.planes SET backlog_version=backlog_version+1 WHERE id=$1',[p])
      return {plan_id:p,version_orden:plan.backlog_version+1,historia_ids:b.ids}
    })
  }
}
