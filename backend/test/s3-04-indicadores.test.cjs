const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { IndicatorsService } = require('../dist/indicators.service')
const { parseIndicatorFilters } = require('../dist/dto/indicadores.dto')
const { normalizeError } = require('../dist/api-error.filter')

test('S3-04: parámetros exactos, SQL oficial y una sola consulta sin depender del cwd', async () => {
  const report = { filtro_valido: true }
  const calls = []
  const service = new IndicatorsService({ query: async (...args) => { calls.push(args); return { rows: [{ reporte: report }] } } })
  assert.equal(await service.report('9223372036854775807', {
    desde: '2026-10-20T00:00:00.000001-05:00', tarea_ids: '9007199254740993,1001',
  }), report)
  assert.equal(calls[0][0], fs.readFileSync(path.join(__dirname, '../../database/sprint3/s3-01/metricas.sql'), 'utf8'))
  assert.deepEqual(calls[0][1], ['9223372036854775807', '2026-10-20T00:00:00.000001-05:00', null, ['9007199254740993', '1001']])
  await service.report('101')
  assert.deepEqual(calls[1][1], ['101', null, null, null])
  assert.equal(calls.length, 2)
})

test('S3-04: validación estricta de IDs, tipos, fechas reales y selecciones antes de SQL', async () => {
  let calls = 0
  const service = new IndicatorsService({ query: async () => { calls++; throw new Error('No debe consultar') } })
  for (const plan of [null, undefined, 101, {}, [], '0', '-1', '01', '1e2', '1.0', '9223372036854775808', "1'; DROP TABLE planes;--"]) {
    await assert.rejects(service.report(plan), e => normalizeError(e).status === 400)
  }
  for (const query of [null, [], 'texto', { otro: '1' }, ...[null, '', [], ['1001'], {}, '1001,1001', '1001,', ',1001', 'null', '0', '01', '1001, 1002', '9223372036854775808'].map(tarea_ids => ({ tarea_ids }))]) {
    await assert.rejects(service.report('101', query), e => normalizeError(e).status === 400)
  }
  const dates = [null, 0, [], {}, '', 'null', 'infinity', '2026-10-20', '2026-10-20T00:00:00',
    '2026-02-29T00:00:00Z', '2026-04-31T00:00:00Z', '2026-00-01T00:00:00Z', '2026-13-01T00:00:00Z',
    '2026-10-00T00:00:00Z', '0000-01-01T00:00:00Z', '2026-10-20T24:00:00Z', '2026-10-20T00:60:00Z',
    '2026-10-20T00:00:60Z', '2026-10-20T00:00:00+15:00', '2026-10-20T00:00:00+14:01',
    '2026-10-20T00:00:00+05:60', '2026-10-20T00:00:00.1234567Z', ' 2026-10-20T00:00:00Z']
  for (const field of ['desde', 'hasta']) for (const date of dates) {
    await assert.rejects(service.report('101', { [field]: date }), e => normalizeError(e).status === 400, `${field}: ${date}`)
  }
  assert.equal(calls, 0)
})

test('S3-04: períodos comparados por instante y con precisión de microsegundos', () => {
  for (const [desde, hasta] of [
    ['2026-10-20T00:00:00Z', '2026-10-20T00:00:00Z'],
    ['2026-10-21T00:00:00Z', '2026-10-20T00:00:00Z'],
    ['2026-10-19T19:00:00-05:00', '2026-10-20T00:00:00Z'],
    ['2026-10-20T00:00:00.000002Z', '2026-10-20T00:00:00.000001Z'],
  ]) assert.throws(() => parseIndicatorFilters('101', { desde, hasta }))
  for (const date of ['2024-02-29T23:59:59Z', '2000-02-29T00:00:00+14:00', '0001-01-01T00:00:00Z', '9999-12-31T23:59:59-14:00']) {
    assert.equal(parseIndicatorFilters('101', { desde: date }).desde, date)
  }
  assert.doesNotThrow(() => parseIndicatorFilters('101', { desde: '2026-10-20T00:00:00.000001Z', hasta: '2026-10-20T00:00:00.000002Z' }))
})

test('S3-04: errores de filtros SQL usan 404/400 y los internos se ocultan', async () => {
  for (const rule of ['PLAN_INVALIDO', 'PLAN_INEXISTENTE', 'PERIODO_INVALIDO', 'TAREAS_VACIAS', 'TAREA_INVALIDA']) {
    const service = new IndicatorsService({ query: async () => ({ rows: [{ reporte: { filtro_valido: false, error_filtro: rule } }] }) })
    await assert.rejects(service.report('101'), e => {
      const result = normalizeError(e)
      assert.equal(result.status, rule === 'PLAN_INEXISTENTE' ? 404 : 400)
      assert.equal(result.body.details[0].rule, rule)
      return true
    })
  }
  for (const db of [{ query: async () => ({ rows: [] }) }, { query: async () => { throw new Error('DATABASE_URL=secreto') } }]) {
    await assert.rejects(new IndicatorsService(db).report('101'), e => {
      assert.deepEqual(normalizeError(e), { status: 500, body: { code: 'INTERNAL_ERROR', message: 'No se pudo completar la solicitud.', details: [] } })
      return true
    })
  }
})
