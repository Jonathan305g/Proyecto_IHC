const { test } = require('node:test')
const assert = require('node:assert/strict')
const { parsePlan, parseUpdatePlan } = require('../dist/dto/plan.dto')
const { parseTask, parseUpdateTask } = require('../dist/dto/tarea.dto')
const { parseSession, parseUpdateSession } = require('../dist/dto/sesion.dto')
const { id } = require('../dist/validation')

const task = { titulo: ' Buscar curso ', descripcion: 'Localizar curso', orden: 1 }

test('valida el contrato de React y normaliza campos opcionales de tarea', () => {
  assert.deepEqual(parseTask({ ...task, codigo: '', criterio_exito: null }), {
    ...task, titulo: 'Buscar curso', codigo: null, criterio_exito: null,
  })
  assert.equal(parsePlan({ nombre: 'Navegación', objetivo: 'Encontrar curso', tareas: [task] }).tareas.length, 1)
  assert.deepEqual(parseUpdateTask({ codigo: null, criterio_exito: null }), { codigo: null, criterio_exito: null })
})

test('rechaza tareas duplicadas, campos desconocidos y actualizaciones vacías', () => {
  assert.throws(() => parsePlan({ nombre: 'Prueba', objetivo: 'Objetivo', tareas: [task, task] }))
  assert.throws(() => parsePlan({ nombre: 'Prueba', objetivo: 'Objetivo', tareas: [{ ...task, codigo: 'T1' }, { ...task, orden: 2, codigo: 'T1' }] }))
  assert.throws(() => parseTask({ ...task, orden: 2147483648 }))
  assert.throws(() => parseTask({ ...task, plan_id: '1' }))
  for (const value of [{}, { nombre: null }, { estado: 'READY' }, { objetivo: ' ' }]) assert.throws(() => parseUpdatePlan(value))
  assert.throws(() => parseUpdateTask({}))
  assert.throws(() => parsePlan({ nombre: 'Prueba', objetivo: 'Objetivo', tareas: [] }))
})

test('respeta BIGINT sin pérdida de precisión y rechaza coerciones de objetos', () => {
  assert.equal(id('9223372036854775807'), '9223372036854775807')
  for (const value of ['9223372036854775808', '0', '-1', '1.1', '01', '1e3']) assert.throws(() => id(value))
  assert.equal(parseSession({ plan_id: '9007199254740993', codigo_participante: 'P1' }).plan_id, '9007199254740993')
  assert.equal(parseSession({ plan_id: 1, codigo_participante: 'P1' }).plan_id, '1')
  for (const plan_id of [9007199254740992, {}, ['1'], null, true]) assert.throws(() => parseSession({ plan_id, codigo_participante: 'P1' }))
})

test('exige consentimiento booleano para iniciar y admite el cierre enviado por React', () => {
  assert.deepEqual(parseUpdateSession({ accion: 'iniciar', consentimiento_confirmado: true }), { accion: 'iniciar', consentimiento_confirmado: true })
  assert.equal(parseUpdateSession({ accion: 'cerrar', consentimiento_confirmado: false }).accion, 'cerrar')
  for (const consentimiento_confirmado of [false, 'true', 1, null, undefined]) assert.throws(() => parseUpdateSession({ accion: 'iniciar', consentimiento_confirmado }))
  assert.throws(() => parseUpdateSession({ accion: 'cerrar', consentimiento_confirmado: 'false' }))
  assert.throws(() => parseUpdateSession({ accion: 'reabrir' }))
})
