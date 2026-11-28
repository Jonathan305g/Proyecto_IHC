import test from 'node:test'
import assert from 'node:assert/strict'
import {
  serializePlanObjective,
  deserializePlanObjective,
  serializeTaskDescription,
  deserializeTaskDescription,
  createBlankTask,
} from '../src/services/planHelpers.js'

test('serializePlanObjective y deserializePlanObjective conservan metadatos sin pérdida de información', () => {
  const original = {
    objetivo: 'Evaluar la usabilidad del flujo de compra y detectar cuellos de botella.',
    interfazEvaluada: 'E-commerce v3.2 - Módulo de checkout',
    perfil: 'Compradores recurrentes de 20 a 45 años',
    modalidad: 'Moderada presencial',
    numeroParticipantes: '8',
  }

  const serialized = serializePlanObjective(original)
  assert.ok(serialized.includes(original.objetivo))
  assert.ok(serialized.includes('Interfaz evaluada: E-commerce v3.2 - Módulo de checkout'))
  assert.ok(serialized.includes('Modalidad: Moderada presencial'))
  assert.ok(serialized.includes('Número previsto de participantes: 8'))

  const deserialized = deserializePlanObjective(serialized)
  assert.deepEqual(deserialized, original)
})

test('deserializePlanObjective tolera texto plano sin metadatos previos', () => {
  const plainText = 'Objetivo simple sin estructura adicional'
  const parsed = deserializePlanObjective(plainText)
  assert.equal(parsed.objetivo, plainText)
  assert.equal(parsed.modalidad, 'Moderada remota')
  assert.equal(parsed.numeroParticipantes, '5')
})

test('serializeTaskDescription y deserializeTaskDescription estructuran consignas y métricas', () => {
  const taskData = {
    consignaNeutral: 'Completa el proceso de compra utilizando una tarjeta de prueba.',
    resultadoEsperado: 'Pantalla de confirmación de orden con número de pedido visible.',
    metrica: 'Tasa de éxito y tiempo de completación',
  }

  const serialized = serializeTaskDescription(taskData)
  assert.ok(serialized.includes('Consigna neutral:'))
  assert.ok(serialized.includes('Resultado esperado:'))
  assert.ok(serialized.includes('Métrica:'))

  const deserialized = deserializeTaskDescription(serialized)
  assert.deepEqual(deserialized, taskData)
})

test('createBlankTask genera tareas con orden y código incremental', () => {
  const task1 = createBlankTask(0)
  assert.equal(task1.codigo, 'T-01')
  assert.equal(task1.titulo, '')
  assert.equal(typeof task1.metrica, 'string')

  const task2 = createBlankTask(1)
  assert.equal(task2.codigo, 'T-02')
})
