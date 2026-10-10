require('reflect-metadata')
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { SessionsService } = require('../dist/sessions.service')
const { ResultsService } = require('../dist/results.service')
const { PlansService } = require('../dist/plans.service')
const { parseResult } = require('../dist/dto/resultado.dto')
const { parseSession, parseUpdateSession } = require('../dist/dto/sesion.dto')
const { parsePlan, parseUpdatePlan } = require('../dist/dto/plan.dto')
const { normalizeError } = require('../dist/api-error.filter')
const result = { completada: true, duracion_segundos: 0, cantidad_errores: 0 }

function fixture({ estado = 'en_curso', cupo = 2, total = '1', pendientes = null, tasks = [{ id: '4' }], consent = true } = {}) {
  const statements = [], saved = new Map()
  const session = { id: '2', plan_id: '1', estado, consentimiento_confirmado: consent }
  const db = {
    transaction: async op => op({ query: db.query }),
    query: async (sql, values = []) => {
      statements.push({ sql, values })
      const rows = items => ({ rows: items, rowCount: items.length })
      if (sql.includes('COUNT(*) AS total')) return rows([{ total: sql.includes('public.tareas') ? String(tasks.length) : total }])
      if (sql.includes('FROM public.planes')) return rows([{ id: '1', cupo, estado: 'activo' }])
      if (sql.includes('NOT EXISTS')) return rows(pendientes ?? tasks.filter(t => !saved.has(`2:${t.id}`)))
      if (sql.includes('FROM public.sesiones')) return rows([session])
      if (sql.includes('FROM public.tareas')) return rows(tasks.filter(t => !sql.includes('id = $1 AND') || t.id === values[0]))
      if (sql.includes('AS siguiente')) return rows([{ siguiente: '1000' }])
      if (sql.startsWith('INSERT INTO public.participantes')) return rows([{ id: '3' }])
      if (sql.startsWith('INSERT INTO public.sesiones')) {
        session.estado = values[2]; session.consentimiento_confirmado = values[3]
        return rows([{ id: '2' }])
      }
      if (sql.startsWith('INSERT INTO public.resultados')) {
        assert.match(sql, /ON CONFLICT \(sesion_id, tarea_id\) DO UPDATE/)
        const key = `${values[1]}:${values[2]}`
        const record = { id: saved.get(key)?.id ?? String(saved.size + 10), plan_id: values[0], sesion_id: values[1], tarea_id: values[2], completada: values[3], con_ayuda: values[4], duracion_segundos: values[5], cantidad_errores: values[6], observaciones: values[7] }
        saved.set(key, record)
        return rows([record])
      }
      if (sql.startsWith('UPDATE public.sesiones')) {
        session.estado = sql.includes("estado = 'cerrada'") ? 'cerrada' : 'en_curso'
        session.consentimiento_confirmado = true
      }
      if (sql.includes('FROM public.resultados')) return rows([...saved.values()])
      return rows([])
    },
  }
  return { db, statements, session, saved, sessions: new SessionsService(db), results: new ResultsService(db) }
}

test('valida los tres resultados y ambos contratos sin coerciones ni mezclas', () => {
  assert.deepEqual(parseResult(result), { ...result, con_ayuda: false, observaciones: null })
  for (const [resultado, completada, con_ayuda] of [['sin_ayuda', true, false], ['con_ayuda', true, true], ['no_completado', false, false]]) {
    assert.deepEqual(parseResult({ resultado, tiempo_segundos: 61, errores: 2, observacion: ' Nota ' }), { completada, con_ayuda, duracion_segundos: 61, cantidad_errores: 2, observaciones: 'Nota' })
  }
  for (const field of ['duracion_segundos', 'cantidad_errores']) {
    for (const value of [-1, 1.2, '0', null, undefined, NaN, Infinity, 2147483648]) assert.throws(() => parseResult({ ...result, [field]: value }))
    assert.equal(parseResult({ ...result, [field]: 2147483647 })[field], 2147483647)
  }
  for (const invalid of [null, [], {}, { ...result, completada: 'true' }, { ...result, con_ayuda: null }, { ...result, completada: false, con_ayuda: true }, { ...result, observaciones: 1 }, { ...result, observaciones: 'a'.repeat(10001) }, { ...result, sesion_id: '2' }, { ...result, resultado: 'sin_ayuda' }]) assert.throws(() => parseResult(invalid))
})

test('valida inicio anónimo, continuación y cupo configurable', () => {
  assert.deepEqual(parseSession({ plan_id: 1, consentimiento_confirmado: true }), { plan_id: '1', consentimiento_confirmado: true })
  for (const value of [undefined, null, false, 1, 'true']) assert.throws(() => parseSession({ plan_id: '1', consentimiento_confirmado: value }))
  assert.throws(() => parseSession({ plan_id: '1', codigo_participante: 'P1', consentimiento_confirmado: true }))
  assert.deepEqual(parseUpdateSession({ accion: 'continuar' }), { accion: 'continuar' })
  assert.throws(() => parseUpdateSession({ accion: 'continuar', consentimiento_confirmado: false }))
  assert.deepEqual(parseUpdatePlan({ cupo: null }), { cupo: null })
  assert.deepEqual(parseUpdatePlan({ cupo: 5 }), { cupo: 5 })
  for (const cupo of [0, -1, 1.5, '5', true, 2147483648]) assert.throws(() => parseUpdatePlan({ cupo }))
  assert.equal(parsePlan({ nombre: 'Plan', objetivo: 'Objetivo', tareas: [{ titulo: 'Tarea', descripcion: 'Texto', orden: 1 }], cupo: 3 }).cupo, 3)
})

test('inicia con consentimiento y código automático sin truncar P-1000', async () => {
  const f = fixture()
  const session = await f.sessions.create({ plan_id: '1', consentimiento_confirmado: true })
  assert.equal(session.estado, 'en_curso')
  assert.equal(session.consentimiento_confirmado, true)
  assert.deepEqual(f.statements.find(q => q.sql.startsWith('INSERT INTO public.participantes')).values, ['P-1000'])
  assert.match(f.statements[0].sql, /FOR UPDATE/)
  assert.ok(f.statements.some(q => q.sql.startsWith('LOCK TABLE public.participantes')))
})

test('rechaza cupo completo antes de insertar y permite continuar; null no limita', async () => {
  const f = fixture({ cupo: 1, total: '1' })
  await assert.rejects(f.sessions.create({ plan_id: '1', consentimiento_confirmado: true }), e => normalizeError(e).status === 409)
  assert.equal(f.statements.some(q => q.sql.startsWith('INSERT')), false)
  assert.equal((await f.sessions.update('2', { accion: 'continuar' })).estado, 'en_curso')
  assert.equal((await fixture({ cupo: null, total: '10000' }).sessions.create({ plan_id: '1', codigo_participante: 'MANUAL' })).estado, 'pendiente')
})

test('upsert conserva ID y recupera resultados y progreso para continuar', async () => {
  const f = fixture()
  const first = await f.results.save('2', '4', result)
  const second = await f.results.save('2', '4', { ...result, completada: false, duracion_segundos: 12, cantidad_errores: 2, observaciones: 'Intento' })
  assert.equal(first.id, second.id)
  assert.equal(f.saved.size, 1)
  assert.equal(second.duracion_segundos, 12)
  assert.deepEqual(await f.results.list('2'), [second])
  const detail = await f.sessions.detail('2')
  assert.deepEqual(detail.progreso, { total: 1, registradas: 1, pendientes: [] })
  assert.deepEqual(detail.resultados, [second])
})

test('rechaza resultados en estados inválidos, sin consentimiento y de otro plan', async () => {
  for (const state of ['pendiente', 'cerrada']) {
    const f = fixture({ estado: state })
    await assert.rejects(f.results.save('2', '4', result), e => normalizeError(e).status === 409)
    assert.equal(f.saved.size, 0)
  }
  await assert.rejects(fixture({ consent: false }).results.save('2', '4', result), e => normalizeError(e).status === 409)
  await assert.rejects(fixture().results.save('2', '99', result), e => normalizeError(e).status === 404)
  const f = fixture()
  await assert.rejects(f.results.save('01', '4', result))
  await assert.rejects(f.results.save('2', '4', { ...result, cantidad_errores: -1 }))
  assert.equal(f.statements.length, 0)
})

test('rechaza cierre incompleto y estados inválidos; admite pendiente a en_curso a cerrada', async () => {
  const f = fixture({ pendientes: [{ id: '4' }] })
  await assert.rejects(f.sessions.update('2', { accion: 'cerrar' }), e => {
    assert.deepEqual(normalizeError(e).body.details, [{ tarea_id: '4', message: 'Resultado pendiente.' }])
    return normalizeError(e).status === 409
  })
  assert.equal(f.session.estado, 'en_curso')
  await assert.rejects(fixture({ tasks: [] }).sessions.update('2', { accion: 'cerrar' }), e => normalizeError(e).status === 409)
  for (const state of ['pendiente', 'cerrada']) await assert.rejects(fixture({ estado: state }).sessions.update('2', { accion: 'cerrar' }), e => normalizeError(e).status === 409)
  const pending = fixture({ estado: 'pendiente', consent: false })
  assert.equal((await pending.sessions.update('2', { accion: 'iniciar', consentimiento_confirmado: true })).estado, 'en_curso')
  await assert.rejects(pending.sessions.update('2', { accion: 'iniciar', consentimiento_confirmado: true }), e => normalizeError(e).status === 409)
  await pending.results.save('2', '4', { ...result, completada: false })
  assert.equal((await pending.sessions.update('2', { accion: 'cerrar' })).estado, 'cerrada')
  await assert.rejects(pending.sessions.update('2', { accion: 'continuar' }), e => normalizeError(e).status === 409)
})

test('sesión o plan inexistentes devuelven 404', async () => {
  const db = { query: async () => ({ rows: [], rowCount: 0 }), transaction: async op => op(db) }
  const sessions = new SessionsService(db), results = new ResultsService(db)
  for (const op of [() => sessions.create({ plan_id: '99', consentimiento_confirmado: true }), () => sessions.detail('99'), () => sessions.update('99', { accion: 'cerrar' }), () => results.list('99'), () => results.save('99', '4', result)]) await assert.rejects(op(), e => normalizeError(e).status === 404)
})

test('no permite reducir cupo por debajo de las sesiones creadas', async () => {
  const f = fixture({ total: '3' })
  await assert.rejects(new PlansService(f.db).update('1', { cupo: 2 }), e => normalizeError(e).status === 409)
  assert.equal(f.statements.some(q => q.sql.startsWith('UPDATE')), false)
})
