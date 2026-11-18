import { ConflictException, HttpException, Injectable, NotFoundException } from '@nestjs/common'
import { createHash, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseService } from '../database.service'
import { id } from '../validation'
import { cuerpoVacio, entradaInvalida, parseCreacion, parseRevision } from './analisis.dto'
import { EjecucionAnalisis, estadoDeGrupos, GrupoAnalisis, RegistroAnalisis } from './analisis.types'
import { comprobarSeleccion, FuenteRevisada, prepararSolicitud, redactarDatosDirectos,
  SolicitudIA, validarRespuesta, validarSolicitud } from './contrato'
import { ProveedorIA } from './proveedor'

type Consultor = Pick<DatabaseService, 'query'>
type Fuente = Omit<FuenteRevisada, 'observacion_revisada' | 'privacidad_revisada'> & { observacion_original: string }
const seleccionSQL = readFileSync(join(__dirname, '../../contracts/s3-02/seleccionar_observaciones.sql'), 'utf8')
const columnas = `id::text, plan_id::text, solicitud_id::text, estado, revision_en, iniciado_en,
  terminado_en, bloqueo::text, bloqueado_hasta <= clock_timestamp() AS vencido, ejecucion`
const maxIntentos = 3
// S3-03 permite como máximo 120 s por grupo. Dos grupos + 30 s de margen.
const arrendamientoSegundos = 270
const codigosContrato = new Set(['IA_JSON_INVALIDO', 'IA_ESQUEMA_INVALIDO', 'IA_ORIGEN_INVALIDO',
  'IA_COBERTURA_INCOMPLETA', 'IA_COBERTURA_INVALIDA', 'IA_HALLAZGO_DUPLICADO', 'IA_DATOS_PERSONALES',
  'IA_LIMITE_EXCEDIDO', 'IA_SOLICITUD_INVALIDA', 'IA_RECHAZADA', 'IA_RESPUESTA_INCOMPLETA', 'IA_RESPUESTA_INVALIDA'])
const codigosProveedor = new Set(['IA_DESHABILITADA', 'IA_CONFIGURACION_INVALIDA', 'IA_CONFIGURACION_PROVEEDOR',
  'IA_ACCESO_PROVEEDOR', 'IA_CUOTA_AGOTADA', 'IA_LIMITE_PROVEEDOR', 'IA_PROVEEDOR_NO_DISPONIBLE',
  'IA_ERROR_CONEXION', 'IA_TIEMPO_AGOTADO'])

function fallarGrupo(grupo: GrupoAnalisis, code: string): void {
  grupo.estado = 'fallido'
  delete grupo.respuesta
  grupo.error = { code, message: 'No se obtuvo un borrador válido para este grupo.', details: [] }
}

@Injectable()
export class AnalisisService {
  constructor(private readonly db: DatabaseService, private readonly proveedor: ProveedorIA) {}

  private async plan(db: Consultor, planId: string): Promise<void> {
    if (!(await db.query('SELECT id FROM public.planes WHERE id=$1 FOR UPDATE', [planId])).rows.length) {
      throw new NotFoundException('El plan no existe.')
    }
  }

  private async cargar(db: Consultor, planId: string, analisisId: string): Promise<RegistroAnalisis> {
    const row = (await db.query<RegistroAnalisis>(`SELECT ${columnas} FROM public.analisis_ia
      WHERE plan_id=$1 AND id=$2 FOR UPDATE`, [planId, analisisId])).rows[0]
    if (!row?.ejecucion) throw new NotFoundException('El análisis no existe en este plan o no pertenece a S3-07.')
    return row
  }

  private async fuentes(db: Consultor, planId: string, ids: string[]): Promise<Fuente[]> {
    const filas = (await db.query<Fuente>(seleccionSQL, [planId, ids])).rows
    for (let n = 0; n < ids.length; n += 50) {
      const chunk = ids.slice(n, n + 50)
      const validacion = comprobarSeleccion(chunk, filas.filter(f => chunk.includes(f.resultado_id)))
      if (!validacion.ok) entradaInvalida(validacion.error)
    }
    return filas
  }

  private huella(fuentes: Fuente[]): string {
    return createHash('sha256').update(JSON.stringify(fuentes)).digest('hex')
  }

  private async comprobarFuentes(db: Consultor, row: RegistroAnalisis): Promise<void> {
    const ejecucion = row.ejecucion!
    const fuentes = await this.fuentes(db, row.plan_id, ejecucion.resultado_ids)
    if (this.huella(fuentes) !== ejecucion.huella_fuentes) {
      throw new ConflictException('Las fuentes cambiaron. Prepara y revisa una nueva selección.')
    }
  }

  private presentar(row: RegistroAnalisis) {
    return { id: row.id, plan_id: row.plan_id, solicitud_id: row.solicitud_id, estado: row.estado,
      revision_en: row.revision_en, iniciado_en: row.iniciado_en, terminado_en: row.terminado_en,
      max_intentos: maxIntentos, grupos: row.ejecucion!.grupos.map(g => ({ ...g,
        reintentable: g.estado === 'fallido' && g.intentos < maxIntentos })) }
  }

  // Se ejecuta bajo bloqueo de la fila. Nunca descarta grupos ya completados.
  private async recuperar(db: Consultor, row: RegistroAnalisis): Promise<void> {
    if (!row.bloqueo || !row.vencido) return
    for (const grupo of row.ejecucion!.grupos) {
      if (grupo.estado === 'procesando') fallarGrupo(grupo, 'IA_EJECUCION_INTERRUMPIDA')
    }
    row.estado = estadoDeGrupos(row.ejecucion!.grupos)
    await db.query(`UPDATE public.analisis_ia SET ejecucion=$3::jsonb, estado=$4,
      bloqueo=NULL, bloqueado_hasta=NULL, terminado_en=clock_timestamp()
      WHERE plan_id=$1 AND id=$2`, [row.plan_id, row.id, JSON.stringify(row.ejecucion), row.estado])
    row.bloqueo = null
    // Recuperar también las fechas generadas por PostgreSQL.
    Object.assign(row, await this.cargar(db, row.plan_id, row.id))
  }

  async crear(planId: string, value: unknown) {
    id(planId)
    const input = parseCreacion(value)
    return this.db.transaction(async db => {
      await this.plan(db, planId)
      const anterior = (await db.query<RegistroAnalisis>(`SELECT ${columnas} FROM public.analisis_ia
        WHERE plan_id=$1 AND solicitud_id=$2 FOR UPDATE`, [planId, input.solicitud_id])).rows[0]
      if (anterior) {
        if (JSON.stringify(anterior.ejecucion!.resultado_ids) !== JSON.stringify(input.resultado_ids)) {
          throw new ConflictException('solicitud_id ya identifica otra selección.')
        }
        await this.recuperar(db, anterior)
        return this.presentar(anterior)
      }
      const fuentes = await this.fuentes(db, planId, input.resultado_ids)
      const grupos: GrupoAnalisis[] = []
      for (let n = 0; n < fuentes.length; n += 50) {
        const solicitud: SolicitudIA = { version: '1.0', plan_id: planId,
          observaciones: fuentes.slice(n, n + 50).map(f => ({ id: `resultado:${f.resultado_id}`,
            tarea: { id: f.tarea_id, titulo: redactarDatosDirectos(f.titulo_tarea),
              criterio_exito: f.criterio_exito === null ? null : redactarDatosDirectos(f.criterio_exito) || null },
            resultado: f.resultado, texto: redactarDatosDirectos(f.observacion_original) })) }
        const validacion = validarSolicitud(solicitud)
        if (!validacion.ok) entradaInvalida(validacion.error)
        grupos.push({ id: String(grupos.length + 1), estado: 'pendiente', intentos: 0, solicitud })
      }
      const ejecucion: EjecucionAnalisis = { version: '1.0', resultado_ids: input.resultado_ids,
        huella_fuentes: this.huella(fuentes), grupos }
      const row = (await db.query<RegistroAnalisis>(`INSERT INTO public.analisis_ia(plan_id,solicitud_id,ejecucion)
        VALUES ($1,$2,$3::jsonb) RETURNING ${columnas}`, [planId, input.solicitud_id, JSON.stringify(ejecucion)])).rows[0]
      return this.presentar(row)
    })
  }

  async consultar(planId: string, analisisId: string) {
    id(planId); id(analisisId)
    return this.db.transaction(async db => {
      const row = await this.cargar(db, planId, analisisId)
      await this.recuperar(db, row)
      return this.presentar(row)
    })
  }

  async revisar(planId: string, analisisId: string, value: unknown) {
    id(planId); id(analisisId)
    const revisiones = parseRevision(value)
    return this.db.transaction(async db => {
      await this.plan(db, planId)
      const row = await this.cargar(db, planId, analisisId)
      if (row.estado !== 'pendiente' || row.bloqueo) {
        throw new ConflictException('La revisión solo se permite antes de ejecutar el análisis.')
      }
      await this.comprobarFuentes(db, row)
      const ejecucion = row.ejecucion!
      if (revisiones.size !== ejecucion.resultado_ids.length || ejecucion.resultado_ids.some(k => !revisiones.has(k))) {
        entradaInvalida({ code: 'IA_ORIGEN_INVALIDO', message: 'Revisa exactamente las fuentes preparadas.', details: [] })
      }
      for (const grupo of ejecucion.grupos) {
        const fuentes: FuenteRevisada[] = grupo.solicitud.observaciones.map(o => {
          const resultadoId = o.id.slice(10), revision = revisiones.get(resultadoId)!
          return { resultado_id: resultadoId, plan_id: row.plan_id, tarea_id: o.tarea.id,
            titulo_tarea: revision.titulo_tarea, criterio_exito: revision.criterio_exito, resultado: o.resultado,
            observacion_revisada: revision.texto, privacidad_revisada: true,
            estado_sesion: 'cerrada', consentimiento_confirmado: true }
        })
        const preparada = prepararSolicitud(planId, fuentes)
        if (!preparada.ok) entradaInvalida(preparada.error)
        grupo.solicitud = preparada.data
      }
      // Esta acción HTTP autorizada acredita la revisión de estos textos concretos;
      // ejecutar/reintentar nunca aceptan banderas ni solicitudes canónicas del cliente.
      const actual = (await db.query<RegistroAnalisis>(`UPDATE public.analisis_ia SET ejecucion=$3::jsonb,
        revision_en=clock_timestamp() WHERE plan_id=$1 AND id=$2 RETURNING ${columnas}`,
      [planId, analisisId, JSON.stringify(ejecucion)])).rows[0]
      return this.presentar(actual)
    })
  }

  private async analizarGrupo(grupo: GrupoAnalisis): Promise<void> {
    delete grupo.error
    try {
      const result = await this.proveedor.analizar(structuredClone(grupo.solicitud))
      grupo.meta = result.meta
      if (!result.ok) {
        const code = result.error.code
        fallarGrupo(grupo, codigosContrato.has(code) || codigosProveedor.has(code) ? code : 'IA_ERROR_PROVEEDOR')
        return
      }
      // Defensa en la frontera HTTP: también valida adaptadores/dobles alternativos.
      const respuesta = validarRespuesta(result.data, grupo.solicitud)
      if (!respuesta.ok) { fallarGrupo(grupo, respuesta.error.code); return }
      grupo.respuesta = respuesta.data
      grupo.estado = 'completado'
    } catch {
      delete grupo.meta
      fallarGrupo(grupo, 'IA_ERROR_PROVEEDOR')
    }
  }

  async ejecutar(planId: string, analisisId: string, value: unknown, reintento: boolean) {
    id(planId); id(analisisId); cuerpoVacio(value)
    const token = randomUUID()
    const row = await this.db.transaction(async db => {
      await this.plan(db, planId)
      // Recupera arrendamientos vencidos de este plan antes de reservar otro.
      const vencidos = (await db.query<RegistroAnalisis>(`SELECT ${columnas} FROM public.analisis_ia
        WHERE plan_id=$1 AND bloqueo IS NOT NULL AND bloqueado_hasta <= clock_timestamp() FOR UPDATE`, [planId])).rows
      for (const vencido of vencidos) await this.recuperar(db, vencido)
      const row = await this.cargar(db, planId, analisisId)
      if (row.bloqueo) throw new ConflictException('El análisis ya está en curso. Consulta su estado.')
      if (row.estado === 'completado') return row
      if (!row.revision_en) entradaInvalida({ code: 'IA_PRIVACIDAD_PENDIENTE',
        message: 'Completa la revisión de privacidad antes de ejecutar.', details: [] })
      if ((row.estado === 'pendiente') === reintento) {
        throw new ConflictException(reintento ? 'El análisis todavía no se ha ejecutado.' : 'Usa la ruta de reintento para los grupos fallidos.')
      }
      const candidatos = row.ejecucion!.grupos.filter(g => g.estado === (reintento ? 'fallido' : 'pendiente') && g.intentos < maxIntentos)
      if (!candidatos.length) throw new ConflictException('No quedan grupos fallidos con intentos disponibles.')
      if ((await db.query('SELECT id FROM public.analisis_ia WHERE plan_id=$1 AND bloqueo IS NOT NULL', [planId])).rows.length) {
        throw new ConflictException('Ya hay un análisis en curso para este plan.')
      }
      await this.comprobarFuentes(db, row)
      for (const grupo of candidatos) { grupo.estado = 'procesando'; grupo.intentos++; delete grupo.error }
      await db.query(`UPDATE public.analisis_ia SET ejecucion=$3::jsonb,estado='procesando',bloqueo=$4,
        bloqueado_hasta=clock_timestamp()+($5::int * interval '1 second'),terminado_en=NULL
        WHERE plan_id=$1 AND id=$2`, [planId, analisisId, JSON.stringify(row.ejecucion), token, arrendamientoSegundos])
      row.bloqueo = token
      return row
    })
    if (row.estado === 'completado') return this.presentar(row)
    const grupos = row.ejecucion!.grupos
    for (const grupo of grupos.filter(g => g.estado === 'procesando')) {
      await this.analizarGrupo(grupo)
      const estado = estadoDeGrupos(grupos), terminado = estado !== 'procesando'
      // Comparar token y vigencia impide que un proceso antiguo sobrescriba un reintento.
      const actual = (await this.db.query<RegistroAnalisis>(`UPDATE public.analisis_ia SET ejecucion=$3::jsonb,estado=$4,
        terminado_en=CASE WHEN $5 THEN clock_timestamp() ELSE NULL END,
        bloqueo=CASE WHEN $5 THEN NULL ELSE bloqueo END,
        bloqueado_hasta=CASE WHEN $5 THEN NULL ELSE bloqueado_hasta END
        WHERE plan_id=$1 AND id=$2 AND bloqueo=$6 AND bloqueado_hasta > clock_timestamp()
        RETURNING ${columnas}`, [planId, analisisId, JSON.stringify(row.ejecucion), estado, terminado, token])).rows[0]
      if (!actual) throw new ConflictException('La ejecución perdió su reserva. Consulta el estado antes de reintentar.')
      Object.assign(row, { estado: actual.estado, terminado_en: actual.terminado_en })
    }
    if (row.estado === 'fallido') {
      const contrato = grupos.every(g => codigosContrato.has(g.error?.code || ''))
      throw new HttpException({ message: 'No se obtuvo ningún grupo válido. Consulta el análisis antes de reintentar.',
        details: [{ field: 'analisis_id', value: row.id }, ...grupos.map(g => ({ field: `grupos.${g.id}`, rule: g.error!.code }))] },
      contrato ? 422 : 503)
    }
    return this.presentar(row)
  }
}
