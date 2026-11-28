import { BadRequestException } from '@nestjs/common'
import { fields, nonempty, object, positive, text } from '../validation'
import { CreateTaskDto, parseTask } from './tarea.dto'

export type PlanState = 'borrador' | 'activo' | 'finalizado'
export interface CreatePlanDto { nombre: string; objetivo: string; tareas: CreateTaskDto[]; cupo: number | null }
export interface UpdatePlanDto { nombre?: string; objetivo?: string; estado?: PlanState; cupo?: number | null }

export function parsePlan(value: unknown): CreatePlanDto {
  const plan = object(value)
  fields(plan, ['nombre', 'objetivo', 'tareas', 'cupo'])
  if (!Array.isArray(plan.tareas) || plan.tareas.length === 0) {
    throw new BadRequestException('El plan debe incluir al menos una tarea.')
  }
  const tareas = plan.tareas.map(parseTask)
  if (new Set(tareas.map((task) => task.orden)).size !== tareas.length) {
    throw new BadRequestException('El orden de cada tarea debe ser único.')
  }
  const codes = tareas.map((task) => task.codigo).filter((code) => code !== null)
  if (new Set(codes).size !== codes.length) throw new BadRequestException('El código de cada tarea debe ser único.')
  return { nombre: text(plan.nombre, 'nombre', 150), objetivo: text(plan.objetivo, 'objetivo', 10000), tareas, cupo: plan.cupo === undefined || plan.cupo === null ? null : positive(plan.cupo, 'cupo') }
}

export function parseUpdatePlan(value: unknown): UpdatePlanDto {
  const plan = object(value)
  fields(plan, ['nombre', 'objetivo', 'estado', 'cupo'])
  const result: UpdatePlanDto = {}
  if (plan.nombre !== undefined) result.nombre = text(plan.nombre, 'nombre', 150)
  if (plan.objetivo !== undefined) result.objetivo = text(plan.objetivo, 'objetivo', 10000)
  if (plan.estado !== undefined) {
    if (typeof plan.estado !== 'string' || !['borrador', 'activo', 'finalizado'].includes(plan.estado)) {
      throw new BadRequestException('Estado del plan inválido.')
    }
    result.estado = plan.estado as PlanState
  }
  if (plan.cupo !== undefined) result.cupo = plan.cupo === null ? null : positive(plan.cupo, 'cupo')
  nonempty(result)
  return result
}
