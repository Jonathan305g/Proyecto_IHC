const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { ProveedorIA, configurarIA, esquemaProveedor } = require('../dist/analisis-ia/proveedor')
const root = path.join(__dirname, '../contracts/s3-02/ejemplos')
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'))
const input = () => read('solicitud_valida.json')
const valid = () => read('respuesta_correcta.json')
const env = extra => ({ IA_MODE: 'gemini', GEMINI_API_KEY: 'clave-exclusiva-de-prueba', IA_MODEL: 'gemini-prueba', ...extra })
const http = (body, status = 200, headers = {}) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers })
const envelope = data => ({ candidates: [{ finishReason: 'STOP', content: { role: 'model', parts: [{ text: JSON.stringify(data) }] } }] })

test('S3-03: disabled por defecto y demo explicita no realizan solicitudes', async () => {
  const network = async () => { throw new Error('No debe llamar') }
  const disabled = await new ProveedorIA({}, network).analizar(input())
  assert.equal(disabled.error.code, 'IA_DESHABILITADA')
  const demo = await new ProveedorIA({ IA_MODE: 'demo' }, network).analizar(input())
  assert.equal(demo.ok, true)
  assert.equal(demo.meta.modo, 'demo')
  assert.equal(demo.meta.intentos, 0)
  assert.match(demo.meta.advertencia, /no analiza/)
  assert.equal(demo.data.estado, 'borrador')
  assert.deepEqual(demo.data.observaciones_sin_hallazgo, input().observaciones.map(o => o.id))
})

test('S3-03: configuracion invalida no llama ni expone valores privados', async () => {
  for (const extra of [{ GEMINI_API_KEY: '' }, { IA_MODEL: '' }, { IA_MODE: 'otro' },
    { IA_MAX_RETRIES: '3' }, { IA_TIMEOUT_MS: 'NaN' }, { IA_MAX_OUTPUT_TOKENS: '0' }]) {
    const result = await new ProveedorIA(env(extra), () => { assert.fail('No debe llamar') }).analizar(input())
    assert.equal(result.error.code, 'IA_CONFIGURACION_INVALIDA')
    assert.equal(JSON.stringify(result).includes('clave-exclusiva'), false)
  }
  assert.equal(configurarIA({}).modo, 'disabled')
})

test('S3-03: solicitud invalida y PII se rechazan antes de transmitir', async () => {
  for (const patch of [{ observaciones: [] }, { plan_id: 1 }]) {
    const result = await new ProveedorIA(env(), () => assert.fail('No transmitir')).analizar({ ...input(), ...patch })
    assert.equal(result.ok, false)
    assert.equal(result.meta.intentos, 0)
  }
  const req = input(); req.observaciones[0].texto = 'Correo persona@example.org'
  assert.equal((await new ProveedorIA(env(), () => assert.fail('No transmitir')).analizar(req)).error.code, 'IA_DATOS_PERSONALES')
})

test('S3-03: transporte generateContent, schema, token limite y salida S3-02', async () => {
  const req = input()
  const result = await new ProveedorIA(env(), async (url, options) => {
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-prueba:generateContent')
    assert.equal(options.method, 'POST')
    assert.equal(options.redirect, 'error')
    assert.equal(options.headers['x-goog-api-key'], 'clave-exclusiva-de-prueba')
    const body = JSON.parse(options.body)
    assert.equal(body.generationConfig.maxOutputTokens, 4096)
    assert.equal(body.generationConfig.responseMimeType, 'application/json')
    assert.deepEqual(body.generationConfig.responseJsonSchema, esquemaProveedor())
    assert.deepEqual(body.generationConfig.responseJsonSchema.properties.estado, { enum: ['borrador'], type: 'string' })
    assert.equal(body.generationConfig.responseJsonSchema.properties.hallazgos.items.properties.categoria.type, 'string')
    assert.match(body.systemInstruction.parts[0].text, /datos no confiables/)
    assert.equal(body.contents[0].role, 'user')
    assert.deepEqual(JSON.parse(body.contents[0].parts[0].text), req)
    return http(envelope(valid()))
  }).analizar(req)
  assert.equal(result.ok, true)
  assert.deepEqual(result.data, valid())
  assert.equal(result.meta.intentos, 1)
  assert.equal(result.meta.estado, 'completado')
  assert.equal('clave' in result.meta, false)
})

test('S3-03: validacion final conserva restricciones y origen del contrato', async () => {
  for (const [file, code] of [['origen_inexistente.json','IA_ORIGEN_INVALIDO'], ['respuesta_incompleta.json','IA_ESQUEMA_INVALIDO'],
    ['aprobacion_automatica.json','IA_ESQUEMA_INVALIDO'], ['datos_personales_en_salida.json','IA_DATOS_PERSONALES'],
    ['origen_repetido.json','IA_ESQUEMA_INVALIDO']]) {
    let calls = 0
    const result = await new ProveedorIA(env(), async () => { calls++; return http(envelope(read(file))) }).analizar(input())
    assert.equal(result.error.code, code, file)
    assert.equal(calls, 1, 'Salida invalida no se repara ni reintenta')
  }
})

test('S3-03: HTTP 429 temporal espera y reintenta de forma acotada', async () => {
  let calls = 0
  const result = await new ProveedorIA(env(), async () => ++calls === 1
    ? http({ error: { status: 'RESOURCE_EXHAUSTED' } }, 429, { 'retry-after': '0' }) : http(envelope(valid()))).analizar(input())
  assert.equal(result.ok, true)
  assert.equal(calls, 2)
})

test('S3-03: indisponibilidad no JSON se reintenta hasta el limite', async () => {
  let calls = 0
  const result = await new ProveedorIA(env(), async () => { calls++; return http('Servicio caido', 503) }).analizar(input())
  assert.equal(result.error.code, 'IA_PROVEEDOR_NO_DISPONIBLE')
  assert.equal(calls, 2)
})

test('S3-03: Retry-After mayor que presupuesto no provoca otro envio', async () => {
  let calls = 0
  const result = await new ProveedorIA(env(), async () => { calls++; return http({}, 429, { 'retry-after': '600' }) }).analizar(input())
  assert.equal(result.error.code, 'IA_LIMITE_PROVEEDOR')
  assert.equal(calls, 1)
})

test('S3-03: acceso, cuota, HTTP 400 y red no tienen fallback ni reintento automatico', async () => {
  for (const [status, body, code] of [[401, {}, 'IA_ACCESO_PROVEEDOR'], [403, {}, 'IA_ACCESO_PROVEEDOR'],
    [429, { error: { details: [{ '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId: 'RequestsPerDay' }] }] } }, 'IA_CUOTA_AGOTADA'], [400, {}, 'IA_CONFIGURACION_PROVEEDOR']]) {
    let calls = 0
    const result = await new ProveedorIA(env(), async () => { calls++; return http(body, status) }).analizar(input())
    assert.equal(result.error.code, code)
    assert.equal(result.meta.modo, 'gemini')
    assert.equal(calls, 1)
  }
  const result = await new ProveedorIA(env(), async () => { throw new Error('clave-exclusiva-de-prueba') }).analizar(input())
  assert.equal(result.error.code, 'IA_ERROR_CONEXION')
  assert.equal(JSON.stringify(result).includes('clave-exclusiva'), false)
})

test('S3-03: timeout cancela y limita tambien la lectura del cuerpo', async () => {
  let signal
  const result = await new ProveedorIA(env({ IA_TIMEOUT_MS: '20' }), async (_, options) => {
    signal = options.signal
    return new Response(new ReadableStream({ start() {} }))
  }).analizar(input())
  assert.equal(result.error.code, 'IA_TIEMPO_AGOTADO')
  assert.equal(signal.aborted, true)
  assert.equal(result.meta.intentos, 1)
})

test('S3-03: rechazo, truncamiento, JSON y envolturas invalidas se controlan', async () => {
  for (const [response, code] of [
    [{ promptFeedback: { blockReason: 'SAFETY' } }, 'IA_RECHAZADA'],
    [{ candidates: [{ finishReason: 'SAFETY' }] }, 'IA_RECHAZADA'],
    [{ candidates: [{ finishReason: 'MAX_TOKENS' }] }, 'IA_RESPUESTA_INCOMPLETA'],
    [{ candidates: [{ finishReason: 'OTHER' }] }, 'IA_RESPUESTA_INVALIDA'],
    [{ candidates: [] }, 'IA_RESPUESTA_INVALIDA'],
    ['invalid JSON', 'IA_RESPUESTA_INVALIDA'],
  ]) {
    const result = await new ProveedorIA(env(), async () => http(response)).analizar(input())
    assert.equal(result.error.code, code)
  }
})

test('S3-03: limita cuerpo remoto y JSON malformado interno', async () => {
  const huge = await new ProveedorIA(env(), async () => http('x'.repeat(512 * 1024 + 1))).analizar(input())
  assert.equal(huge.error.code, 'IA_LIMITE_EXCEDIDO')
  const bad = { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '```json\n{}\n```' }] } }] }
  const result = await new ProveedorIA(env(), async () => http(bad)).analizar(input())
  assert.equal(result.error.code, 'IA_JSON_INVALIDO')
})

test('S3-03: copia los origenes antes de esperar la red', async () => {
  const req = input()
  const result = await new ProveedorIA(env(), async () => {
    req.observaciones[0].id = 'resultado:999'
    return http(envelope(valid()))
  }).analizar(req)
  assert.equal(result.ok, true)
})

test('S3-03: texto final multipart excluye pensamientos del modelo', async () => {
  const text = JSON.stringify(valid())
  const response = { candidates: [{ finishReason: 'STOP', content: { parts: [
    { thought: true, text: 'No debe exponerse' }, { text: text.slice(0, 30) }, { text: text.slice(30) },
  ] } }] }
  const result = await new ProveedorIA(env(), async () => http(response)).analizar(input())
  assert.equal(result.ok, true)
  assert.deepEqual(result.data, valid())
  assert.equal(JSON.stringify(result).includes('No debe exponerse'), false)
})

test('S3-03: no admite llamadas a herramientas, candidatos multiples ni respuesta vacia', async () => {
  for (const response of [
    { candidates: [{ finishReason: 'STOP', content: { parts: [{ functionCall: { name: 'aprobar' } }] } }] },
    { candidates: [...envelope(valid()).candidates, ...envelope(valid()).candidates] },
    { candidates: [{ finishReason: 'STOP', content: { parts: [] } }] },
  ]) {
    const result = await new ProveedorIA(env(), async () => http(response)).analizar(input())
    assert.equal(result.ok, false)
    assert.equal(result.meta.estado, 'fallido')
  }
})

test('S3-03: RetryInfo de Google y cuota cero detienen envios cuando no procede repetir', async () => {
  for (const [details, code] of [
    [[{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '600s' }], 'IA_LIMITE_PROVEEDOR'],
    [[{ '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaValue: '0' }] }], 'IA_CUOTA_AGOTADA'],
  ]) {
    let calls = 0
    const result = await new ProveedorIA(env(), async () => { calls++; return http({ error: { details } }, 429) }).analizar(input())
    assert.equal(result.error.code, code)
    assert.equal(calls, 1)
  }
})

test('S3-03: maximo configurado de reintentos y presupuesto total', async () => {
  let calls = 0
  const result = await new ProveedorIA(env({ IA_MAX_RETRIES: '2' }), async () => {
    calls++; return http({}, 503)
  }).analizar(input())
  assert.equal(calls, 3)
  assert.equal(result.meta.intentos, 3)
  calls = 0
  const budget = await new ProveedorIA(env({ IA_TOTAL_TIMEOUT_MS: '50' }), async () => {
    calls++; return http({}, 503)
  }).analizar(input())
  assert.equal(calls, 1)
  assert.equal(budget.ok, false)
})

test('S3-03: agotamiento global aborta una llamada mas lenta que el presupuesto', async () => {
  const start = Date.now()
  const result = await new ProveedorIA(env({ IA_TOTAL_TIMEOUT_MS: '30', IA_TIMEOUT_MS: '1000' }), async () =>
    new Promise(() => {})).analizar(input())
  assert.equal(result.error.code, 'IA_TIEMPO_AGOTADO')
  assert.equal(result.meta.intentos, 1)
  assert.ok(Date.now() - start < 500)
})

test('S3-03: configuracion de modelo impide rutas y clave nunca viaja en URL ni esquema', async () => {
  for (const model of ['../gemini', 'gemini-test?key=x', 'https://otro', 'gemini-test/path']) {
    const result = await new ProveedorIA(env({ IA_MODEL: model }), () => assert.fail('No enviar')).analizar(input())
    assert.equal(result.error.code, 'IA_CONFIGURACION_INVALIDA')
  }
  await new ProveedorIA(env(), async (url, opts) => {
    assert.equal(url.includes('clave-exclusiva'), false)
    assert.equal(opts.body.includes('clave-exclusiva'), false)
    return http(envelope(valid()))
  }).analizar(input())
})

test('S3-03: modulo Nest exporta el adaptador sin exigir credenciales al arrancar', async () => {
  require('reflect-metadata')
  const { NestFactory } = require('@nestjs/core')
  const { ProveedorIaModule } = require('../dist/analisis-ia/proveedor.module')
  const app = await NestFactory.createApplicationContext(ProveedorIaModule, { logger: false })
  try { assert.ok(app.get(ProveedorIA) instanceof ProveedorIA) } finally { await app.close() }
})

test('S3-03: transporte HTTP real local comprueba cuerpo y estado del adaptador', async () => {
  const { createServer } = require('node:http')
  const server = createServer(async (req, res) => {
    let body = ''
    for await (const chunk of req) body += chunk
    assert.equal(req.method, 'POST')
    assert.equal(req.headers['x-goog-api-key'], 'clave-exclusiva-de-prueba')
    const parsed = JSON.parse(body)
    assert.deepEqual(JSON.parse(parsed.contents[0].parts[0].text), input())
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(envelope(valid())))
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    const result = await new ProveedorIA(env(), (url, opts) => {
      assert.match(url, /^https:\/\/generativelanguage.googleapis.com\//)
      return fetch(`http://127.0.0.1:${server.address().port}`, opts)
    }).analizar(input())
    assert.equal(result.ok, true)
    assert.equal(result.meta.estado, 'completado')
    assert.equal(result.meta.proveedor, 'gemini')
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
})
