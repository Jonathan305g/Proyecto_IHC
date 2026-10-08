import { BadRequestException, Injectable } from '@nestjs/common'
import { DatabaseService } from './database.service'
import { dbError, id, missing, object, positive, text } from './validation'

type PlanInput = { nombre: string; objetivo: string; tareas: TaskInput[] }
type TaskInput = { titulo: string; descripcion: string; criterio_exito: string | null; codigo: string | null; orden: number }

export function parseTask(value: unknown): TaskInput {
  const task = object(value)
  const criterio = task.criterio_exito == null ? null : text(task.criterio_exito, 'criterio_exito', 10000)
  const codigo = task.codigo == null || task.codigo === '' ? null : text(task.codigo, 'codigo', 30)
  return {
    titulo: text(task.titulo, 'titulo', 150),
    descripcion: text(task.descripcion, 'descripcion', 10000),
    criterio_exito: criterio,
    codigo,
    orden: positive(task.orden, 'orden'),
  }
}

function parsePlan(value: unknown): PlanInput {
  const plan = object(value)
  if (!Array.isArray(plan.tareas) || plan.tareas.length === 0) {
    throw new BadRequestException('El plan debe incluir al menos una tarea.')
  }
  const tareas = plan.tareas.map(parseTask)
  if (new Set(tareas.map((task) => task.orden)).size !== tareas.length) {
    throw new BadRequestException('El orden de cada tarea debe ser único.')
  }
  const codes = tareas.map((task) => task.codigo).filter((code) => code !== null)
  if (new Set(codes).size !== codes.length) {
    throw new BadRequestException('El código de cada tarea debe ser único.')
  }
  return {
    nombre: text(plan.nombre, 'nombre', 150),
    objetivo: text(plan.objetivo, 'objetivo', 10000),
    tareas,
  }
}

@Injectable()
export class PlansService {
  constructor(private readonly db: DatabaseService) {}

  async list() {
    const { rows } = await this.db.query(
      'SELECT id, nombre, objetivo, estado, creado_en, actualizado_en FROM public.planes ORDER BY creado_en DESC, id DESC',
    )
    return rows
  }

  async detail(planId: string) {
    const identifier = id(planId)
    const { rows } = await this.db.query(
      'SELECT id, nombre, objetivo, estado, creado_en, actualizado_en FROM public.planes WHERE id = $1',
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
          'INSERT INTO public.planes (nombre, objetivo) VALUES ($1, $2) RETURNING id',
          [plan.nombre, plan.objetivo],
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
    const input = object(body)
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
    if (!changes.length) throw new BadRequestException('No hay cambios válidos.')
    values.push(identifier)
    const { rowCount } = await this.db.query(
      `UPDATE public.planes SET ${changes.join(', ')}, actualizado_en = NOW() WHERE id = $${values.length}`,
      values,
    )
    if (!rowCount) missing('El plan')
    return this.detail(identifier)
  }

}
