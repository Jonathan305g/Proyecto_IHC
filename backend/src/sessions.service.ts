import { ConflictException, Injectable } from '@nestjs/common'
import { DatabaseService } from './database.service'
import { id, missing } from './validation'
import { parseSession, parseUpdateSession } from './dto/sesion.dto'
import { lockSession } from './session-lock'
import { resultColumns } from './results.service'

const sessionSelect = `SELECT s.id, s.plan_id, p.nombre AS plan_nombre, s.participante_id,
  a.codigo AS participante_codigo, s.estado, s.consentimiento_confirmado,
  s.iniciada_en, s.cerrada_en, s.creada_en, p.cupo,
  (p.cupo IS NOT NULL AND (SELECT COUNT(*) FROM public.sesiones quota WHERE quota.plan_id = p.id) >= p.cupo) AS cupo_completo
  FROM public.sesiones s JOIN public.planes p ON p.id = s.plan_id
  JOIN public.participantes a ON a.id = s.participante_id`

@Injectable()
export class SessionsService {
  constructor(private readonly db: DatabaseService) {}

  async list() {
    const { rows } = await this.db.query(`${sessionSelect} ORDER BY s.creada_en DESC, s.id DESC`)
    return rows
  }

  async detail(sessionId: string) {
    const identifier = id(sessionId)
    // Una transacción y los mismos bloqueos de escritura evitan mezclar estado y avance.
    return this.db.transaction(async (client) => {
      await lockSession(client, identifier)
      const { rows } = await client.query(`${sessionSelect} WHERE s.id = $1`, [identifier])
      const { rows: tareas } = await client.query(
        'SELECT id, titulo, descripcion, criterio_exito, orden FROM public.tareas WHERE plan_id = $1 ORDER BY orden', [rows[0].plan_id],
      )
      const { rows: resultados } = await client.query(`SELECT ${resultColumns} FROM public.resultados WHERE sesion_id = $1 ORDER BY tarea_id`, [identifier])
      const complete = new Set(resultados.filter((r) => typeof r.completada === 'boolean' && r.duracion_segundos !== null).map((r) => r.tarea_id))
      const pendientes = tareas.filter((t) => !complete.has(t.id)).map((t) => t.id)
      return { ...rows[0], tareas, resultados, progreso: { total: tareas.length, registradas: tareas.length - pendientes.length, pendientes } }
    })
  }

  async create(body: unknown) {
    const input = parseSession(body)
    const sessionId = await this.db.transaction(async (client) => {
      const plan = await client.query<{ id: string; cupo: number | null; estado: string }>(
        'SELECT id, cupo, estado FROM public.planes WHERE id = $1 FOR UPDATE', [input.plan_id],
      )
      if (!plan.rows.length) missing('El plan')
      if (plan.rows[0].estado === 'finalizado') throw new ConflictException('El plan está finalizado.')
      const count = await client.query<{ total: string }>('SELECT COUNT(*) AS total FROM public.sesiones WHERE plan_id = $1', [input.plan_id])
      if (plan.rows[0].cupo !== null && BigInt(count.rows[0].total) >= BigInt(plan.rows[0].cupo)) {
        throw new ConflictException('El cupo del plan está completo. Puedes continuar una sesión existente.')
      }
      let code = input.codigo_participante
      if (code === undefined) {
        // Serializa también con inserciones manuales; MAX no pierde precisión ni trunca P-1000.
        await client.query('LOCK TABLE public.participantes IN SHARE ROW EXCLUSIVE MODE')
        const next = await client.query<{ siguiente: string }>(
          `SELECT (COALESCE(MAX(SUBSTRING(codigo FROM 3)::numeric), 0) + 1)::text AS siguiente
           FROM public.participantes WHERE codigo ~ '^P-[0-9]+$'`,
        )
        code = `P-${next.rows[0].siguiente.padStart(3, '0')}`
        if (code.length > 30) throw new ConflictException('Se agotaron los códigos de participante.')
      }
      const participant = await client.query<{ id: string }>(
        'INSERT INTO public.participantes (codigo) VALUES ($1) ON CONFLICT (codigo) DO UPDATE SET codigo = EXCLUDED.codigo RETURNING id', [code],
      )
      const automatic = input.codigo_participante === undefined
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO public.sesiones (plan_id, participante_id, estado, consentimiento_confirmado, iniciada_en)
         VALUES ($1, $2, $3, $4, CASE WHEN $4 THEN NOW() ELSE NULL END) RETURNING id`,
        [input.plan_id, participant.rows[0].id, automatic ? 'en_curso' : 'pendiente', automatic],
      )
      return rows[0].id
    })
    return this.detail(sessionId)
  }

  async update(sessionId: string, body: unknown) {
    const identifier = id(sessionId)
    const input = parseUpdateSession(body)
    await this.db.transaction(async (client) => {
      const session = await lockSession(client, identifier)
      if (input.accion === 'iniciar') {
        if (session.estado !== 'pendiente') this.invalidTransition()
        await client.query(
          `UPDATE public.sesiones SET estado = 'en_curso', consentimiento_confirmado = TRUE, iniciada_en = NOW() WHERE id = $1`, [identifier],
        )
        return
      }
      if (session.estado !== 'en_curso' || !session.consentimiento_confirmado) this.invalidTransition()
      if (input.accion === 'continuar') return
      const tasks = await client.query<{ id: string }>(
        `SELECT t.id FROM public.tareas t WHERE t.plan_id = $1 AND NOT EXISTS (
           SELECT 1 FROM public.resultados r WHERE r.sesion_id = $2 AND r.tarea_id = t.id
             AND r.completada IS NOT NULL AND r.duracion_segundos IS NOT NULL
         ) ORDER BY t.orden`, [session.plan_id, identifier],
      )
      const total = await client.query<{ total: string }>('SELECT COUNT(*) AS total FROM public.tareas WHERE plan_id = $1', [session.plan_id])
      if (tasks.rows.length || total.rows[0].total === '0') {
        throw new ConflictException({ message: 'No se puede cerrar la sesión: faltan resultados de tareas o el plan no tiene tareas.', details: tasks.rows.map((task) => ({ tarea_id: task.id, message: 'Resultado pendiente.' })) })
      }
      await client.query(`UPDATE public.sesiones SET estado = 'cerrada', cerrada_en = NOW() WHERE id = $1`, [identifier])
    })
    return this.detail(identifier)
  }

  private invalidTransition(): never {
    throw new ConflictException('La sesión ya cambió de estado o no permite esta operación.')
  }
}
