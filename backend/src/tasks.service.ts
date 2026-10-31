import { BadRequestException, ConflictException, Injectable } from '@nestjs/common'
import { PoolClient } from 'pg'
import { DatabaseService } from './database.service'
import { PlansService } from './plans.service'
import { parseTask, parseUpdateTask } from './dto/tarea.dto'
import { dbError, id, missing, positive, text } from './validation'

@Injectable()
export class TasksService {
  constructor(private readonly db: DatabaseService, private readonly plans: PlansService) {}

  private async editable(client: PoolClient, plan: string) {
    const found = await client.query('SELECT id FROM public.planes WHERE id = $1 FOR UPDATE', [plan])
    if (!found.rows.length) missing('El plan')
    const used = await client.query<{ total: string }>(
      "SELECT COUNT(*) AS total FROM public.sesiones WHERE plan_id = $1 AND estado <> 'pendiente'", [plan],
    )
    if (BigInt(used.rows[0].total) > 0n) throw new ConflictException('Las tareas no se pueden cambiar después de iniciar una sesión. Crea otro plan para una nueva evaluación.')
  }

  async updateTask(planId: string, taskId: string, body: unknown) {
    const plan = id(planId)
    const task = id(taskId)
    const input = parseUpdateTask(body)
    const changes: string[] = []
    const values: unknown[] = []
    if (input.titulo !== undefined) {
      values.push(text(input.titulo, 'titulo', 150))
      changes.push(`titulo = $${values.length}`)
    }
    if (input.descripcion !== undefined) {
      values.push(text(input.descripcion, 'descripcion', 10000))
      changes.push(`descripcion = $${values.length}`)
    }
    if (input.criterio_exito !== undefined) {
      values.push(input.criterio_exito === null ? null : text(input.criterio_exito, 'criterio_exito', 10000))
      changes.push(`criterio_exito = $${values.length}`)
    }
    if (input.codigo !== undefined) {
      values.push(input.codigo === null || input.codigo === '' ? null : text(input.codigo, 'codigo', 30))
      changes.push(`codigo = $${values.length}`)
    }
    if (input.orden !== undefined) {
      values.push(positive(input.orden, 'orden'))
      changes.push(`orden = $${values.length}`)
    }
    if (!changes.length) throw new BadRequestException('No hay cambios válidos.')
    values.push(plan, task)
    try {
      await this.db.transaction(async client => {
        await this.editable(client, plan)
        const { rowCount } = await client.query(
          `UPDATE public.tareas SET ${changes.join(', ')} WHERE plan_id = $${values.length - 1} AND id = $${values.length}`,
          values,
        )
        if (!rowCount) missing('La tarea')
      })
    } catch (error) {
      dbError(error)
    }
    return this.plans.detail(plan)
  }

  async addTask(planId: string, body: unknown) {
    const plan = id(planId)
    const task = parseTask(body)
    try {
      await this.db.transaction(async client => {
        await this.editable(client, plan)
        const { rowCount } = await client.query(
          `INSERT INTO public.tareas (plan_id, titulo, descripcion, criterio_exito, codigo, orden)
           SELECT id, $2, $3, $4, $5, $6 FROM public.planes WHERE id = $1 RETURNING id`,
          [plan, task.titulo, task.descripcion, task.criterio_exito, task.codigo, task.orden],
        )
        if (!rowCount) missing('El plan')
      })
    } catch (error) {
      dbError(error)
    }
    return this.plans.detail(plan)
  }
}
