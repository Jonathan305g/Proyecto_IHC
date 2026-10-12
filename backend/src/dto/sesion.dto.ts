import { BadRequestException } from '@nestjs/common'
import { bodyId, fields, object, text } from '../validation'

export type CreateSessionDto =
  | { plan_id: string; codigo_participante: string; consentimiento_confirmado?: never }
  | { plan_id: string; consentimiento_confirmado: true; codigo_participante?: never }
export type UpdateSessionDto =
  | { accion: 'iniciar'; consentimiento_confirmado: true }
  | { accion: 'continuar'; consentimiento_confirmado?: never }
  | { accion: 'cerrar'; consentimiento_confirmado?: boolean }

export function parseSession(value: unknown): CreateSessionDto {
  const input = object(value)
  fields(input, ['plan_id', 'codigo_participante', 'consentimiento_confirmado'])
  const plan_id = bodyId(input.plan_id, 'plan_id')
  if (input.codigo_participante !== undefined) {
    if (input.consentimiento_confirmado !== undefined) throw new BadRequestException('Usa código manual para una sesión pendiente o consentimiento para iniciar una sesión anónima.')
    return { plan_id, codigo_participante: text(input.codigo_participante, 'codigo_participante', 30) }
  }
  if (input.consentimiento_confirmado !== true) throw new BadRequestException('Confirma el consentimiento antes de iniciar.')
  return { plan_id, consentimiento_confirmado: true }
}

export function parseUpdateSession(value: unknown): UpdateSessionDto {
  const input = object(value)
  fields(input, ['accion', 'consentimiento_confirmado'])
  if (input.accion === 'iniciar') {
    if (input.consentimiento_confirmado !== true) throw new BadRequestException('Confirma el consentimiento antes de iniciar.')
    return { accion: 'iniciar', consentimiento_confirmado: true }
  }
  if (input.accion === 'continuar') {
    fields(input, ['accion'])
    return { accion: 'continuar' }
  }
  if (input.accion === 'cerrar') {
    if (input.consentimiento_confirmado !== undefined && typeof input.consentimiento_confirmado !== 'boolean') {
      throw new BadRequestException('consentimiento_confirmado debe ser booleano.')
    }
    return { accion: 'cerrar', consentimiento_confirmado: input.consentimiento_confirmado }
  }
  throw new BadRequestException('Acción inválida. Usa iniciar, continuar o cerrar.')
}
