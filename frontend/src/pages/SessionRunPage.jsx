import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import PageHeader from '../components/PageHeader.jsx'
import { ErrorState, LoadingState } from '../components/UiState.jsx'
import {
  RESULT_LABELS, RESULT_OPTIONS, canClose, draftFromResult, elapsedSeconds, emptyDraft, formatClock,
  needsResetConfirmation, pauseTimer, pendingTasks, progress, resetTimer, startTimer, summarize,
  toResultPayload, validateDraft,
} from '../domain/sessionRun.js'
import { clearDrafts, loadDrafts, saveDrafts } from '../services/draftStore.js'
import { results } from '../services/results.js'
import { sessions } from '../services/persistence.js'
import '../execution.css'

const OFFLINE_MESSAGE = 'Sin conexión con el servidor. Tu avance sigue guardado en este equipo; vuelve a guardar cuando se recupere.'

function describeFailure(reason) {
  const offline = !navigator.onLine || reason?.name === 'TypeError'
  return { status: offline ? 'offline' : 'error', message: offline ? OFFLINE_MESSAGE : reason.message }
}

export default function SessionRunPage() {
  const { id } = useParams()
  const [session, setSession] = useState(null)
  const [saved, setSaved] = useState(() => new Map())
  const [drafts, setDrafts] = useState({})
  const [index, setIndex] = useState(0)
  const [view, setView] = useState('task')
  const [now, setNow] = useState(() => Date.now())
  const [loadError, setLoadError] = useState('')
  const [warning, setWarning] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [feedback, setFeedback] = useState({ status: 'idle', message: '' })
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)
  const headingRef = useRef(null)
  const confirmRef = useRef(null)

  const load = useCallback(async () => {
    setLoadError(''); setWarning('')
    try {
      const detail = await sessions.detail(id)
      let list = []
      try { list = await results.list(id) } catch (reason) {
        setWarning(`No se pudieron consultar los resultados guardados. ${reason.message}`)
      }
      setSession(detail)
      setSaved(new Map(list.map((item) => [String(item.tarea_id), item])))
      setDrafts(loadDrafts(id))
    } catch (reason) { setLoadError(reason.message) }
  }, [id])
  useEffect(() => { load() }, [load])

  const tasks = useMemo(() => session?.tareas ?? [], [session])
  const savedIds = useMemo(() => new Set(saved.keys()), [saved])
  const task = tasks[index]
  const draftFor = useCallback((taskId) => {
    const key = String(taskId)
    if (drafts[key]) return drafts[key]
    return saved.has(key) ? draftFromResult(saved.get(key)) : emptyDraft()
  }, [drafts, saved])
  const draft = task ? draftFor(task.id) : emptyDraft()
  const running = draft.timer.startedAt !== null

  // El reloj de pantalla solo avanza mientras el cronómetro corre; el valor real sale de las marcas de tiempo.
  useEffect(() => {
    if (!running) return undefined
    const timer = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(timer)
  }, [running])

  useEffect(() => { headingRef.current?.focus() }, [index, view, session?.estado])
  useEffect(() => { if (confirm) confirmRef.current?.focus() }, [confirm])

  function patchDraft(next) {
    const key = String(task.id)
    setDrafts((current) => {
      const updated = { ...current, [key]: { ...next, dirty: true } }
      saveDrafts(id, updated)
      return updated
    })
    setFeedback({ status: 'idle', message: '' })
  }

  function changeField(field, value) {
    patchDraft({ ...draft, [field]: value })
    if (fieldErrors[field]) setFieldErrors((current) => ({ ...current, [field]: undefined }))
  }

  function toggleTimer() {
    const at = Date.now(); setNow(at)
    patchDraft({ ...draft, timer: running ? pauseTimer(draft.timer, at) : startTimer(draft.timer, at) })
  }

  function requestReset() {
    const at = Date.now()
    if (needsResetConfirmation(draft.timer, at)) setConfirm('reset')
    else patchDraft({ ...draft, timer: resetTimer() })
  }

  function confirmReset() {
    patchDraft({ ...draft, timer: resetTimer() })
    setConfirm(null)
  }

  async function saveTask() {
    const at = Date.now()
    const stopped = { ...draft, timer: pauseTimer(draft.timer, at) }
    const problems = validateDraft(stopped)
    setFieldErrors(problems)
    if (Object.keys(problems).length) {
      setFeedback({ status: 'error', message: 'Revisa los campos marcados antes de guardar.' })
      return false
    }
    setBusy(true); setFeedback({ status: 'saving', message: 'Guardando avance…' }); setNow(at)
    try {
      const payload = toResultPayload(stopped, at)
      const stored = await results.save(id, task.id, payload)
      setSaved((current) => new Map(current).set(String(task.id), { tarea_id: task.id, ...payload, ...stored }))
      setDrafts((current) => {
        const updated = { ...current, [String(task.id)]: { ...stopped, dirty: false } }
        saveDrafts(id, updated)
        return updated
      })
      setFeedback({ status: 'saved', message: `Avance de «${task.titulo}» guardado.` })
      return true
    } catch (reason) {
      patchDraft(stopped)
      setFeedback(describeFailure(reason))
      return false
    } finally { setBusy(false) }
  }

  async function saveAndGo(target) {
    if (draft.dirty || !saved.has(String(task.id))) {
      if (!(await saveTask())) return
    }
    setIndex(target); setFieldErrors({}); setFeedback({ status: 'idle', message: '' })
  }

  async function closeSession() {
    setBusy(true); setConfirm(null)
    try {
      setSession(await sessions.update(id, { accion: 'cerrar' }))
      clearDrafts(id); setDrafts({})
      setFeedback({ status: 'saved', message: 'La sesión se cerró y sus resultados quedaron registrados.' })
    } catch (reason) { setFeedback(describeFailure(reason)) }
    finally { setBusy(false) }
  }

  if (loadError) return <><PageHeader eyebrow="EJECUCIÓN" title="Ejecución de sesión" description="No se pudo abrir la sesión." /><ErrorState message={loadError} onRetry={load} /></>
  if (!session) return <LoadingState label="Cargando la sesión…" />

  const header = <PageHeader
    eyebrow="EJECUCIÓN"
    title={`Sesión de ${session.participante_codigo}`}
    description={`Plan: ${session.plan_nombre}. Tu avance se guarda tarea por tarea y se conserva al recargar.`}
    action={<Link className="button button-outline" to="/sesiones">Volver a sesiones</Link>}
  />
  const warningNotice = warning && <p className="notice" role="status">{warning}</p>

  if (session.estado === 'pendiente') {
    return <>{header}{warningNotice}<section className="form-panel">
      <h2 ref={headingRef} tabIndex="-1">La sesión aún no se inició</h2>
      <p>Antes de registrar tareas hay que confirmar el consentimiento del participante.</p>
      <Link className="button button-primary" to={`/sesiones/${session.id}`}>Confirmar consentimiento e iniciar</Link>
    </section></>
  }

  const overall = progress(tasks, savedIds)
  const progressBar = <div className="run-progress">
    <div role="progressbar" aria-label="Progreso de la sesión" aria-valuemin="0" aria-valuemax={overall.total} aria-valuenow={overall.done} aria-valuetext={`${overall.done} de ${overall.total} tareas registradas`}>
      <span style={{ width: `${overall.percent}%` }} />
    </div>
    <p>{overall.done} de {overall.total} tareas registradas</p>
  </div>

  const summary = summarize(tasks, saved)
  const missing = pendingTasks(tasks, savedIds)
  const closed = session.estado === 'cerrada'

  if (view === 'summary' || closed) {
    return <>{header}{warningNotice}{progressBar}
      <section className="form-panel run-panel" aria-labelledby="titulo-resumen">
        <h2 id="titulo-resumen" ref={headingRef} tabIndex="-1">{closed ? 'Resumen de la sesión cerrada' : 'Revisar resumen antes de cerrar'}</h2>
        <table className="run-table">
          <caption className="visually-hidden">Resultado registrado por tarea</caption>
          <thead><tr><th scope="col">Tarea</th><th scope="col">Resultado</th><th scope="col">Tiempo</th><th scope="col">Errores</th>{!closed && <th scope="col"><span className="visually-hidden">Acción</span></th>}</tr></thead>
          <tbody>{summary.rows.map(({ task: row, result }, position) => <tr key={row.id}>
            <th scope="row">{row.titulo}</th>
            <td>{result ? RESULT_LABELS[result.resultado] : 'Pendiente de registrar'}</td>
            <td>{result ? formatClock(result.tiempo_segundos) : '—'}</td>
            <td>{result ? result.errores : '—'}</td>
            {!closed && <td><button type="button" className="button button-outline" onClick={() => { setIndex(position); setView('task') }}>{result ? 'Editar' : 'Registrar'}<span className="visually-hidden"> {row.titulo}</span></button></td>}
          </tr>)}</tbody>
        </table>
        <p><strong>Total:</strong> {summary.totalErrors} errores · {formatClock(summary.totalSeconds)} de tiempo registrado</p>
        {!closed && missing.length > 0 && <p className="notice notice-error" role="alert">Falta registrar: {missing.map((item) => item.titulo).join(', ')}. No se puede cerrar hasta completarlas.</p>}
        {confirm === 'close' && <div className="run-confirm" role="alertdialog" aria-labelledby="confirm-cierre" aria-describedby="confirm-cierre-texto">
          <h3 id="confirm-cierre">¿Cerrar la sesión?</h3>
          <p id="confirm-cierre-texto">Después de cerrarla ya no podrás editar los resultados de {session.participante_codigo}.</p>
          <div className="form-actions"><button ref={confirmRef} type="button" className="button button-primary" onClick={closeSession}>Sí, cerrar sesión</button><button type="button" className="button button-outline" onClick={() => setConfirm(null)}>Seguir revisando</button></div>
        </div>}
        <FeedbackLine feedback={feedback} />
        {!closed && <div className="form-actions">
          <button type="button" className="button button-outline" onClick={() => setView('task')}>Volver a las tareas</button>
          <button type="button" className="button button-primary" disabled={!canClose(session, tasks, savedIds) || busy} onClick={() => setConfirm('close')}>Cerrar sesión</button>
        </div>}
      </section></>
  }

  const clock = formatClock(elapsedSeconds(draft.timer, now))
  const last = index === tasks.length - 1
  return <>{header}{warningNotice}{progressBar}
    <section className="form-panel run-panel" aria-labelledby="titulo-tarea">
      <p className="eyebrow">TAREA {index + 1} DE {tasks.length} · {saved.has(String(task.id)) ? 'REGISTRADA' : 'PENDIENTE'}</p>
      <h2 id="titulo-tarea" ref={headingRef} tabIndex="-1">{task.titulo}</h2>
      <p><strong>Instrucción:</strong> {task.descripcion}</p>
      <p><strong>Criterio de éxito:</strong> {task.criterio_exito || 'No se definió un criterio para esta tarea.'}</p>

      <div className="run-timer" role="group" aria-label="Cronómetro de la tarea">
        <output aria-live="off" className="run-clock">{clock}</output>
        <span>{running ? 'Cronómetro en marcha' : draft.timer.accumulatedMs > 0 ? 'Cronómetro en pausa' : 'Cronómetro detenido'}</span>
        <button type="button" className="button button-primary" onClick={toggleTimer}>{running ? 'Pausar' : draft.timer.accumulatedMs > 0 ? 'Reanudar' : 'Iniciar'}</button>
        <button type="button" className="button button-outline" onClick={requestReset}>Reiniciar</button>
      </div>
      {confirm === 'reset' && <div className="run-confirm" role="alertdialog" aria-labelledby="confirm-reinicio" aria-describedby="confirm-reinicio-texto">
        <h3 id="confirm-reinicio">¿Reiniciar el cronómetro?</h3>
        <p id="confirm-reinicio-texto">Se perderán los {clock} medidos en esta tarea.</p>
        <div className="form-actions"><button ref={confirmRef} type="button" className="button button-primary" onClick={confirmReset}>Sí, reiniciar</button><button type="button" className="button button-outline" onClick={() => setConfirm(null)}>Conservar el tiempo</button></div>
      </div>}

      <fieldset aria-describedby={fieldErrors.resultado ? 'error-resultado' : undefined}>
        <legend>Resultado de la tarea</legend>
        {RESULT_OPTIONS.map((option) => <label key={option.value} className="checkbox-label">
          <input type="radio" name="resultado" value={option.value} checked={draft.resultado === option.value} onChange={() => changeField('resultado', option.value)} />
          {option.label}
        </label>)}
        {fieldErrors.resultado && <p id="error-resultado" className="field-error">{fieldErrors.resultado}</p>}
      </fieldset>

      <label>Número de errores
        <input type="number" min="0" step="1" inputMode="numeric" value={draft.errores} aria-invalid={Boolean(fieldErrors.errores)} aria-describedby={fieldErrors.errores ? 'error-errores' : 'ayuda-errores'} onChange={(event) => changeField('errores', event.target.value)} />
      </label>
      <small id="ayuda-errores">Cuenta los pasos equivocados o repetidos que observaste.</small>
      {fieldErrors.errores && <p id="error-errores" className="field-error">{fieldErrors.errores}</p>}

      <label>Observaciones
        <textarea value={draft.observacion} aria-invalid={Boolean(fieldErrors.observacion)} aria-describedby={fieldErrors.observacion ? 'error-observacion' : undefined} onChange={(event) => changeField('observacion', event.target.value)} />
      </label>
      {fieldErrors.observacion && <p id="error-observacion" className="field-error">{fieldErrors.observacion}</p>}

      <FeedbackLine feedback={feedback} />
      <div className="form-actions">
        <button type="button" className="button button-outline" disabled={busy || index === 0} onClick={() => saveAndGo(index - 1)}>Anterior</button>
        <button type="button" className="button button-outline" disabled={busy} onClick={saveTask}>{busy ? 'Guardando…' : 'Guardar avance'}</button>
        {last
          ? <button type="button" className="button button-primary" disabled={busy} onClick={async () => { if (await saveTask()) setView('summary') }}>Guardar y revisar resumen</button>
          : <button type="button" className="button button-primary" disabled={busy} onClick={() => saveAndGo(index + 1)}>Guardar y continuar</button>}
        <button type="button" className="button button-outline" disabled={busy} onClick={() => setView('summary')}>Ver resumen</button>
      </div>
    </section></>
}

function FeedbackLine({ feedback }) {
  const isProblem = feedback.status === 'error' || feedback.status === 'offline'
  return <p className={`run-feedback${isProblem ? ' notice notice-error' : ''}`} role={isProblem ? 'alert' : 'status'} aria-live="polite">
    {feedback.status === 'idle' ? '' : <>{feedback.status === 'saved' && '✔ '}{isProblem && '⚠ '}{feedback.message}</>}
  </p>
}
