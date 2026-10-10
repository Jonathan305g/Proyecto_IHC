// Lógica pura de la ejecución de sesiones (S2-07). Sin React ni red, para poder probarla con node:test.

export const RESULT_OPTIONS = [
  { value: 'sin_ayuda', label: 'Completada sin ayuda' },
  { value: 'con_ayuda', label: 'Completada con ayuda' },
  { value: 'no_completado', label: 'No completada' },
]

export const RESULT_LABELS = Object.fromEntries(RESULT_OPTIONS.map((option) => [option.value, option.label]))

export const MAX_OBSERVATION_LENGTH = 10000

/** Cronómetro basado en marcas de tiempo: sobrevive a recargas porque no depende de un intervalo. */
export function createTimer() {
  return { accumulatedMs: 0, startedAt: null }
}

export function startTimer(timer, now) {
  return timer.startedAt === null ? { ...timer, startedAt: now } : timer
}

export function pauseTimer(timer, now) {
  if (timer.startedAt === null) return timer
  return { accumulatedMs: timer.accumulatedMs + Math.max(0, now - timer.startedAt), startedAt: null }
}

export function resetTimer() {
  return createTimer()
}

export function elapsedMs(timer, now) {
  const running = timer.startedAt === null ? 0 : Math.max(0, now - timer.startedAt)
  return timer.accumulatedMs + running
}

export function elapsedSeconds(timer, now) {
  return Math.floor(elapsedMs(timer, now) / 1000)
}

/** Un reinicio solo necesita confirmación si se perdería tiempo ya medido. */
export function needsResetConfirmation(timer, now) {
  return elapsedMs(timer, now) > 0
}

export function formatClock(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const minutes = String(Math.floor(safe / 60)).padStart(2, '0')
  const seconds = String(safe % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

export function emptyDraft() {
  return { resultado: '', errores: '0', observacion: '', timer: createTimer(), dirty: false }
}

/** Devuelve los errores por campo; un objeto vacío significa que el avance se puede guardar. */
export function validateDraft(draft) {
  const errors = {}
  if (!RESULT_LABELS[draft.resultado]) errors.resultado = 'Elige cómo terminó la tarea.'
  const count = String(draft.errores ?? '').trim()
  if (!/^\d+$/.test(count) || !Number.isSafeInteger(Number(count))) {
    errors.errores = 'Escribe un número entero de 0 o más.'
  }
  if ((draft.observacion ?? '').length > MAX_OBSERVATION_LENGTH) {
    errors.observacion = `La observación admite hasta ${MAX_OBSERVATION_LENGTH} caracteres.`
  }
  return errors
}

/** Carga útil para la API: una sola operación idempotente por tarea (no duplica al guardar de nuevo). */
export function toResultPayload(draft, now) {
  return {
    resultado: draft.resultado,
    tiempo_segundos: elapsedSeconds(draft.timer, now),
    errores: Number(draft.errores),
    observacion: draft.observacion.trim() || null,
  }
}

/** Convierte un resultado guardado en el servidor en un borrador editable. */
export function draftFromResult(result) {
  const timer = { accumulatedMs: Math.max(0, Number(result.tiempo_segundos) || 0) * 1000, startedAt: null }
  return {
    resultado: result.resultado,
    errores: String(result.errores ?? 0),
    observacion: result.observacion ?? '',
    timer,
    dirty: false,
  }
}

export function taskStatus(taskId, savedIds) {
  return savedIds.has(String(taskId)) ? 'registrada' : 'pendiente'
}

export function progress(tasks, savedIds) {
  const done = tasks.filter((task) => savedIds.has(String(task.id))).length
  return { done, total: tasks.length, percent: tasks.length ? Math.round((done / tasks.length) * 100) : 0 }
}

export function pendingTasks(tasks, savedIds) {
  return tasks.filter((task) => !savedIds.has(String(task.id)))
}

export function canClose(session, tasks, savedIds) {
  return session?.estado === 'en_curso' && tasks.length > 0 && pendingTasks(tasks, savedIds).length === 0
}

export function summarize(tasks, resultsById) {
  const rows = tasks.map((task) => {
    const result = resultsById.get(String(task.id))
    return { task, result: result ?? null }
  })
  const recorded = rows.filter((row) => row.result)
  return {
    rows,
    totalErrors: recorded.reduce((sum, row) => sum + (row.result.errores ?? 0), 0),
    totalSeconds: recorded.reduce((sum, row) => sum + (row.result.tiempo_segundos ?? 0), 0),
  }
}

/** La API de sesiones puede marcar un cupo completo; si el campo falta, no se asume nada. */
export function isQuotaFull(session) {
  return session?.cupo_completo === true
}
