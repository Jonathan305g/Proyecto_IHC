import { BadRequestException, Injectable } from '@nestjs/common'
import { DatabaseService } from './database.service'
import { PlansService } from './plans.service'
import { parseTask, parseUpdateTask } from './dto/tarea.dto'
import { dbError, id, missing, positive, text } from './validation'

@Injectable()
export class TasksService {
  constructor(private readonly db: DatabaseService, private readonly plans: PlansService) {}

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
      const { rowCount } = await this.db.query(
        `UPDATE public.tareas SET ${changes.join(', ')} WHERE plan_id = $${values.length - 1} AND id = $${values.length}`,
        values,
      )
      if (!rowCount) missing('La tarea')
    } catch (error) {
      dbError(error)
    }
    return this.plans.detail(plan)
  }

  async addTask(planId: string, body: unknown) {
    const plan = id(planId)
    const task = parseTask(body)
    try {
      const { rowCount } = await this.db.query(
        `INSERT INTO public.tareas (plan_id, titulo, descripcion, criterio_exito, codigo, orden)
         SELECT id, $2, $3, $4, $5, $6 FROM public.planes WHERE id = $1 RETURNING id`,
        [plan, task.titulo, task.descripcion, task.criterio_exito, task.codigo, task.orden],
      )
      if (!rowCount) missing('El plan')
    } catch (error) {
      dbError(error)
    }
    return this.plans.detail(plan)
  }
}
