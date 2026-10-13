import { Injectable, NotFoundException } from '@nestjs/common'
import * as fs from 'fs'
import * as path from 'path'
import { randomBytes } from 'crypto'
import { DatabaseService } from './database.service'
import {
  parseLinkEvidence,
  UploadedFileDto,
  validateUploadedFile,
} from './dto/evidencia.dto'
import { id, missing, text } from './validation'

@Injectable()
export class EvidencesService {
  private readonly uploadDir: string

  constructor(private readonly db: DatabaseService) {
    this.uploadDir = path.join(process.cwd(), 'uploads', 'evidencias')
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true })
    }
  }

  private async ensureResultadoId(
    client: { query: DatabaseService['query'] },
    sessionId: string,
    taskId: string,
  ): Promise<string> {
    const sessionRes = await client.query(
      'SELECT id, plan_id, estado FROM public.sesiones WHERE id = $1',
      [sessionId],
    )
    if (!sessionRes.rows.length) missing('La sesión')
    const session = sessionRes.rows[0]

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
       VALUES ($1, $2, $3, NULL, FALSE, 0, 0, NULL)
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

    const ext = path.extname(meta.nombre_archivo) || ''
    const uniqueName = `${Date.now()}-${randomBytes(8).toString('hex')}${ext}`
    const relativePath = path.join('uploads', 'evidencias', uniqueName).replace(/\\/g, '/')
    const absolutePath = path.join(this.uploadDir, uniqueName)

    if (file.buffer) {
      await fs.promises.writeFile(absolutePath, file.buffer)
    } else if (file.path && fs.existsSync(file.path)) {
      await fs.promises.copyFile(file.path, absolutePath)
    } else {
      missing('El contenido del archivo')
    }

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
      await fs.promises.unlink(absolutePath).catch(() => {})
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
      return { isLink: true, url: evidence.ruta, evidence }
    }

    const absolutePath = path.resolve(process.cwd(), evidence.ruta)
    if (!fs.existsSync(absolutePath)) {
      throw new NotFoundException('El archivo físico de la evidencia no existe.')
    }

    return {
      isLink: false,
      absolutePath,
      evidence,
      mimeType: evidence.mime_type || 'application/octet-stream',
      filename: evidence.nombre_archivo || path.basename(absolutePath),
    }
  }

  async delete(evidenceIdParam: string) {
    const evidence = await this.getDetail(evidenceIdParam)
    const identifier = id(evidenceIdParam)

    await this.db.query('DELETE FROM public.evidencias WHERE id = $1', [identifier])

    if (evidence.tipo !== 'enlace' && evidence.ruta) {
      const absolutePath = path.resolve(process.cwd(), evidence.ruta)
      await fs.promises.unlink(absolutePath).catch(() => {})
    }

    return { id: identifier, borrado: true }
  }
}
