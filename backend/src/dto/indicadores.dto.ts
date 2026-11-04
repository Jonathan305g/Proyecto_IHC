import { BadRequestException } from '@nestjs/common'
import { fields, id, object } from '../validation'

export interface IndicatorFilters {
  plan_id: string
  desde: string | null
  hasta: string | null
  tarea_ids: string[] | null
}

function invalid(field: string, message: string): never {
  throw new BadRequestException({ message, details: [{ field, message }] })
}

function identifier(value: unknown, field: string): string {
  if (typeof value !== 'string') invalid(field, `${field} debe ser una cadena BIGINT positiva.`)
  try { return id(value) } catch { invalid(field, `${field} debe ser un BIGINT positivo válido.`) }
}

/** Perfil ISO 8601: calendario real, segundos y zona obligatorios, precisión PostgreSQL. */
function timestamp(value: unknown, field: string): { text: string; micros: bigint } | null {
  if (value === undefined) return null
  const match = typeof value === 'string'
    ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-](\d{2}):(\d{2}))$/.exec(value)
    : null
  if (!match) invalid(field, `${field} debe ser una fecha ISO 8601 con Z u offset explícito.`)
  const [, year, month, day, hour, minute, second, fraction = '', zone, offsetHour = '0', offsetMinute = '0'] = match
  const y = Number(year), m = Number(month), d = Number(day)
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (y === 0 || m < 1 || m > 12 || d < 1 || d > days[m - 1]
    || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59
    || Number(offsetHour) > 14 || Number(offsetMinute) > 59
    || (Number(offsetHour) === 14 && Number(offsetMinute) !== 0)) {
    invalid(field, `${field} contiene una fecha, hora o zona inválida.`)
  }
  // No truncar microsegundos al comparar períodos ni al enviarlos a PostgreSQL.
  const millis = Date.parse(`${year}-${month}-${day}T${hour}:${minute}:${second}${zone}`)
  return { text: value as string, micros: BigInt(millis) * 1000n + BigInt(fraction.padEnd(6, '0')) }
}

export function parseIndicatorFilters(planId: unknown, value: unknown = {}): IndicatorFilters {
  const plan_id = identifier(planId, 'plan_id')
  const input = object(value)
  fields(input, ['desde', 'hasta', 'tarea_ids'])
  const desde = timestamp(input.desde, 'desde'), hasta = timestamp(input.hasta, 'hasta')
  if (desde && hasta && desde.micros >= hasta.micros) invalid('hasta', 'El período exige desde menor que hasta.')
  let tarea_ids: string[] | null = null
  if (input.tarea_ids !== undefined) {
    if (typeof input.tarea_ids !== 'string' || input.tarea_ids === '') {
      invalid('tarea_ids', 'tarea_ids debe ser una selección no vacía de IDs separados por comas.')
    }
    tarea_ids = input.tarea_ids.split(',').map(value => identifier(value, 'tarea_ids'))
    if (new Set(tarea_ids).size !== tarea_ids.length) invalid('tarea_ids', 'No se permiten tareas repetidas.')
  }
  return { plan_id, desde: desde?.text ?? null, hasta: hasta?.text ?? null, tarea_ids }
}
