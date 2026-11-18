import { BadRequestException } from '@nestjs/common'
import { fields, object, text } from '../validation'
import { comprobarSeleccion, ErrorContrato, ObservacionIA } from './contrato'

export function entradaInvalida(error: ErrorContrato): never {
  throw new BadRequestException({ message: error.message,
    details: [{ field: 'analisis', rule: error.code }, ...error.details] })
}

export function parseCreacion(value: unknown): { solicitud_id: string; resultado_ids: string[] } {
  const input = object(value)
  fields(input, ['solicitud_id', 'resultado_ids'])
  if (typeof input.solicitud_id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.solicitud_id)) {
    throw new BadRequestException('solicitud_id debe ser un UUID v4 para identificar esta selección.')
  }
  const ids = input.resultado_ids
  if (!Array.isArray(ids) || !ids.length || ids.length > 100 || new Set(ids).size !== ids.length) {
    throw new BadRequestException('Selecciona entre 1 y 100 resultados únicos.')
  }
  for (let n = 0; n < ids.length; n += 50) {
    const chunk = ids.slice(n, n + 50)
    const result = comprobarSeleccion(chunk, chunk.map(resultado_id => ({ resultado_id })))
    if (!result.ok) entradaInvalida(result.error)
  }
  return { solicitud_id: input.solicitud_id.toLowerCase(),
    resultado_ids: [...ids].sort((a, b) => BigInt(a) < BigInt(b) ? -1 : 1) }
}

// Solo textos revisables. Identidad, tarea, resultado y plan siempre salen del servidor.
export function parseRevision(value: unknown): Map<string, Pick<ObservacionIA, 'texto'> & {
  titulo_tarea: string; criterio_exito: string | null
}> {
  const input = object(value)
  fields(input, ['observaciones'])
  if (!Array.isArray(input.observaciones) || !input.observaciones.length || input.observaciones.length > 100) {
    throw new BadRequestException('Revisa todas las observaciones de la selección.')
  }
  const revisiones = new Map<string, { texto: string; titulo_tarea: string; criterio_exito: string | null }>()
  for (const value of input.observaciones) {
    const item = object(value)
    fields(item, ['resultado_id', 'texto', 'titulo_tarea', 'criterio_exito'])
    // Los límites y la privacidad del texto completo se validan después con S3-02.
    if (typeof item.resultado_id !== 'string' || revisiones.has(item.resultado_id)) {
      throw new BadRequestException('Las revisiones deben tener identificadores únicos en cadena.')
    }
    revisiones.set(item.resultado_id, { texto: text(item.texto, 'texto', 2000),
      titulo_tarea: text(item.titulo_tarea, 'titulo_tarea', 150),
      criterio_exito: item.criterio_exito === null ? null : text(item.criterio_exito, 'criterio_exito', 500) })
  }
  return revisiones
}

export function cuerpoVacio(value: unknown): void {
  fields(object(value ?? {}), [])
}
