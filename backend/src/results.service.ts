import { ConflictException, Injectable } from '@nestjs/common'
import { DatabaseService } from './database.service'
import { parseResult } from './dto/resultado.dto'
import { lockSession } from './session-lock'
import { id, missing } from './validation'

export const resultColumns = `id, plan_id, sesion_id, tarea_id, completada, con_ayuda,
  duracion_segundos, cantidad_errores, observaciones, registrado_en,
  CASE WHEN completada IS NULL THEN NULL WHEN NOT completada THEN 'no_completado'
       WHEN con_ayuda THEN 'con_ayuda' ELSE 'sin_ayuda' END AS resultado,
  duracion_segundos AS tiempo_segundos, cantidad_errores AS errores, observaciones AS observacion`

@Injectable()
export class ResultsService {
  constructor(private readonly db: DatabaseService) {}

  async list(sessionId: string) {
    const identifier = id(sessionId)
    const session = await this.db.query('SELECT id FROM public.sesiones WHERE id = $1', [identifier])
    if (!session.rows.length) missing('La sesión')
    const { rows } = await this.db.query(`SELECT ${resultColumns} FROM public.resultados WHERE sesion_id = $1 ORDER BY tarea_id`, [identifier])
    return rows
  }

  async save(sessionId: string, taskId: string, body: unknown) {
    const identifier = id(sessionId)
    const task = id(taskId)
    const input = parseResult(body)
    return this.db.transaction(async (client) => {
      const session = await lockSession(client, identifier)
      if (session.estado !== 'en_curso' || !session.consentimiento_confirmado) {
        throw new ConflictException('Solo se pueden guardar resultados en una sesión en curso con consentimiento confirmado.')
      }
      const taskRow = await client.query('SELECT id FROM public.tareas WHERE id = $1 AND plan_id = $2', [task, session.plan_id])
      if (!taskRow.rows.length) missing('La tarea del plan')
      const { rows } = await client.query(
        `INSERT INTO public.resultados (plan_id, sesion_id, tarea_id, completada, con_ayuda, duracion_segundos, cantidad_errores, observaciones)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (sesion_id, tarea_id) DO UPDATE SET
           completada = EXCLUDED.completada, con_ayuda = EXCLUDED.con_ayuda,
           duracion_segundos = EXCLUDED.duracion_segundos, cantidad_errores = EXCLUDED.cantidad_errores,
           observaciones = EXCLUDED.observaciones
         RETURNING ${resultColumns}`,
        [session.plan_id, identifier, task, input.completada, input.con_ayuda, input.duracion_segundos, input.cantidad_errores, input.observaciones],
      )
      return rows[0]
    })
  }
}
