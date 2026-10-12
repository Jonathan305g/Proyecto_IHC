import { BadRequestException } from '@nestjs/common'
import { fields, object } from '../validation'

export interface SaveResultDto {
  completada: boolean
  con_ayuda: boolean
  duracion_segundos: number
  cantidad_errores: number
  observaciones: string | null
}

function integer(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 2147483647) {
    throw new BadRequestException({ message: `${field} debe ser un entero entre 0 y 2147483647.`, details: [{ field, message: 'Entero no negativo requerido.' }] })
  }
  return value
}

function observation(value: unknown): string | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string' || value.length > 10000) {
    throw new BadRequestException('observaciones debe ser texto de hasta 10000 caracteres o null.')
  }
  return value.trim() || null
}

export function parseResult(value: unknown): SaveResultDto {
  const input = object(value)
  // Dos contratos completos; se rechazan mezclas para evitar valores contradictorios.
  if ('resultado' in input) {
    fields(input, ['resultado', 'tiempo_segundos', 'errores', 'observacion'])
    if (!['sin_ayuda', 'con_ayuda', 'no_completado'].includes(String(input.resultado)) || typeof input.resultado !== 'string') {
      throw new BadRequestException('resultado debe ser sin_ayuda, con_ayuda o no_completado.')
    }
    return {
      completada: input.resultado !== 'no_completado', con_ayuda: input.resultado === 'con_ayuda',
      duracion_segundos: integer(input.tiempo_segundos, 'tiempo_segundos'),
      cantidad_errores: integer(input.errores, 'errores'), observaciones: observation(input.observacion),
    }
  }
  fields(input, ['completada', 'con_ayuda', 'duracion_segundos', 'cantidad_errores', 'observaciones'])
  if (typeof input.completada !== 'boolean') throw new BadRequestException('completada debe ser booleano.')
  if (input.con_ayuda !== undefined && typeof input.con_ayuda !== 'boolean') throw new BadRequestException('con_ayuda debe ser booleano.')
  if (!input.completada && input.con_ayuda === true) throw new BadRequestException('Una tarea no completada no puede marcarse completada con ayuda.')
  return {
    completada: input.completada, con_ayuda: input.con_ayuda === true,
    duracion_segundos: integer(input.duracion_segundos, 'duracion_segundos'),
    cantidad_errores: integer(input.cantidad_errores, 'cantidad_errores'), observaciones: observation(input.observaciones),
  }
}
