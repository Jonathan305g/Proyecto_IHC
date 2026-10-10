import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canClose, createTimer, draftFromResult, elapsedSeconds, emptyDraft, formatClock, isQuotaFull,
  needsResetConfirmation, pauseTimer, pendingTasks, progress, resetTimer, startTimer, summarize,
  toResultPayload, validateDraft,
} from '../src/domain/sessionRun.js'

test('el cronómetro acumula solo mientras corre y la pausa conserva el tiempo', () => {
  let timer = startTimer(createTimer(), 1000)
  assert.equal(elapsedSeconds(timer, 4000), 3)
  timer = pauseTimer(timer, 4000)
  assert.equal(elapsedSeconds(timer, 90000), 3)
  timer = startTimer(timer, 100000)
  assert.equal(elapsedSeconds(timer, 102500), 5)
})

test('iniciar un cronómetro ya iniciado no reinicia la marca', () => {
  const timer = startTimer(createTimer(), 1000)
  assert.equal(startTimer(timer, 5000).startedAt, 1000)
})

test('pausar un cronómetro detenido no cambia nada y el tiempo nunca es negativo', () => {
  const stopped = createTimer()
  assert.equal(pauseTimer(stopped, 5000), stopped)
  assert.equal(elapsedSeconds({ accumulatedMs: 0, startedAt: 9000 }, 1000), 0)
})

test('el reinicio pide confirmación solo si hay tiempo medido', () => {
  assert.equal(needsResetConfirmation(createTimer(), 5000), false)
  assert.equal(needsResetConfirmation(startTimer(createTimer(), 0), 2000), true)
  assert.equal(elapsedSeconds(resetTimer(), 9999), 0)
})

test('formatClock muestra minutos y segundos con dos dígitos', () => {
  assert.equal(formatClock(0), '00:00')
  assert.equal(formatClock(75), '01:15')
  assert.equal(formatClock(3725), '62:05')
  assert.equal(formatClock(-4), '00:00')
})

test('validateDraft exige resultado y errores enteros no negativos', () => {
  assert.deepEqual(Object.keys(validateDraft(emptyDraft())), ['resultado'])
  const base = { ...emptyDraft(), resultado: 'sin_ayuda' }
  assert.deepEqual(validateDraft(base), {})
  assert.ok(validateDraft({ ...base, errores: '-1' }).errores)
  assert.ok(validateDraft({ ...base, errores: '2.5' }).errores)
  assert.ok(validateDraft({ ...base, errores: '' }).errores)
  assert.ok(validateDraft({ ...base, resultado: 'otro' }).resultado)
  assert.ok(validateDraft({ ...base, observacion: 'x'.repeat(10001) }).observacion)
})

test('toResultPayload produce un cuerpo idempotente con tiempo y errores numéricos', () => {
  const draft = { ...emptyDraft(), resultado: 'con_ayuda', errores: '2', observacion: '  dudó en el menú  ', timer: { accumulatedMs: 61500, startedAt: null } }
  assert.deepEqual(toResultPayload(draft, 0), { resultado: 'con_ayuda', tiempo_segundos: 61, errores: 2, observacion: 'dudó en el menú' })
  assert.equal(toResultPayload({ ...draft, observacion: '   ' }, 0).observacion, null)
})

test('draftFromResult reconstruye el borrador desde lo guardado', () => {
  const draft = draftFromResult({ resultado: 'sin_ayuda', tiempo_segundos: 12, errores: 1, observacion: null })
  assert.equal(draft.observacion, '')
  assert.equal(elapsedSeconds(draft.timer, 0), 12)
  assert.equal(draft.dirty, false)
})

const tasks = [{ id: '4' }, { id: '5' }, { id: '6' }]

test('progreso, pendientes y condición de cierre', () => {
  const saved = new Set(['4'])
  assert.deepEqual(progress(tasks, saved), { done: 1, total: 3, percent: 33 })
  assert.deepEqual(pendingTasks(tasks, saved).map((task) => task.id), ['5', '6'])
  assert.equal(canClose({ estado: 'en_curso' }, tasks, saved), false)
  const all = new Set(['4', '5', '6'])
  assert.equal(canClose({ estado: 'en_curso' }, tasks, all), true)
  assert.equal(canClose({ estado: 'cerrada' }, tasks, all), false)
  assert.equal(canClose({ estado: 'en_curso' }, [], new Set()), false)
})

test('summarize suma errores y tiempos solo de tareas registradas', () => {
  const results = new Map([['4', { errores: 1, tiempo_segundos: 30 }], ['5', { errores: 2, tiempo_segundos: 10 }]])
  const summary = summarize(tasks, results)
  assert.equal(summary.totalErrors, 3)
  assert.equal(summary.totalSeconds, 40)
  assert.equal(summary.rows[2].result, null)
})

test('isQuotaFull solo es verdadero cuando la API lo indica', () => {
  assert.equal(isQuotaFull({ cupo_completo: true }), true)
  assert.equal(isQuotaFull({}), false)
})
