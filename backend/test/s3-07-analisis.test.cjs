require('reflect-metadata')
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const { parseCreacion, parseRevision, cuerpoVacio } = require('../dist/analisis-ia/analisis.dto')
const { estadoDeGrupos } = require('../dist/analisis-ia/analisis.types')
const { AnalisisService } = require('../dist/analisis-ia/analisis.service')
const { ProveedorIA } = require('../dist/analisis-ia/proveedor')
const { normalizeError } = require('../dist/api-error.filter')
const solicitud = () => ({ version: '1.0', plan_id: '101', observaciones: [
  { id: 'resultado:9007199254740993', tarea: { id: '1001', titulo: 'Guardar', criterio_exito: null },
    resultado: 'con_ayuda', texto: 'No se reconoció la confirmación.' },
] })
const respuesta = () => ({ version: '1.0', estado: 'borrador', hallazgos: [{
  observacion_ids: ['resultado:9007199254740993'], resumen: 'La confirmación no fue reconocida.',
  categoria: 'retroalimentacion', severidad: 'media', mejora_sugerida: 'Mostrar un mensaje visible.',
}], observaciones_sin_hallazgo: [] })
const meta = { estado: 'completado', modo: 'gemini', proveedor: 'gemini', modelo: 'gemini-test', intentos: 1 }

test('S3-07 DTO: selección estricta, BIGINT exactos y grupos de hasta 50', () => {
  const solicitud_id = randomUUID()
  assert.deepEqual(parseCreacion({ solicitud_id, resultado_ids: ['9007199254740993', '1'] }),
    { solicitud_id, resultado_ids: ['1', '9007199254740993'] })
  assert.equal(parseCreacion({ solicitud_id, resultado_ids: Array.from({ length: 100 }, (_, i) => String(i + 1)) }).resultado_ids.length, 100)
  for (const resultado_ids of [[], ['1', '1'], ['01'], [1], ['0'], ['9223372036854775808'], [null], {},
    Array.from({ length: 101 }, (_, i) => String(i + 1))]) {
    assert.throws(() => parseCreacion({ solicitud_id, resultado_ids }))
  }
  for (const value of [null, [], {}, { solicitud_id: 'no', resultado_ids: ['1'] },
    { solicitud_id, resultado_ids: ['1'], plan_id: '202' },
    { solicitud_id, resultado_ids: ['1'], privacidad_revisada: true }]) assert.throws(() => parseCreacion(value))
})

test('S3-07 DTO: revisión explícita solo admite textos y nunca identidades/relaciones', () => {
  const review = { resultado_id: '1', texto: 'Observación', titulo_tarea: 'Guardar', criterio_exito: null }
  assert.equal(parseRevision({ observaciones: [review] }).get('1').texto, 'Observación')
  for (const observaciones of [[], [review, review], [{ ...review, texto: ' ' }], [{ ...review, texto: 'x'.repeat(2001) }],
    [{ ...review, tarea_id: '2001' }], [{ ...review, resultado: 'sin_ayuda' }], [{ ...review, privacidad_revisada: true }]]) {
    assert.throws(() => parseRevision({ observaciones }))
  }
  assert.throws(() => parseRevision({ observaciones: [review], aprobado: true }))
  assert.doesNotThrow(() => cuerpoVacio({}))
  assert.doesNotThrow(() => cuerpoVacio(undefined))
  for (const value of [[], { texto: 'Inventado' }, { privacidad_revisada: true }, { modo: 'demo' }]) assert.throws(() => cuerpoVacio(value))
})

test('S3-07 estados: pendiente, en curso, completado, parcialmente fallido y fallido', () => {
  for (const [states, expected] of [
    [['pendiente', 'pendiente'], 'pendiente'], [['procesando', 'completado'], 'procesando'],
    [['completado', 'completado'], 'completado'], [['fallido', 'completado'], 'parcial'],
    [['fallido', 'fallido'], 'fallido'],
  ]) assert.equal(estadoDeGrupos(states.map(estado => ({ estado }))), expected)
})

test('S3-07 transporte: JSON excesivo conserva 413 sin reproducir el cuerpo privado', () => {
  assert.deepEqual(normalizeError({ type: 'entity.too.large', status: 413, message: 'contenido-confidencial', body: 'contenido-confidencial' }), {
    status: 413, body: { code: 'PAYLOAD_TOO_LARGE', message: 'El cuerpo JSON supera el límite permitido.', details: [] },
  })
  assert.equal(normalizeError({ type: 'otro', status: 413, message: 'privado' }).status, 500)
})

test('S3-07 servicio: valida atómicamente respuestas, conserva origen y solo acepta borradores', async t => {
  for (const [name, modify, error] of [
    ['válida', () => {}, null], ['aprobación automática', r => { r.estado = 'aprobado' }, 'IA_ESQUEMA_INVALIDO'],
    ['severidad', r => { r.hallazgos[0].severidad = 'urgente' }, 'IA_ESQUEMA_INVALIDO'],
    ['categoría', r => { r.hallazgos[0].categoria = 'inventada' }, 'IA_ESQUEMA_INVALIDO'],
    ['origen ajeno', r => { r.hallazgos[0].observacion_ids = ['resultado:2'] }, 'IA_ORIGEN_INVALIDO'],
    ['incompleta', r => { r.hallazgos = [] }, 'IA_COBERTURA_INCOMPLETA'],
    ['PII', r => { r.hallazgos[0].resumen = 'Contactar persona@example.com' }, 'IA_DATOS_PERSONALES'],
  ]) await t.test(name, async () => {
    const data = respuesta(); modify(data)
    const group = { id: '1', estado: 'procesando', intentos: 1, solicitud: solicitud() }
    const service = new AnalisisService({}, { analizar: async () => ({ ok: true, data, meta }) })
    await service.analizarGrupo(group)
    assert.equal(group.estado, error ? 'fallido' : 'completado')
    if (error) { assert.equal(group.error.code, error); assert.equal(group.respuesta, undefined) }
    else { assert.deepEqual(group.respuesta, respuesta()); assert.equal(group.respuesta.estado, 'borrador') }
  })
})

test('S3-07 proveedor S3-03: JSON inválido, timeout, red y configuración sin filtrar secretos', async t => {
  for (const [name, env, transport, code] of [
    ['JSON inválido', { IA_MODE: 'gemini', GEMINI_API_KEY: 'clave-ficticia', IA_MAX_RETRIES: '0' },
      async () => new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{' }] } }] })), 'IA_JSON_INVALIDO'],
    ['timeout', { IA_MODE: 'gemini', GEMINI_API_KEY: 'clave-ficticia', IA_TIMEOUT_MS: '10' }, () => new Promise(() => {}), 'IA_TIEMPO_AGOTADO'],
    ['red', { IA_MODE: 'gemini', GEMINI_API_KEY: 'clave-ficticia' }, async () => { throw Error('secreto-no-exponer') }, 'IA_ERROR_CONEXION'],
    ['configuración', { IA_MODE: 'gemini' }, async () => { throw Error('No debe enviar') }, 'IA_CONFIGURACION_INVALIDA'],
    ['disabled', {}, async () => { throw Error('No debe enviar') }, 'IA_DESHABILITADA'],
    ['no disponible', { IA_MODE: 'gemini', GEMINI_API_KEY: 'clave-ficticia', IA_MAX_RETRIES: '0' },
      async () => new Response('secreto-no-exponer', { status: 503 }), 'IA_PROVEEDOR_NO_DISPONIBLE'],
  ]) await t.test(name, async () => {
    const group = { id: '1', estado: 'procesando', intentos: 1, solicitud: solicitud() }
    const service = new AnalisisService({}, new ProveedorIA(env, transport))
    await service.analizarGrupo(group)
    assert.equal(group.error.code, code)
    assert.equal(group.respuesta, undefined)
    assert.ok(!JSON.stringify(group).includes('secreto-no-exponer'))
    assert.ok(!JSON.stringify(group).includes('clave-ficticia'))
  })
})

test('S3-07 servicio: excepciones inesperadas no reproducen trazas ni mensajes internos', async () => {
  const group = { id: '1', estado: 'procesando', intentos: 1, solicitud: solicitud() }
  const service = new AnalisisService({}, { analizar: async () => { throw Error('postgres://usuario:secreto@host') } })
  await service.analizarGrupo(group)
  assert.equal(group.error.code, 'IA_ERROR_PROVEEDOR')
  assert.ok(!JSON.stringify(group).includes('postgres://'))
})
