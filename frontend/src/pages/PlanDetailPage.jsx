import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import PageHeader from '../components/PageHeader.jsx'
import { ErrorState, LoadingState } from '../components/UiState.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'
import { plans } from '../services/persistence.js'
import {
  MODALIDADES_DISPONIBLES,
  METRICAS_SUGERIDAS,
  deserializePlanObjective,
  serializePlanObjective,
  deserializeTaskDescription,
  serializeTaskDescription,
} from '../services/planHelpers.js'

export default function PlanDetailPage() {
  const { id } = useParams()
  const [plan, setPlan] = useState(null)

  // Datos generales del plan
  const [nombre, setNombre] = useState('')
  const [objetivo, setObjetivo] = useState('')
  const [interfazEvaluada, setInterfazEvaluada] = useState('')
  const [perfil, setPerfil] = useState('')
  const [modalidad, setModalidad] = useState('Moderada remota')
  const [numeroParticipantes, setNumeroParticipantes] = useState('5')
  const [estado, setEstado] = useState('borrador')

  // Modos y mensajes
  const [isEditing, setIsEditing] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [showDiscardModal, setShowDiscardModal] = useState(false)

  const load = useCallback(() => {
    setError('')
    plans
      .detail(id)
      .then((value) => {
        setPlan(value)
        setNombre(value.nombre)
        setEstado(value.estado)
        const parsed = deserializePlanObjective(value.objetivo)
        setObjetivo(parsed.objetivo)
        setInterfazEvaluada(parsed.interfazEvaluada)
        setPerfil(parsed.perfil)
        setModalidad(parsed.modalidad)
        setNumeroParticipantes(parsed.numeroParticipantes)
      })
      .catch((reason) => setError(reason.message))
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function savePlanInfo(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    setSaving(true)
    try {
      const objetivoSerializado = serializePlanObjective({
        objetivo,
        interfazEvaluada,
        perfil,
        modalidad,
        numeroParticipantes,
      })
      const updated = await plans.update(id, {
        nombre: nombre.trim(),
        objetivo: objetivoSerializado,
        estado,
      })
      setPlan(updated)
      setMessage('Plan actualizado correctamente.')
      setIsEditing(false)
    } catch (reason) {
      setError(reason.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="PLANIFICACIÓN / DETALLE"
        title={plan?.nombre ?? 'Detalle del plan'}
        description="Consulta las especificaciones, consignas de tareas y criterios de éxito del plan de prueba."
        action={
          plan && (
            <div className="form-actions">
              {plan.estado === 'activo' && (
                <Link className="button button-primary" to="/sesiones/nueva">
                  Iniciar sesión con este plan
                </Link>
              )}
              <Link className="button button-outline" to="/planes">
                Volver a la lista
              </Link>
            </div>
          )
        }
      />

      <ConfirmModal
        isOpen={showDiscardModal}
        title="Descartar cambios"
        message="¿Deseas descartar los cambios realizados en los datos generales del plan?"
        confirmText="Descartar cambios"
        cancelText="Continuar editando"
        isDanger={true}
        onConfirm={() => {
          setShowDiscardModal(false)
          setIsEditing(false)
          load()
        }}
        onCancel={() => setShowDiscardModal(false)}
      />

      {error && <ErrorState message={error} onRetry={load} />}
      {!plan && !error && <LoadingState />}

      {plan && (
        <>
          {message && (
            <p className="notice" role="status">
              {message}
            </p>
          )}

          {/* Panel de datos generales */}
          <section className="form-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>Datos generales</h2>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span
                  className={`badge ${
                    estado === 'activo'
                      ? 'badge-active'
                      : estado === 'borrador'
                      ? 'badge-draft'
                      : 'badge-subtle'
                  }`}
                >
                  {estado.toUpperCase()}
                </span>
                <button
                  type="button"
                  className="button button-outline button-sm"
                  onClick={() => {
                    if (isEditing) setShowDiscardModal(true)
                    else setIsEditing(true)
                  }}
                >
                  {isEditing ? 'Cerrar edición' : 'Editar datos'}
                </button>
              </div>
            </div>

            {isEditing ? (
              <form onSubmit={savePlanInfo} style={{ display: 'grid', gap: '14px' }}>
                <label>
                  Nombre del plan *
                  <input
                    required
                    maxLength="150"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                  />
                </label>

                <label>
                  Interfaz evaluada
                  <input
                    value={interfazEvaluada}
                    onChange={(e) => setInterfazEvaluada(e.target.value)}
                  />
                </label>

                <label>
                  Objetivo principal *
                  <textarea
                    required
                    value={objetivo}
                    onChange={(e) => setObjetivo(e.target.value)}
                  />
                </label>

                <div className="form-row">
                  <label>
                    Perfil de participantes
                    <input value={perfil} onChange={(e) => setPerfil(e.target.value)} />
                  </label>

                  <label>
                    Modalidad
                    <select value={modalidad} onChange={(e) => setModalidad(e.target.value)}>
                      {MODALIDADES_DISPONIBLES.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="form-row">
                  <label>
                    Número previsto de participantes
                    <input
                      type="number"
                      min="1"
                      value={numeroParticipantes}
                      onChange={(e) => setNumeroParticipantes(e.target.value)}
                    />
                  </label>

                  <label>
                    Estado del plan
                    <select value={estado} onChange={(e) => setEstado(e.target.value)}>
                      <option value="borrador">Borrador</option>
                      <option value="activo">Activo</option>
                      <option value="finalizado">Finalizado</option>
                    </select>
                  </label>
                </div>

                <div className="form-actions">
                  <button className="button button-primary" disabled={saving}>
                    {saving ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                  <button
                    type="button"
                    className="button button-outline"
                    onClick={() => setShowDiscardModal(true)}
                  >
                    Descartar
                  </button>
                </div>
              </form>
            ) : (
              <dl className="summary-grid">
                <div className="summary-field">
                  <dt>Interfaz evaluada</dt>
                  <dd>{interfazEvaluada || 'No especificada'}</dd>
                </div>
                <div className="summary-field">
                  <dt>Modalidad</dt>
                  <dd>
                    <span className="badge badge-primary">{modalidad}</span>
                  </dd>
                </div>
                <div className="summary-field">
                  <dt>Participantes previstos</dt>
                  <dd>{numeroParticipantes} participantes</dd>
                </div>
                <div className="summary-field">
                  <dt>Perfil de usuario</dt>
                  <dd>{perfil || 'Cualquier perfil'}</dd>
                </div>
                <div className="summary-field" style={{ gridColumn: '1 / -1' }}>
                  <dt>Objetivo del plan</dt>
                  <dd style={{ whiteSpace: 'pre-wrap' }}>{objetivo}</dd>
                </div>
              </dl>
            )}
          </section>

          {/* Listado de tareas */}
          <h2>Tareas del plan ({plan.tareas?.length ?? 0})</h2>
          <div className="record-list">
            {plan.tareas.map((task) => (
              <TaskEditor key={task.id} task={task} planId={id} onSaved={load} />
            ))}
          </div>

          <AddTask
            planId={id}
            nextOrder={Math.max(0, ...plan.tareas.map((task) => task.orden)) + 1}
            onSaved={load}
          />
        </>
      )}
    </>
  )
}

function TaskEditor({ task, planId, onSaved }) {
  const [isEditing, setIsEditing] = useState(false)
  const [titulo, setTitulo] = useState(task.titulo)
  const [codigo, setCodigo] = useState(task.codigo || '')
  const [criterioExito, setCriterioExito] = useState(task.criterio_exito || '')

  const parsed = deserializeTaskDescription(task.descripcion)
  const [consignaNeutral, setConsignaNeutral] = useState(parsed.consignaNeutral)
  const [resultadoEsperado, setResultadoEsperado] = useState(parsed.resultadoEsperado)
  const [metrica, setMetrica] = useState(parsed.metrica)

  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  async function save(event) {
    event.preventDefault()
    setError('')
    setSaved(false)
    setBusy(true)
    try {
      const descripcionSerializada = serializeTaskDescription({
        consignaNeutral,
        resultadoEsperado,
        metrica,
      })

      await plans.updateTask(planId, task.id, {
        titulo: titulo.trim(),
        descripcion: descripcionSerializada,
        criterio_exito: criterioExito.trim() || null,
        codigo: codigo.trim() || null,
      })

      setSaved(true)
      setIsEditing(false)
      onSaved()
    } catch (reason) {
      setError(reason.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="task-card-wizard">
      <header className="task-card-header">
        <div className="task-badge-group">
          <span className="badge badge-primary">Tarea {task.orden}</span>
          {task.codigo && <span className="badge badge-subtle">{task.codigo}</span>}
          <strong>{task.titulo}</strong>
        </div>
        <button
          type="button"
          className="button button-outline button-sm"
          onClick={() => setIsEditing(!isEditing)}
        >
          {isEditing ? 'Cerrar' : 'Editar'}
        </button>
      </header>

      {isEditing ? (
        <form onSubmit={save} style={{ display: 'grid', gap: '12px' }}>
          {error && <ErrorState message={error} />}

          <div className="form-row">
            <label>
              Código (opcional)
              <input maxLength="30" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
            </label>
            <label>
              Título *
              <input
                required
                maxLength="150"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
              />
            </label>
          </div>

          <label>
            Consigna neutral *
            <textarea
              required
              value={consignaNeutral}
              onChange={(e) => setConsignaNeutral(e.target.value)}
            />
          </label>

          <div className="form-row">
            <label>
              Resultado esperado
              <textarea
                value={resultadoEsperado}
                onChange={(e) => setResultadoEsperado(e.target.value)}
              />
            </label>
            <label>
              Criterio de éxito
              <textarea
                value={criterioExito}
                onChange={(e) => setCriterioExito(e.target.value)}
              />
            </label>
          </div>

          <label>
            Métrica
            <select value={metrica} onChange={(e) => setMetrica(e.target.value)}>
              {METRICAS_SUGERIDAS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          <div className="form-actions">
            <button className="button button-primary button-sm" disabled={busy}>
              {busy ? 'Guardando…' : 'Actualizar tarea'}
            </button>
            <button
              type="button"
              className="button button-outline button-sm"
              onClick={() => setIsEditing(false)}
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div style={{ display: 'grid', gap: '8px', fontSize: '14px' }}>
          {saved && <p className="notice" style={{ margin: 0 }}>Tarea guardada.</p>}
          <p>
            <strong>Consigna neutral:</strong> {consignaNeutral || task.descripcion}
          </p>
          {resultadoEsperado && (
            <p>
              <strong>Resultado esperado:</strong> {resultadoEsperado}
            </p>
          )}
          {metrica && (
            <p>
              <strong>Métrica:</strong> <span className="badge badge-subtle">{metrica}</span>
            </p>
          )}
          {task.criterio_exito && (
            <p>
              <strong>Criterio de éxito:</strong> {task.criterio_exito}
            </p>
          )}
        </div>
      )}
    </article>
  )
}

function AddTask({ planId, nextOrder, onSaved }) {
  const [open, setOpen] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [codigo, setCodigo] = useState(`T-0${nextOrder}`)
  const [consignaNeutral, setConsignaNeutral] = useState('')
  const [resultadoEsperado, setResultadoEsperado] = useState('')
  const [criterioExito, setCriterioExito] = useState('')
  const [metrica, setMetrica] = useState(METRICAS_SUGERIDAS[0])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function save(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const descripcion = serializeTaskDescription({
        consignaNeutral,
        resultadoEsperado,
        metrica,
      })

      await plans.addTask(planId, {
        titulo: titulo.trim(),
        descripcion,
        criterio_exito: criterioExito.trim() || null,
        codigo: codigo.trim() || null,
        orden: nextOrder,
      })

      setTitulo('')
      setConsignaNeutral('')
      setResultadoEsperado('')
      setCriterioExito('')
      setOpen(false)
      onSaved()
    } catch (reason) {
      setError(reason.message)
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className="button button-outline"
        onClick={() => setOpen(true)}
        style={{ marginTop: '10px' }}
      >
        Agregar nueva tarea al plan
      </button>
    )
  }

  return (
    <form className="form-panel" onSubmit={save} style={{ marginTop: '16px' }}>
      <h3>Nueva tarea {nextOrder}</h3>
      {error && <ErrorState message={error} />}

      <div className="form-row">
        <label>
          Código (opcional)
          <input maxLength="30" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
        </label>
        <label>
          Título *
          <input
            required
            maxLength="150"
            placeholder="Título de la tarea"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
          />
        </label>
      </div>

      <label>
        Consigna neutral *
        <textarea
          required
          placeholder="Indicación neutral sin guiar al usuario..."
          value={consignaNeutral}
          onChange={(e) => setConsignaNeutral(e.target.value)}
        />
      </label>

      <div className="form-row">
        <label>
          Resultado esperado
          <textarea
            placeholder="Resultado esperado..."
            value={resultadoEsperado}
            onChange={(e) => setResultadoEsperado(e.target.value)}
          />
        </label>
        <label>
          Criterio de éxito
          <textarea
            placeholder="Criterio de superación..."
            value={criterioExito}
            onChange={(e) => setCriterioExito(e.target.value)}
          />
        </label>
      </div>

      <label>
        Métrica
        <select value={metrica} onChange={(e) => setMetrica(e.target.value)}>
          {METRICAS_SUGERIDAS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>

      <div className="form-actions">
        <button className="button button-primary" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar y agregar tarea'}
        </button>
        <button
          type="button"
          className="button button-outline"
          onClick={() => setOpen(false)}
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
