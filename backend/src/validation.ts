import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'

export function object(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new BadRequestException('Se esperaba un objeto JSON.')
  }
  return value as Record<string, unknown>
}

export function text(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new BadRequestException(`${field} debe contener entre 1 y ${max} caracteres.`)
  }
  return value.trim()
}

export function id(value: string): string {
  if (!/^[1-9]\d*$/.test(value) || value.length > 19 || BigInt(value) > 9223372036854775807n) {
    throw new BadRequestException('Identificador inválido: debe ser un BIGINT positivo.')
  }
  return value
}

export function positive(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0 || Number(value) > 2147483647) {
    throw new BadRequestException(`${field} debe ser un entero positivo.`)
  }
  return Number(value)
}

export function fields(input: Record<string, unknown>, allowed: readonly string[]): void {
  const unknown = Object.keys(input).filter((key) => !allowed.includes(key))
  if (unknown.length) {
    throw new BadRequestException({ message: 'Hay campos no admitidos.', details: unknown.map((field) => ({ field, message: 'Campo no admitido.' })) })
  }
}

export function nonempty(input: object): void {
  if (!Object.keys(input).length) throw new BadRequestException('No hay cambios válidos.')
}

export function bodyId(value: unknown, field: string): string {
  if (typeof value !== 'string' && !(typeof value === 'number' && Number.isSafeInteger(value))) {
    throw new BadRequestException(`${field} debe ser una cadena BIGINT o un entero seguro.`)
  }
  return id(String(value))
}

export function dbError(error: unknown): never {
  const code = (error as { code?: string }).code
  if (code === '23505') throw new ConflictException('Ya existe un registro con esos datos.')
  if (code === '23503') throw new ConflictException('El registro tiene relaciones que impiden el cambio.')
  if (code === '23514' || code === '23502' || code === '22001') {
    throw new BadRequestException('Los datos no cumplen las restricciones de la base.')
  }
  throw error
}

export function missing(label: string): never {
  throw new NotFoundException(`${label} no existe.`)
}
