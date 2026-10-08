import { BadRequestException, ConflictException, Injectable } from '@nestjs/common'
import { DatabaseService } from './database.service'
import { dbError, id, missing, object, text } from './validation'

@Injectable()
export class SessionsService {
  constructor(private readonly db: DatabaseService) {}

  async list() {
    const { rows } = await this.db.query(
      `SELECT s.id, s.plan_id, p.nombre AS plan_nombre, s.participante_id,
              a.codigo AS participante_codigo, s.estado, s.consentimiento_confirmado,
              s.iniciada_en, s.cerrada_en, s.creada_en
       FROM public.sesiones s JOIN public.planes p ON p.id = s.plan_id
       JOIN public.participantes a ON a.id = s.participante_id
       ORDER BY s.creada_en DESC, s.id DESC`,
    )
    return rows
  }

  async detail(sessionId: string) {
    const identifier = id(sessionId)
    const { rows } = await this.db.query(
      `SELECT s.id, s.plan_id, p.nombre AS plan_nombre, s.participante_id,
              a.codigo AS participante_codigo, s.estado, s.consentimiento_confirmado,
              s.iniciada_en, s.cerrada_en, s.creada_en
       FROM public.sesiones s JOIN public.planes p ON p.id = s.plan_id
       JOIN public.participantes a ON a.id = s.participante_id WHERE s.id = $1`,
      [identifier],
    )
    if (!rows.length) missing('La sesión')
    const { rows: tareas } = await this.db.query(
      'SELECT id, titulo, descripcion, criterio_exito, orden FROM public.tareas WHERE plan_id = $1 ORDER BY orden',
      [rows[0].plan_id],
    )
    return { ...rows[0], tareas }
  }

  async create(body: unknown) {
    const input = object(body)
    const planId = id(String(input.plan_id ?? ''))
    const code = text(input.codigo_participante, 'codigo_participante', 30)
    let sessionId: string
    try {
      sessionId = await this.db.transaction(async (client) => {
        const plan = await client.query('SELECT id FROM public.planes WHERE id = $1', [planId])
        if (!plan.rowCount) missing('El plan')
        const participant = await client.query<{ id: string }>(
          'INSERT INTO public.participantes (codigo) VALUES ($1) ON CONFLICT (codigo) DO UPDATE SET codigo = EXCLUDED.codigo RETURNING id',
          [code],
        )
        const { rows } = await client.query<{ id: string }>(
          'INSERT INTO public.sesiones (plan_id, participante_id) VALUES ($1, $2) RETURNING id',
          [planId, participant.rows[0].id],
        )
        return rows[0].id
      })
    } catch (error) {
      dbError(error)
    }
    return this.detail(sessionId)
  }

  async update(sessionId: string, body: unknown) {
    const identifier = id(sessionId)
    const input = object(body)
    if (input.accion === 'iniciar') {
      if (input.consentimiento_confirmado !== true) {
        throw new BadRequestException('Confirma el consentimiento antes de iniciar.')
      }
      const { rowCount } = await this.db.query(
        `UPDATE public.sesiones SET estado = 'en_curso', consentimiento_confirmado = TRUE,
                iniciada_en = NOW() WHERE id = $1 AND estado = 'pendiente'`,
        [identifier],
      )
      if (!rowCount) await this.invalidTransition(identifier)
    } else if (input.accion === 'cerrar') {
      const { rowCount } = await this.db.query(
        `UPDATE public.sesiones SET estado = 'cerrada', cerrada_en = NOW()
         WHERE id = $1 AND estado = 'en_curso' AND consentimiento_confirmado = TRUE`,
        [identifier],
      )
      if (!rowCount) await this.invalidTransition(identifier)
    } else {
      throw new BadRequestException('Acción inválida. Usa iniciar o cerrar.')
    }
    return this.detail(identifier)
  }

  private async invalidTransition(identifier: string): Promise<never> {
    const { rowCount } = await this.db.query('SELECT id FROM public.sesiones WHERE id = $1', [identifier])
    if (!rowCount) missing('La sesión')
    throw new ConflictException('La sesión ya cambió de estado o no permite esta operación.')
  }
}
