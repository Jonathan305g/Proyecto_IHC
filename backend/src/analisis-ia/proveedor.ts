import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { crearMensajes, ErrorContrato, RespuestaIA, SolicitudIA, validarRespuesta } from './contrato'

export interface ConfiguracionIA {
  modo: 'disabled' | 'demo' | 'gemini'
  clave: string
  modelo: string
  timeoutMs: number
  presupuestoMs: number
  reintentos: number
  maxTokens: number
}
export interface MetaIA {
  estado: 'completado' | 'fallido'
  modo: ConfiguracionIA['modo']
  proveedor: 'gemini' | 'demo' | null
  modelo: string | null
  intentos: number
  advertencia?: string
}
export type ResultadoProveedor = { ok: true; data: RespuestaIA; meta: MetaIA }
  | { ok: false; error: ErrorContrato; meta: MetaIA }

/** Configuracion exclusivamente del servidor. Un error nunca imprime valores privados. */
export function configurarIA(env: NodeJS.ProcessEnv = process.env): ConfiguracionIA {
  const modo = env.IA_MODE || 'disabled'
  if (!['disabled', 'demo', 'gemini'].includes(modo)) throw new Error('IA_CONFIGURACION_INVALIDA')
  function numero(nombre: string, defecto: number, min: number, max: number) {
    const texto = env[nombre]
    if (texto !== undefined && !/^\d+$/.test(texto)) throw new Error('IA_CONFIGURACION_INVALIDA')
    const n = texto === undefined ? defecto : Number(texto)
    if (!Number.isSafeInteger(n) || n < min || n > max) throw new Error('IA_CONFIGURACION_INVALIDA')
    return n
  }
  const clave = (env.GEMINI_API_KEY || '').trim(), modelo = (env.IA_MODEL ?? 'gemini-3.5-flash-lite').trim()
  if (modo === 'gemini' && (!clave || !modelo || /REEMPLAZAR|TU_CLAVE/i.test(clave)
    || !/^gemini-[a-z0-9.-]{1,100}$/.test(modelo))) throw new Error('IA_CONFIGURACION_INVALIDA')
  return { modo: modo as ConfiguracionIA['modo'], clave, modelo,
    timeoutMs: numero('IA_TIMEOUT_MS', 15000, 10, 60000),
    presupuestoMs: numero('IA_TOTAL_TIMEOUT_MS', 30000, 10, 120000),
    reintentos: numero('IA_MAX_RETRIES', 1, 0, 2),
    maxTokens: numero('IA_MAX_OUTPUT_TOKENS', 4096, 128, 8192) }
}

// El proveedor recibe la estructura estricta; Ajv conserva TODAS las restricciones
// del contrato canonico, incluso las no soportadas por Structured Outputs.
export function esquemaProveedor(): unknown {
  const schema = JSON.parse(readFileSync(join(__dirname, '../../contracts/s3-02/respuesta.schema.json'), 'utf8'))
  function proyectar(value: any): any {
    if (Array.isArray(value)) return value.map(proyectar)
    if (!value || typeof value !== 'object') return value
    const result: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) {
      if (['$schema', '$id', 'title', 'minLength', 'maxLength', 'pattern', 'uniqueItems'].includes(key)) continue
      if (key === 'const') result.enum = [item]
      else result[key] = proyectar(item)
    }
    if (Array.isArray(result.enum) && result.enum.every(v => typeof v === 'string')) result.type = 'string'
    return result
  }
  return proyectar(schema)
}

const mensajesError: Record<string, string> = {
  IA_DESHABILITADA: 'El analisis con IA esta deshabilitado.',
  IA_CONFIGURACION_INVALIDA: 'Falta configurar Gemini en el servidor o sus limites son invalidos.',
  IA_CONFIGURACION_PROVEEDOR: 'Gemini no acepta el modelo o la configuracion solicitada.',
  IA_ACCESO_PROVEEDOR: 'No se pudo autenticar el servidor con Gemini.',
  IA_CUOTA_AGOTADA: 'El proyecto no dispone de cuota; revisa su limite antes de reintentar.',
  IA_LIMITE_PROVEEDOR: 'Gemini alcanzo su limite temporal. Intenta nuevamente mas tarde.',
  IA_PROVEEDOR_NO_DISPONIBLE: 'Gemini no esta disponible en este momento.',
  IA_ERROR_CONEXION: 'No se pudo completar la conexion con Gemini.',
  IA_TIEMPO_AGOTADO: 'Gemini excedio el tiempo de espera del analisis.',
  IA_RECHAZADA: 'Gemini bloqueo la solicitud o su respuesta.',
  IA_RESPUESTA_INCOMPLETA: 'Gemini devolvio una respuesta incompleta; reduce el grupo de observaciones.',
  IA_RESPUESTA_INVALIDA: 'Gemini devolvio una respuesta que no se pudo interpretar.',
  IA_LIMITE_EXCEDIDO: 'La respuesta supera el limite de tamano permitido.',
}

const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models'
const limiteTransporte = 512 * 1024
class Fallo extends Error {
  constructor(public codigo: string, public reintentar = false, public esperaMs = 0) { super(codigo) }
}

async function leerLimitado(response: Response): Promise<string> {
  if (!response.body) throw new Fallo('IA_RESPUESTA_INVALIDA')
  const reader = response.body.getReader()
  const partes: Uint8Array[] = []
  let bytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > limiteTransporte) throw new Fallo('IA_LIMITE_EXCEDIDO')
      partes.push(value)
    }
    return Buffer.concat(partes).toString('utf8')
  } finally { await reader.cancel().catch(() => undefined) }
}

function extraerRespuesta(envelope: any): string {
  if (envelope?.promptFeedback?.blockReason) throw new Fallo('IA_RECHAZADA')
  if (!Array.isArray(envelope?.candidates) || envelope.candidates.length !== 1) throw new Fallo('IA_RESPUESTA_INVALIDA')
  const candidate = envelope.candidates[0]
  if (candidate?.finishReason === 'MAX_TOKENS') throw new Fallo('IA_RESPUESTA_INCOMPLETA')
  if (['SAFETY', 'RECITATION', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII'].includes(candidate?.finishReason)) throw new Fallo('IA_RECHAZADA')
  if (candidate?.finishReason !== 'STOP' || !Array.isArray(candidate.content?.parts)) throw new Fallo('IA_RESPUESTA_INVALIDA')
  // No exponer razonamiento ni concatenar llamadas a herramientas con el JSON final.
  const partes = candidate.content.parts.filter((p: any) => p?.thought !== true)
  if (!partes.length || partes.some((p: any) => typeof p?.text !== 'string' || p.functionCall || p.inlineData)) throw new Fallo('IA_RESPUESTA_INVALIDA')
  return partes.map((p: any) => p.text).join('')
}

function esperaProveedor(response: Response, envelope: any, intento: number): number {
  const retry = response.headers.get('retry-after')
  let espera: number | undefined
  if (retry !== null) espera = /^\d+(\.\d+)?$/.test(retry) ? Number(retry) * 1000 : Date.parse(retry) - Date.now()
  if (!Number.isFinite(espera)) {
    const info = Array.isArray(envelope?.error?.details) ? envelope.error.details.find((d: any) =>
      d?.['@type'] === 'type.googleapis.com/google.rpc.RetryInfo') : undefined
    if (typeof info?.retryDelay === 'string' && /^\d+(\.\d+)?s$/.test(info.retryDelay)) espera = parseFloat(info.retryDelay) * 1000
  }
  // Jitter evita que varios procesos repitan al mismo instante.
  return Math.max(500 * 2 ** intento, Number.isFinite(espera) ? espera! : 0) + Math.floor(Math.random() * 100)
}

function cuotaAgotada(envelope: any): boolean {
  return Array.isArray(envelope?.error?.details) && envelope.error.details.some((d: any) =>
    d?.['@type'] === 'type.googleapis.com/google.rpc.QuotaFailure' && Array.isArray(d.violations) &&
    d.violations.some((v: any) => String(v.quotaValue) === '0' || /perday|daily/i.test(v.quotaId || v.quotaMetric || '')))
}

/** Llamar solo con la solicitud preparada y autorizada por S3-07. No persiste ni aprueba. */
export class ProveedorIA {
  constructor(private readonly env: NodeJS.ProcessEnv = process.env,
    private readonly transporte: typeof fetch = fetch) {}

  async analizar(solicitud: SolicitudIA): Promise<ResultadoProveedor> {
    let meta: MetaIA = { estado: 'fallido', modo: 'disabled', proveedor: null, modelo: null, intentos: 0 }
    const error = (code: string, details: ErrorContrato['details'] = []): ResultadoProveedor => ({
      ok: false, error: { code, message: mensajesError[code] || 'La respuesta no cumple el contrato de analisis; revisa la seleccion y vuelve a intentarlo.', details }, meta,
    })
    let config: ConfiguracionIA
    try { config = configurarIA(this.env) } catch { return error('IA_CONFIGURACION_INVALIDA') }
    meta = { estado: 'fallido', modo: config.modo, proveedor: config.modo === 'disabled' ? null : config.modo,
      modelo: config.modo === 'gemini' ? config.modelo : null, intentos: 0 }
    // La copia evita que el llamador cambie los origenes durante una llamada asincrona.
    let snapshot: SolicitudIA
    try { snapshot = structuredClone(solicitud) } catch { return error('IA_SOLICITUD_INVALIDA') }
    const mensajes = crearMensajes(snapshot)
    if (!mensajes.ok) return { ...mensajes, meta }
    if (config.modo === 'disabled') return error('IA_DESHABILITADA')
    if (config.modo === 'demo') {
      meta.advertencia = 'Demostracion de contrato sin proveedor: no analiza ni descarta problemas. No usar para aprobar hallazgos.'
      const demo = validarRespuesta({ version: '1.0', estado: 'borrador', hallazgos: [],
        observaciones_sin_hallazgo: snapshot.observaciones.map(o => o.id) }, snapshot)
      meta.estado = demo.ok ? 'completado' : 'fallido'
      return { ...demo, meta }
    }
    const cuerpo = JSON.stringify({
      systemInstruction: { parts: [{ text: mensajes.data[0].content }] },
      contents: [{ role: 'user', parts: [{ text: mensajes.data[1].content }] }],
      generationConfig: { responseMimeType: 'application/json', responseJsonSchema: esquemaProveedor(), maxOutputTokens: config.maxTokens },
    })
    const fin = Date.now() + config.presupuestoMs
    for (let intento = 0; intento <= config.reintentos; intento++) {
      if (Date.now() >= fin) return error('IA_TIEMPO_AGOTADO')
      meta.intentos++
      const controller = new AbortController()
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        // Incluye cabeceras y lectura del cuerpo. El presupuesto total tambien limita las esperas.
        const trabajo = async () => {
          const response = await this.transporte(`${endpoint}/${config.modelo}:generateContent`, { method: 'POST', redirect: 'error', signal: controller.signal,
            headers: { 'x-goog-api-key': config.clave, 'Content-Type': 'application/json' }, body: cuerpo })
          if (response.status === 401 || response.status === 403) {
            await response.body?.cancel().catch(() => undefined)
            throw new Fallo('IA_ACCESO_PROVEEDOR')
          }
          let envelope: any
          try { envelope = JSON.parse(response.body ? await leerLimitado(response) : '') }
          catch (e) {
            if (e instanceof Fallo) throw e
            if (response.ok) throw new Fallo('IA_RESPUESTA_INVALIDA')
          }
          if (!response.ok) {
            if (response.status === 429 && cuotaAgotada(envelope)) throw new Fallo('IA_CUOTA_AGOTADA')
            if (response.status === 402) throw new Fallo('IA_CUOTA_AGOTADA')
            if ([400, 404, 422].includes(response.status)) throw new Fallo('IA_CONFIGURACION_PROVEEDOR')
            const temporal = [429, 500, 502, 503, 504].includes(response.status)
            throw new Fallo(response.status === 429 ? 'IA_LIMITE_PROVEEDOR' : 'IA_PROVEEDOR_NO_DISPONIBLE', temporal,
              esperaProveedor(response, envelope, intento))
          }
          return extraerRespuesta(envelope)
        }
        const raw = await Promise.race([trabajo(), new Promise<never>((_, reject) => {
          timer = setTimeout(() => { reject(new Fallo('IA_TIEMPO_AGOTADO')); controller.abort() },
            Math.min(config.timeoutMs, Math.max(1, fin - Date.now())))
        })])
        const validada = validarRespuesta(raw, snapshot)
        meta.estado = validada.ok ? 'completado' : 'fallido'
        return { ...validada, meta }
      } catch (e) {
        const fallo = e instanceof Fallo ? e : new Fallo('IA_ERROR_CONEXION')
        // Sin reintento automatico tras timeout/red: el proveedor pudo haber procesado la solicitud.
        if (!fallo.reintentar || intento === config.reintentos) return error(fallo.codigo)
        if (Date.now() + fallo.esperaMs >= fin) return error(fallo.codigo)
        if (timer) clearTimeout(timer)
        await new Promise(resolve => setTimeout(resolve, fallo.esperaMs))
      } finally { if (timer) clearTimeout(timer) }
    }
    return error('IA_PROVEEDOR_NO_DISPONIBLE')
  }
}
