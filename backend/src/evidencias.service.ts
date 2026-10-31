import { ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common'
import { randomUUID } from 'crypto'
import { StorageService } from './storage.service'
import { lockSession } from './session-lock'
import { PoolClient } from 'pg'
import { DatabaseService } from './database.service'
import {
  parseLinkEvidence,
  UploadedFileDto,
  validateUploadedFile,
} from './dto/evidencia.dto'
import { id, missing, text } from './validation'

@Injectable()
export class EvidencesService {
  constructor(private readonly db: DatabaseService, private readonly storage: StorageService) {}

  private async writable(client: PoolClient, sessionId: string) {
    const session = await lockSession(client, sessionId)
    if (session.estado !== 'en_curso' || !session.consentimiento_confirmado) {
      throw new ConflictException('Solo puedes modificar evidencias en una sesión en curso con consentimiento.')
    }
    return session
  }

  private async ensureResultadoId(
    client: PoolClient,
    sessionId: string,
    taskId: string,
  ): Promise<string> {
    const session = await this.writable(client, sessionId)

    const taskRes = await client.query(
      'SELECT id FROM public.tareas WHERE id = $1 AND plan_id = $2',
      [taskId, session.plan_id],
    )
    if (!taskRes.rows.length) missing('La tarea del plan')

    const existingRes = await client.query(
      'SELECT id FROM public.resultados WHERE sesion_id = $1 AND tarea_id = $2',
      [sessionId, taskId],
    )
    if (existingRes.rows.length) {
      return String(existingRes.rows[0].id)
    }

    // Si aún no se guardó el resultado de la tarea, crear el registro base asociado
    const createdRes = await client.query<{ id: string }>(
      `INSERT INTO public.resultados (plan_id, sesion_id, tarea_id, completada, con_ayuda, duracion_segundos, cantidad_errores, observaciones)
       VALUES ($1, $2, $3, NULL, FALSE, NULL, 0, NULL)
       RETURNING id`,
      [session.plan_id, sessionId, taskId],
    )
    return String(createdRes.rows[0].id)
  }

  async createFromFile(
    sessionIdParam: string,
    taskIdParam: string,
    file: UploadedFileDto,
    rawDescripcion?: unknown,
  ) {
    const sessionId = id(sessionIdParam)
    const taskId = id(taskIdParam)
    const meta = validateUploadedFile(file)
    const descripcion =
      rawDescripcion && typeof rawDescripcion === 'string' && rawDescripcion.trim()
        ? text(rawDescripcion, 'descripcion', 1000)
        : null

    const objectKey = `${sessionId}/${taskId}/${randomUUID()}`
    const relativePath = `supabase://${objectKey}`
    await this.storage.upload(objectKey, file.buffer!, meta.mime_type)

    try {
      const saved = await this.db.transaction(async (client) => {
        const resultadoId = await this.ensureResultadoId(client, sessionId, taskId)
        const { rows } = await client.query(
          `INSERT INTO public.evidencias (resultado_id, tipo, ruta, descripcion, nombre_archivo, tamano_bytes, mime_type)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, resultado_id, tipo, ruta, descripcion, nombre_archivo, tamano_bytes, mime_type, creada_en`,
          [
            resultadoId,
            meta.tipo,
            relativePath,
            descripcion,
            meta.nombre_archivo,
            meta.tamano_bytes,
            meta.mime_type,
          ],
        )
        return rows[0]
      })
      return saved
    } catch (error) {
      // Evitar archivos huérfanos: si la base de datos rechaza la operación, se borra el archivo
      await this.storage.remove(objectKey).catch(async () => {
        await this.db.query('INSERT INTO public.storage_deletions (object_key) VALUES ($1) ON CONFLICT DO NOTHING', [objectKey])
          .catch(() => console.error('Revisar objeto de evidencia sin metadatos:', objectKey))
      })
      throw error
    }
  }

  async createFromLink(
    sessionIdParam: string,
    taskIdParam: string,
    body: unknown,
  ) {
    const sessionId = id(sessionIdParam)
    const taskId = id(taskIdParam)
    const link = parseLinkEvidence(body)

    return this.db.transaction(async (client) => {
      const resultadoId = await this.ensureResultadoId(client, sessionId, taskId)
      const { rows } = await client.query(
        `INSERT INTO public.evidencias (resultado_id, tipo, ruta, descripcion, nombre_archivo, tamano_bytes, mime_type)
         VALUES ($1, $2, $3, $4, NULL, NULL, NULL)
         RETURNING id, resultado_id, tipo, ruta, descripcion, nombre_archivo, tamano_bytes, mime_type, creada_en`,
        [resultadoId, 'enlace', link.ruta, link.descripcion],
      )
      return rows[0]
    })
  }

  async listByTask(sessionIdParam: string, taskIdParam: string) {
    const sessionId = id(sessionIdParam)
    const taskId = id(taskIdParam)

    const sessionRes = await this.db.query('SELECT id FROM public.sesiones WHERE id = $1', [sessionId])
    if (!sessionRes.rows.length) missing('La sesión')

    const { rows } = await this.db.query(
      `SELECT e.id, e.resultado_id, e.tipo, e.ruta, e.descripcion, e.nombre_archivo, e.tamano_bytes, e.mime_type, e.creada_en
       FROM public.evidencias e
       JOIN public.resultados r ON r.id = e.resultado_id
       WHERE r.sesion_id = $1 AND r.tarea_id = $2
       ORDER BY e.creada_en ASC, e.id ASC`,
      [sessionId, taskId],
    )
    return rows
  }

  async listBySession(sessionIdParam: string) {
    const sessionId = id(sessionIdParam)
    const sessionRes = await this.db.query('SELECT id FROM public.sesiones WHERE id = $1', [sessionId])
    if (!sessionRes.rows.length) missing('La sesión')

    const { rows } = await this.db.query(
      `SELECT e.id, e.resultado_id, r.tarea_id, t.titulo AS tarea_titulo, t.orden AS tarea_orden,
              e.tipo, e.ruta, e.descripcion, e.nombre_archivo, e.tamano_bytes, e.mime_type, e.creada_en
       FROM public.evidencias e
       JOIN public.resultados r ON r.id = e.resultado_id
       JOIN public.tareas t ON t.id = r.tarea_id
       WHERE r.sesion_id = $1
       ORDER BY t.orden ASC, e.creada_en ASC, e.id ASC`,
      [sessionId],
    )
    return rows
  }

  async getDetail(evidenceIdParam: string) {
    const identifier = id(evidenceIdParam)
    const { rows } = await this.db.query(
      `SELECT e.id, e.resultado_id, r.sesion_id, r.tarea_id, t.titulo AS tarea_titulo,
              e.tipo, e.ruta, e.descripcion, e.nombre_archivo, e.tamano_bytes, e.mime_type, e.creada_en
       FROM public.evidencias e
       JOIN public.resultados r ON r.id = e.resultado_id
       JOIN public.tareas t ON t.id = r.tarea_id
       WHERE e.id = $1`,
      [identifier],
    )
    if (!rows.length) missing('La evidencia')
    return rows[0]
  }

  async getFile(evidenceIdParam: string) {
    const evidence = await this.getDetail(evidenceIdParam)
    if (evidence.tipo === 'enlace') {
      return { isLink: true, url: parseLinkEvidence({ tipo: 'enlace', ruta: evidence.ruta }).ruta, evidence }
    }

    if (!String(evidence.ruta).startsWith('supabase://')) {
      throw new ServiceUnavailableException('Esta evidencia antigua debe migrarse al almacenamiento compartido.')
    }
    return { isLink: false, url: await this.storage.sign(String(evidence.ruta).slice(11), String(evidence.nombre_archivo || 'evidencia')), evidence }
  }

  async delete(evidenceIdParam: string) {
    const evidence = await this.getDetail(evidenceIdParam)
    const identifier = id(evidenceIdParam)

    await this.db.transaction(async (client) => {
      await this.writable(client, String(evidence.sesion_id))
      const current = await client.query('SELECT id FROM public.evidencias WHERE id = $1 FOR UPDATE', [identifier])
      if (!current.rows.length) missing('La evidencia')
      if (evidence.tipo !== 'enlace' && String(evidence.ruta).startsWith('supabase://')) {
        await client.query('INSERT INTO public.storage_deletions (object_key) VALUES ($1) ON CONFLICT DO NOTHING', [String(evidence.ruta).slice(11)])
      }
      await client.query('DELETE FROM public.evidencias WHERE id = $1', [identifier])
    })
    // La cola transaccional permite reintentar sin perder los metadatos de limpieza.
    if (evidence.tipo !== 'enlace' && String(evidence.ruta).startsWith('supabase://')) {
      const key = String(evidence.ruta).slice(11)
      await this.storage.remove(key)
        .then(() => this.db.query('DELETE FROM public.storage_deletions WHERE object_key = $1', [key]))
        .catch(() => console.error('Limpieza de Storage pendiente; ejecutar npm run storage:cleanup.'))
    }
    return { id: identifier, borrado: true }
  }
}
