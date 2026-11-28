import { fields, nonempty, object, positive, text } from '../validation'

export interface CreateTaskDto {
  titulo: string
  descripcion: string
  criterio_exito: string | null
  codigo: string | null
  orden: number
}
export type UpdateTaskDto = Partial<CreateTaskDto>

const allowed = ['titulo', 'descripcion', 'criterio_exito', 'codigo', 'orden'] as const

export function parseTask(value: unknown): CreateTaskDto {
  const task = object(value)
  fields(task, allowed)
  return {
    titulo: text(task.titulo, 'titulo', 150),
    descripcion: text(task.descripcion, 'descripcion', 10000),
    criterio_exito: task.criterio_exito == null ? null : text(task.criterio_exito, 'criterio_exito', 10000),
    codigo: task.codigo == null || task.codigo === '' ? null : text(task.codigo, 'codigo', 30),
    orden: positive(task.orden, 'orden'),
  }
}

export function parseUpdateTask(value: unknown): UpdateTaskDto {
  const task = object(value)
  fields(task, allowed)
  const result: UpdateTaskDto = {}
  if (task.titulo !== undefined) result.titulo = text(task.titulo, 'titulo', 150)
  if (task.descripcion !== undefined) result.descripcion = text(task.descripcion, 'descripcion', 10000)
  if (task.criterio_exito !== undefined) result.criterio_exito = task.criterio_exito === null ? null : text(task.criterio_exito, 'criterio_exito', 10000)
  if (task.codigo !== undefined) result.codigo = task.codigo === null || task.codigo === '' ? null : text(task.codigo, 'codigo', 30)
  if (task.orden !== undefined) result.orden = positive(task.orden, 'orden')
  nonempty(result)
  return result
}
