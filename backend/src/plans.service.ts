import { BadRequestException, ConflictException, Injectable } from '@nestjs/common'
import { DatabaseService } from './database.service'
import { dbError, id, missing, text } from './validation'
import { parsePlan, parseUpdatePlan } from './dto/plan.dto'

@Injectable()
export class PlansService {
  constructor(private readonly db: DatabaseService) {}

  async list() {
    const { rows } = await this.db.query(
      'SELECT id, nombre, objetivo, estado, cupo, creado_en, actualizado_en FROM public.planes ORDER BY creado_en DESC, id DESC',
    )
    return rows
  }

  async detail(planId: string) {
    const identifier = id(planId)
    const { rows } = await this.db.query(
      'SELECT id, nombre, objetivo, estado, cupo, creado_en, actualizado_en FROM public.planes WHERE id = $1',
      [identifier],
    )
    if (!rows.length) missing('El plan')
    const tasks = await this.db.query(
      'SELECT id, plan_id, titulo, descripcion, criterio_exito, codigo, orden FROM public.tareas WHERE plan_id = $1 ORDER BY orden',
      [identifier],
    )
    return { ...rows[0], tareas: tasks.rows }
  }

  async create(body: unknown) {
    const plan = parsePlan(body)
    let createdId: string
    try {
      createdId = await this.db.transaction(async (client) => {
        const saved = await client.query<{ id: string }>(
          'INSERT INTO public.planes (nombre, objetivo, cupo) VALUES ($1, $2, $3) RETURNING id',
          [plan.nombre, plan.objetivo, plan.cupo],
        )
        const planId = saved.rows[0].id
        for (const task of plan.tareas) {
          await client.query(
            'INSERT INTO public.tareas (plan_id, titulo, descripcion, criterio_exito, codigo, orden) VALUES ($1, $2, $3, $4, $5, $6)',
            [planId, task.titulo, task.descripcion, task.criterio_exito, task.codigo, task.orden],
          )
        }
        return planId
      })
    } catch (error) {
      dbError(error)
    }
    return this.detail(createdId)
  }

  async update(planId: string, body: unknown) {
    const identifier = id(planId)
    const input = parseUpdatePlan(body)
    const changes: string[] = []
    const values: unknown[] = []
    if (input.nombre !== undefined) {
      values.push(text(input.nombre, 'nombre', 150))
      changes.push(`nombre = $${values.length}`)
    }
    if (input.objetivo !== undefined) {
      values.push(text(input.objetivo, 'objetivo', 10000))
      changes.push(`objetivo = $${values.length}`)
    }
    if (input.estado !== undefined) {
      if (!['borrador', 'activo', 'finalizado'].includes(String(input.estado))) {
        throw new BadRequestException('Estado del plan inválido.')
      }
      values.push(input.estado)
      changes.push(`estado = $${values.length}`)
    }
    if (input.cupo !== undefined) {
      values.push(input.cupo)
      changes.push(`cupo = $${values.length}`)
    }
    if (!changes.length) throw new BadRequestException('No hay cambios válidos.')
    values.push(identifier)
    await this.db.transaction(async (client) => {
      const plan = await client.query('SELECT id FROM public.planes WHERE id = $1 FOR UPDATE', [identifier])
      if (!plan.rows.length) missing('El plan')
      if (input.cupo !== undefined && input.cupo !== null) {
        const count = await client.query<{ total: string }>('SELECT COUNT(*) AS total FROM public.sesiones WHERE plan_id = $1', [identifier])
        if (BigInt(count.rows[0].total) > BigInt(input.cupo)) {
          throw new ConflictException('El cupo no puede ser menor que las sesiones ya creadas.')
        }
      }
      await client.query(
        `UPDATE public.planes SET ${changes.join(', ')}, actualizado_en = NOW() WHERE id = $${values.length}`, values,
      )
    })
    return this.detail(identifier)
  }

}
