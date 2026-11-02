import Ajv2020 from 'ajv/dist/2020'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export type ResultadoTarea = 'sin_ayuda' | 'con_ayuda' | 'no_completado'
export interface ObservacionIA {
  id: string
  tarea: { id: string; titulo: string; criterio_exito: string | null }
  resultado: ResultadoTarea
  texto: string
}
export interface SolicitudIA { version: '1.0'; plan_id: string; observaciones: ObservacionIA[] }
export interface HallazgoIA {
  observacion_ids: string[]
  resumen: string
  categoria: 'navegacion' | 'comprension' | 'accesibilidad' | 'retroalimentacion' | 'eficiencia' | 'prevencion_errores' | 'contenido' | 'otro'
  severidad: 'baja' | 'media' | 'alta' | 'critica'
  mejora_sugerida: string
}
export interface RespuestaIA {
  version: '1.0'
  estado: 'borrador'
  hallazgos: HallazgoIA[]
  observaciones_sin_hallazgo: string[]
}
export interface ErrorContrato {
  code: string
  message: string
  details: { field: string; rule: string }[]
}
export type Validacion<T> = { ok: true; data: T } | { ok: false; error: ErrorContrato }

// La revisión de privacidad la autoriza el servidor/persona, nunca el proveedor.
export interface FuenteRevisada {
  resultado_id: string
  plan_id: string
  tarea_id: string
  titulo_tarea: string
  criterio_exito: string | null
  resultado: ResultadoTarea
  observacion_revisada: string
  privacidad_revisada: boolean
  estado_sesion: string
  consentimiento_confirmado: boolean
}

const directory = join(__dirname, '../../contracts/s3-02')
const ajv = new Ajv2020({ strict: true, allErrors: true, ownProperties: true,
  coerceTypes: false, useDefaults: false, removeAdditional: false })
const inputSchema = JSON.parse(readFileSync(join(directory, 'solicitud.schema.json'), 'utf8'))
const outputSchema = JSON.parse(readFileSync(join(directory, 'respuesta.schema.json'), 'utf8'))
const validateInput = ajv.compile<SolicitudIA>(inputSchema)
const validateOutput = ajv.compile<RespuestaIA>(outputSchema)
const inputLimit = 128 * 1024, outputLimit = 256 * 1024
const maxId = 9223372036854775807n
const validId = (value: string) => /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= maxId
const fail = (code: string, message: string, details: ErrorContrato['details'] = []): Validacion<never> =>
  ({ ok: false, error: { code, message, details } })
const schemaDetails = (errors: typeof validateInput.errors) =>
  (errors || []).slice(0, 10).map(error => ({ field: error.instancePath || '/', rule: error.keyword }))

/** Defensa adicional: la revisión humana sigue siendo obligatoria para nombres/direcciones. */
export function redactarDatosDirectos(texto: string): string {
  return texto
    .replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, '[CLAVE_OMITIDA]')
    .replace(/\b[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\b/g, '[TOKEN_OMITIDO]')
    .replace(/https?:\/\/[^\s<>]+|www\.[^\s<>]+/gi, '[ENLACE_OMITIDO]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[CORREO_OMITIDO]')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[IP_OMITIDA]')
    .replace(/\+?\d[\d ().-]{6,}\d/g, '[NUMERO_OMITIDO]')
    .trim()
}

export function validarSolicitud(value: unknown): Validacion<SolicitudIA> {
  let size: number
  try { size = Buffer.byteLength(JSON.stringify(value) ?? '', 'utf8') }
  catch { return fail('IA_SOLICITUD_INVALIDA', 'La solicitud debe ser JSON serializable.') }
  if (size > inputLimit) return fail('IA_LIMITE_EXCEDIDO', 'La solicitud supera 128 KiB.')
  if (!validateInput(value)) return fail('IA_SOLICITUD_INVALIDA', 'La solicitud no cumple el contrato 1.0.', schemaDetails(validateInput.errors))
  if (!validId(value.plan_id) || value.observaciones.some(o => !validId(o.tarea.id) || !validId(o.id.slice(10)))) {
    return fail('IA_ORIGEN_INVALIDO', 'Los identificadores deben ser BIGINT positivos representados como cadenas.')
  }
  const ids = value.observaciones.map(o => o.id)
  if (new Set(ids).size !== ids.length) return fail('IA_ORIGEN_INVALIDO', 'La selección contiene observaciones repetidas.')
  if (value.observaciones.some(o => [o.texto, o.tarea.titulo, o.tarea.criterio_exito]
    .some(text => text !== null && redactarDatosDirectos(text) !== text.trim()))) {
    return fail('IA_DATOS_PERSONALES', 'La solicitud conserva identificadores directos que deben omitirse.')
  }
  return { ok: true, data: value }
}

/** Se aplica tras seleccionar en SQL; evita analizar una selección reducida en silencio. */
export function comprobarSeleccion(ids: readonly string[], filas: readonly { resultado_id: string }[]): Validacion<string[]> {
  if (!Array.isArray(ids) || !ids.length) return fail('IA_SIN_OBSERVACIONES', 'Selecciona al menos una observación.')
  if (ids.length > 50) return fail('IA_LIMITE_EXCEDIDO', 'Cada grupo admite hasta 50 observaciones.')
  if (ids.some(id => typeof id !== 'string' || !validId(id)) || new Set(ids).size !== ids.length) {
    return fail('IA_ORIGEN_INVALIDO', 'La selección debe contener identificadores únicos y válidos.')
  }
  const available = new Set(filas.map(row => row.resultado_id))
  if (filas.length !== ids.length || available.size !== ids.length || ids.some(id => !available.has(id))) {
    return fail('IA_ORIGEN_INVALIDO', 'Hay observaciones inexistentes, ajenas al plan o no elegibles en la selección.')
  }
  return { ok: true, data: [...ids] }
}

/** Construye únicamente los campos permitidos; descarta toda propiedad adicional de la fuente. */
export function prepararSolicitud(planId: string, fuentes: readonly FuenteRevisada[]): Validacion<SolicitudIA> {
  if (!Array.isArray(fuentes) || fuentes.length === 0) return fail('IA_SIN_OBSERVACIONES', 'Selecciona observaciones revisadas antes de solicitar un análisis.')
  if (fuentes.length > 50) return fail('IA_LIMITE_EXCEDIDO', 'Cada grupo admite hasta 50 observaciones.')
  if (fuentes.some(f => !f || f.privacidad_revisada !== true)) {
    return fail('IA_PRIVACIDAD_PENDIENTE', 'Una persona autorizada debe revisar la privacidad de cada observación.')
  }
  if (fuentes.some(f => f.plan_id !== planId || f.estado_sesion !== 'cerrada' || f.consentimiento_confirmado !== true)) {
    return fail('IA_ORIGEN_INVALIDO', 'Todas las fuentes deben pertenecer al plan y a sesiones cerradas con consentimiento.')
  }
  if (fuentes.some(f => typeof f.observacion_revisada !== 'string' || typeof f.titulo_tarea !== 'string' ||
      !(f.criterio_exito === null || typeof f.criterio_exito === 'string') ||
      typeof f.resultado_id !== 'string' || typeof f.tarea_id !== 'string')) {
    return fail('IA_SOLICITUD_INVALIDA', 'Las fuentes revisadas contienen campos inválidos.')
  }
  const observaciones = fuentes.filter(f => f.observacion_revisada.trim()).map(f => ({
    id: `resultado:${f.resultado_id}`, tarea: { id: f.tarea_id,
      titulo: redactarDatosDirectos(f.titulo_tarea),
      criterio_exito: f.criterio_exito === null ? null : redactarDatosDirectos(f.criterio_exito) || null },
    resultado: f.resultado, texto: redactarDatosDirectos(f.observacion_revisada),
  }))
  if (!observaciones.length) return fail('IA_SIN_OBSERVACIONES', 'Las fuentes seleccionadas no contienen observaciones útiles.')
  return validarSolicitud({ version: '1.0', plan_id: planId, observaciones })
}

/** Valida JSON, esquema y trazabilidad antes de que el llamador guarde un borrador. */
export function validarRespuesta(raw: unknown, solicitud: SolicitudIA): Validacion<RespuestaIA> {
  const input = validarSolicitud(solicitud)
  if (!input.ok) return input
  let value: unknown
  try {
    const serialized = typeof raw === 'string' ? raw : JSON.stringify(raw)
    if (typeof serialized !== 'string') return fail('IA_JSON_INVALIDO', 'La respuesta debe contener un objeto JSON.')
    if (Buffer.byteLength(serialized, 'utf8') > outputLimit) return fail('IA_LIMITE_EXCEDIDO', 'La respuesta supera 256 KiB.')
    value = JSON.parse(serialized)
  } catch { return fail('IA_JSON_INVALIDO', 'La respuesta del proveedor no es JSON válido.') }
  if (!validateOutput(value)) return fail('IA_ESQUEMA_INVALIDO', 'La respuesta no cumple el esquema de borrador.', schemaDetails(validateOutput.errors))
  if (value.hallazgos.some(h => [h.resumen, h.mejora_sugerida]
    .some(text => redactarDatosDirectos(text) !== text.trim()))) {
    return fail('IA_DATOS_PERSONALES', 'La respuesta contiene identificadores directos que no se pueden incorporar al borrador.')
  }
  const ids = new Set(input.data.observaciones.map(o => o.id))
  const used = new Set(value.hallazgos.flatMap(h => h.observacion_ids))
  const without = new Set(value.observaciones_sin_hallazgo)
  if ([...used, ...without].some(id => !ids.has(id))) return fail('IA_ORIGEN_INVALIDO', 'La respuesta cita una observación ajena a esta selección.')
  if ([...without].some(id => used.has(id))) return fail('IA_COBERTURA_INVALIDA', 'Una observación no puede figurar a la vez con y sin hallazgo.')
  if ([...ids].some(id => !used.has(id) && !without.has(id))) return fail('IA_COBERTURA_INCOMPLETA', 'La respuesta omite observaciones seleccionadas.')
  const fingerprints = value.hallazgos.map(h => JSON.stringify([
    [...h.observacion_ids].sort(), h.resumen.trim(), h.categoria, h.severidad, h.mejora_sugerida.trim(),
  ]))
  if (new Set(fingerprints).size !== fingerprints.length) return fail('IA_HALLAZGO_DUPLICADO', 'La respuesta contiene un hallazgo repetido.')
  return { ok: true, data: value }
}

export function crearMensajes(solicitud: SolicitudIA): Validacion<{ role: 'system' | 'user'; content: string }[]> {
  const result = validarSolicitud(solicitud)
  if (!result.ok) return result
  return { ok: true, data: [
    { role: 'system', content: readFileSync(join(directory, 'instruccion.md'), 'utf8') },
    { role: 'user', content: JSON.stringify(result.data) },
  ] }
}
