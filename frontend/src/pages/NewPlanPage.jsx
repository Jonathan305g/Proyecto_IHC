import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import PageHeader from '../components/PageHeader.jsx'
import { ErrorState } from '../components/UiState.jsx'
import WizardStepper from '../components/WizardStepper.jsx'
import FieldError from '../components/FieldError.jsx'
import {
  MODALIDADES_DISPONIBLES,
  METRICAS_SUGERIDAS,
  createBlankTask,
  serializePlanObjective,
  serializeTaskDescription,
} from '../services/planHelpers.js'
import { plans } from '../services/persistence.js'

export default function NewPlanPage() {
  const navigate = useNavigate()

  // Control del asistente
  const [currentStep, setCurrentStep] = useState(1)
  const [maxReachedStep, setMaxReachedStep] = useState(1)

  // Paso 1: Datos generales
  const [nombre, setNombre] = useState('')
  const [interfazEvaluada, setInterfazEvaluada] = useState('')
  const [objetivo, setObjetivo] = useState('')
  const [perfil, setPerfil] = useState('')
  const [modalidad, setModalidad] = useState('Moderada remota')
  const [numeroParticipantes, setNumeroParticipantes] = useState('5')

  // Paso 2: Tareas y criterios
  const [tareas, setTareas] = useState([createBlankTask(0)])

  // Errores de validación en línea
  const [step1Errors, setStep1Errors] = useState({})
  const [step2Errors, setStep2Errors] = useState([])

  // Estado de persistencia
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // ----------------------------------------------------
  // Validaciones
  // ----------------------------------------------------
  function validateStep1() {
    const errors = {}
    if (!nombre.trim()) {
      errors.nombre = 'El nombre del plan es obligatorio.'
    } else if (nombre.trim().length > 150) {
      errors.nombre = 'El nombre no puede exceder 150 caracteres.'
    }

    if (!interfazEvaluada.trim()) {
      errors.interfazEvaluada = 'Indica la interfaz o módulo evaluado.'
    }

    if (!objetivo.trim()) {
      errors.objetivo = 'El objetivo de la prueba es obligatorio.'
    }

    if (!perfil.trim()) {
      errors.perfil = 'Especifica el perfil previsto de los participantes.'
    }

    if (!modalidad.trim()) {
      errors.modalidad = 'Selecciona una modalidad de evaluación.'
    }

    const participantsNum = Number.parseInt(numeroParticipantes, 10)
    if (!numeroParticipantes || Number.isNaN(participantsNum) || participantsNum < 1) {
      errors.numeroParticipantes = 'Ingresa un número previsto de participantes mayor o igual a 1.'
    }

    setStep1Errors(errors)
    return Object.keys(errors).length === 0
  }

  function validateStep2() {
    let hasError = false
    const taskErrorsList = tareas.map((task) => {
      const taskErrors = {}
      if (!task.titulo.trim()) {
        taskErrors.titulo = 'El título de la tarea es obligatorio.'
        hasError = true
      } else if (task.titulo.trim().length > 150) {
        taskErrors.titulo = 'El título no puede exceder 150 caracteres.'
        hasError = true
      }

      if (!task.consignaNeutral.trim()) {
        taskErrors.consignaNeutral = 'La consigna neutral es obligatoria para orientar la tarea.'
        hasError = true
      }

      if (!task.resultadoEsperado.trim()) {
        taskErrors.resultadoEsperado = 'Describe el resultado esperado de la tarea.'
        hasError = true
      }

      if (!task.metrica.trim()) {
        taskErrors.metrica = 'Selecciona o indica la métrica de evaluación.'
        hasError = true
      }

      if (!task.criterioExito.trim()) {
        taskErrors.criterioExito = 'Define el criterio de éxito para determinar la superación.'
        hasError = true
      }

      return taskErrors
    })

    if (tareas.length === 0) {
      hasError = true
    }

    setStep2Errors(taskErrorsList)
    return !hasError
  }

  // ----------------------------------------------------
  // Navegación entre pasos
  // ----------------------------------------------------
  function goToStep(step) {
    if (step === 2) {
      if (!validateStep1()) return
      setMaxReachedStep((prev) => Math.max(prev, 2))
      setCurrentStep(2)
    } else if (step === 3) {
      if (!validateStep1()) {
        setCurrentStep(1)
        return
      }
      if (!validateStep2()) return
      setMaxReachedStep((prev) => Math.max(prev, 3))
      setCurrentStep(3)
    } else {
      setCurrentStep(step)
    }
  }

  // ----------------------------------------------------
  // Gestión de tareas (Paso 2)
  // ----------------------------------------------------
  function editTask(index, field, value) {
    setTareas((prev) =>
      prev.map((task, i) => (i === index ? { ...task, [field]: value } : task)),
    )
    if (step2Errors[index]?.[field]) {
      setStep2Errors((prev) => {
        const copy = [...prev]
        if (copy[index]) {
          copy[index] = { ...copy[index], [field]: undefined }
        }
        return copy
      })
    }
  }

  function addTask() {
    setTareas((prev) => [...prev, createBlankTask(prev.length)])
    setStep2Errors((prev) => [...prev, {}])
  }

  function removeTask(index) {
    if (tareas.length <= 1) return
    setTareas((prev) => prev.filter((_, i) => i !== index))
    setStep2Errors((prev) => prev.filter((_, i) => i !== index))
  }

  function moveTask(index, direction) {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= tareas.length) return
    setTareas((prev) => {
      const copy = [...prev]
      const [moved] = copy.splice(index, 1)
      copy.splice(targetIndex, 0, moved)
      return copy
    })
    setStep2Errors((prev) => {
      const copy = [...prev]
      const [moved] = copy.splice(index, 1)
      copy.splice(targetIndex, 0, moved)
      return copy
    })
  }

  // ----------------------------------------------------
  // Guardado y Persistencia (Paso 3)
  // ----------------------------------------------------
  async function handleSavePlan(estadoDeseado = 'borrador') {
    setSubmitError('')
    if (!validateStep1()) {
      setCurrentStep(1)
      return
    }
    if (!validateStep2()) {
      setCurrentStep(2)
      return
    }

    setSaving(true)
    try {
      const objetivoSerializado = serializePlanObjective({
        objetivo,
        interfazEvaluada,
        perfil,
        modalidad,
        numeroParticipantes,
      })

      const payloadTareas = tareas.map((task, index) => ({
        titulo: task.titulo.trim(),
        descripcion: serializeTaskDescription({
          consignaNeutral: task.consignaNeutral,
          resultadoEsperado: task.resultadoEsperado,
          metrica: task.metrica,
        }),
        criterio_exito: task.criterioExito.trim() || null,
        codigo: task.codigo.trim() || null,
        orden: index + 1,
      }))

      const created = await plans.create({
        nombre: nombre.trim(),
        objetivo: objetivoSerializado,
        tareas: payloadTareas,
      })

      // Si se desea activar inmediatamente tras crear
      if (estadoDeseado === 'activo' && created.id) {
        await plans.update(created.id, { estado: 'activo' })
      }

      navigate(`/planes/${created.id}`)
    } catch (reason) {
      setSubmitError(reason.message || 'Ocurrió un error al guardar el plan de prueba.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="PLANIFICACIÓN / HU-01"
        title="Asistente de planes de prueba"
        description="Diseña y configura de forma asistida tu plan de evaluación de usabilidad, sus tareas y criterios de éxito."
      />

      <WizardStepper
        currentStep={currentStep}
        setStep={goToStep}
        maxReachedStep={maxReachedStep}
      />

      {submitError && <ErrorState message={submitError} />}

      {/* ==================================================== */}
      {/* PASO 1: DATOS GENERALES                              */}
      {/* ==================================================== */}
      {currentStep === 1 && (
        <section className="form-panel" aria-labelledby="step1-heading">
          <h2 id="step1-heading">Paso 1: Datos generales</h2>
          <p className="field-hint">
            Define la información fundamental de la evaluación de usabilidad y su alcance.
          </p>

          <label>
            Nombre del plan de prueba *
            <input
              type="text"
              maxLength="150"
              placeholder="Ej. Evaluación de usabilidad del flujo de checkout"
              value={nombre}
              className={step1Errors.nombre ? 'input-error' : ''}
              onChange={(e) => {
                setNombre(e.target.value)
                if (step1Errors.nombre) setStep1Errors({ ...step1Errors, nombre: undefined })
              }}
            />
            <FieldError error={step1Errors.nombre} />
          </label>

          <label>
            Interfaz o sistema evaluado *
            <input
              type="text"
              placeholder="Ej. Aplicación web de pagos v2.4 (módulo de carrito)"
              value={interfazEvaluada}
              className={step1Errors.interfazEvaluada ? 'input-error' : ''}
              onChange={(e) => {
                setInterfazEvaluada(e.target.value)
                if (step1Errors.interfazEvaluada)
                  setStep1Errors({ ...step1Errors, interfazEvaluada: undefined })
              }}
            />
            <FieldError error={step1Errors.interfazEvaluada} />
          </label>

          <label>
            Objetivo de la evaluación *
            <textarea
              placeholder="Describe qué aspectos de la usabilidad se van a verificar y qué hipótesis se desean validar."
              value={objetivo}
              className={step1Errors.objetivo ? 'input-error' : ''}
              onChange={(e) => {
                setObjetivo(e.target.value)
                if (step1Errors.objetivo) setStep1Errors({ ...step1Errors, objetivo: undefined })
              }}
            />
            <FieldError error={step1Errors.objetivo} />
          </label>

          <div className="form-row">
            <label>
              Perfil de participantes previsto *
              <input
                type="text"
                placeholder="Ej. Usuarios frecuentes con compras previas"
                value={perfil}
                className={step1Errors.perfil ? 'input-error' : ''}
                onChange={(e) => {
                  setPerfil(e.target.value)
                  if (step1Errors.perfil) setStep1Errors({ ...step1Errors, perfil: undefined })
                }}
              />
              <FieldError error={step1Errors.perfil} />
            </label>

            <label>
              Modalidad de evaluación *
              <select
                value={modalidad}
                className={step1Errors.modalidad ? 'input-error' : ''}
                onChange={(e) => {
                  setModalidad(e.target.value)
                  if (step1Errors.modalidad) setStep1Errors({ ...step1Errors, modalidad: undefined })
                }}
              >
                {MODALIDADES_DISPONIBLES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <FieldError error={step1Errors.modalidad} />
            </label>
          </div>

          <label>
            Número previsto de participantes *
            <input
              type="number"
              min="1"
              max="500"
              value={numeroParticipantes}
              className={step1Errors.numeroParticipantes ? 'input-error' : ''}
              onChange={(e) => {
                setNumeroParticipantes(e.target.value)
                if (step1Errors.numeroParticipantes)
                  setStep1Errors({ ...step1Errors, numeroParticipantes: undefined })
              }}
            />
            <span className="field-hint">
              Recomendación técnica: 5 a 8 participantes permiten detectar más del 80% de problemas de usabilidad.
            </span>
            <FieldError error={step1Errors.numeroParticipantes} />
          </label>

          <div className="form-actions">
            <button
              type="button"
              className="button button-primary"
              onClick={() => goToStep(2)}
            >
              Siguiente: Tareas y criterios →
            </button>
            <Link className="button button-outline" to="/planes">
              Cancelar
            </Link>
          </div>
        </section>
      )}

      {/* ==================================================== */}
      {/* PASO 2: TAREAS Y CRITERIOS                           */}
      {/* ==================================================== */}
      {currentStep === 2 && (
        <section className="form-panel" aria-labelledby="step2-heading">
          <h2 id="step2-heading">Paso 2: Tareas y criterios</h2>
          <p className="field-hint">
            Configura las actividades individuales que ejecutarán los participantes, asegurando consignas neutrales para no sesgar el comportamiento.
          </p>

          <div className="record-list">
            {tareas.map((task, index) => {
              const errs = step2Errors[index] || {}
              return (
                <div key={index} className="task-card-wizard">
                  <header className="task-card-header">
                    <div className="task-badge-group">
                      <span className="badge badge-primary">Tarea {index + 1}</span>
                      {task.codigo && <span className="badge badge-subtle">{task.codigo}</span>}
                    </div>
                    <div className="task-actions">
                      <button
                        type="button"
                        className="button button-ghost button-sm"
                        title="Subir tarea"
                        disabled={index === 0}
                        onClick={() => moveTask(index, -1)}
                      >
                        ▲ Subir
                      </button>
                      <button
                        type="button"
                        className="button button-ghost button-sm"
                        title="Bajar tarea"
                        disabled={index === tareas.length - 1}
                        onClick={() => moveTask(index, 1)}
                      >
                        ▼ Bajar
                      </button>
                      {tareas.length > 1 && (
                        <button
                          type="button"
                          className="button button-danger button-sm"
                          title="Eliminar tarea"
                          onClick={() => removeTask(index)}
                        >
                          ✕ Quitar
                        </button>
                      )}
                    </div>
                  </header>

                  <div className="form-row">
                    <label>
                      Código de tarea (opcional)
                      <input
                        type="text"
                        maxLength="30"
                        placeholder={`T-0${index + 1}`}
                        value={task.codigo}
                        onChange={(e) => editTask(index, 'codigo', e.target.value)}
                      />
                    </label>

                    <label>
                      Título de la tarea *
                      <input
                        type="text"
                        maxLength="150"
                        placeholder="Ej. Registrar un nuevo método de pago"
                        value={task.titulo}
                        className={errs.titulo ? 'input-error' : ''}
                        onChange={(e) => editTask(index, 'titulo', e.target.value)}
                      />
                      <FieldError error={errs.titulo} />
                    </label>
                  </div>

                  <label>
                    Consigna neutral *
                    <textarea
                      placeholder="Redacta la indicación que se leerá al usuario sin pistas sobre la solución (ej. 'Utilizando la plataforma, completa la compra de tu carrito usando tarjeta')."
                      value={task.consignaNeutral}
                      className={errs.consignaNeutral ? 'input-error' : ''}
                      onChange={(e) => editTask(index, 'consignaNeutral', e.target.value)}
                    />
                    <FieldError error={errs.consignaNeutral} />
                  </label>

                  <div className="form-row">
                    <label>
                      Resultado esperado *
                      <textarea
                        placeholder="Qué estado o pantalla final evidencia el éxito de la tarea."
                        value={task.resultadoEsperado}
                        className={errs.resultadoEsperado ? 'input-error' : ''}
                        onChange={(e) => editTask(index, 'resultadoEsperado', e.target.value)}
                      />
                      <FieldError error={errs.resultadoEsperado} />
                    </label>

                    <label>
                      Criterio de éxito *
                      <textarea
                        placeholder="Condiciones específicas para dar por superada la tarea (ej. Completada en menos de 2 minutos sin errores críticos)."
                        value={task.criterioExito}
                        className={errs.criterioExito ? 'input-error' : ''}
                        onChange={(e) => editTask(index, 'criterioExito', e.target.value)}
                      />
                      <FieldError error={errs.criterioExito} />
                    </label>
                  </div>

                  <label>
                    Métrica de evaluación *
                    <select
                      value={task.metrica}
                      className={errs.metrica ? 'input-error' : ''}
                      onChange={(e) => editTask(index, 'metrica', e.target.value)}
                    >
                      {METRICAS_SUGERIDAS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <FieldError error={errs.metrica} />
                  </label>
                </div>
              )
            })}
          </div>

          <button
            type="button"
            className="button button-outline"
            onClick={addTask}
            style={{ width: '100%', marginTop: '10px' }}
          >
            + Agregar otra tarea al plan
          </button>

          <div className="form-actions">
            <button
              type="button"
              className="button button-outline"
              onClick={() => setCurrentStep(1)}
            >
              ← Anterior: Datos generales
            </button>
            <button
              type="button"
              className="button button-primary"
              onClick={() => goToStep(3)}
            >
              Siguiente: Revisar y guardar →
            </button>
          </div>
        </section>
      )}

      {/* ==================================================== */}
      {/* PASO 3: REVISAR Y GUARDAR                            */}
      {/* ==================================================== */}
      {currentStep === 3 && (
        <section className="form-panel" aria-labelledby="step3-heading">
          <h2 id="step3-heading">Paso 3: Revisar y guardar</h2>
          <p className="field-hint">
            Comprueba toda la información antes de guardar el plan. Puedes guardarlo como borrador o activarlo de inmediato para iniciar sesiones.
          </p>

          <h3>Resumen de datos generales</h3>
          <dl className="summary-grid">
            <div className="summary-field">
              <dt>Nombre del plan</dt>
              <dd>{nombre}</dd>
            </div>
            <div className="summary-field">
              <dt>Interfaz evaluada</dt>
              <dd>{interfazEvaluada}</dd>
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
            <div className="summary-field" style={{ gridColumn: '1 / -1' }}>
              <dt>Perfil de usuario</dt>
              <dd>{perfil}</dd>
            </div>
            <div className="summary-field" style={{ gridColumn: '1 / -1' }}>
              <dt>Objetivo</dt>
              <dd>{objetivo}</dd>
            </div>
          </dl>

          <h3>Tareas configuradas ({tareas.length})</h3>
          <div className="review-tasks-list">
            {tareas.map((task, index) => (
              <article key={index} className="review-task-item">
                <h4>
                  <span>
                    #{index + 1} — {task.titulo}
                  </span>
                  {task.codigo && <span className="badge badge-subtle">{task.codigo}</span>}
                </h4>
                <p>
                  <strong>Consigna neutral:</strong> {task.consignaNeutral}
                </p>
                <p>
                  <strong>Resultado esperado:</strong> {task.resultadoEsperado}
                </p>
                <p>
                  <strong>Métrica:</strong> {task.metrica}
                </p>
                {task.criterioExito && (
                  <p>
                    <strong>Criterio de éxito:</strong> {task.criterioExito}
                  </p>
                )}
              </article>
            ))}
          </div>

          <div className="form-actions" style={{ marginTop: '24px' }}>
            <button
              type="button"
              className="button button-outline"
              disabled={saving}
              onClick={() => setCurrentStep(2)}
            >
              ← Anterior: Editar tareas
            </button>

            <button
              type="button"
              className="button button-outline"
              disabled={saving}
              onClick={() => handleSavePlan('borrador')}
            >
              {saving ? 'Guardando…' : '📁 Guardar como borrador'}
            </button>

            <button
              type="button"
              className="button button-success"
              disabled={saving}
              onClick={() => handleSavePlan('activo')}
            >
              {saving ? 'Guardando…' : '🚀 Guardar y activar plan'}
            </button>

            <Link className="button button-ghost" to="/planes">
              Cancelar
            </Link>
          </div>
        </section>
      )}
    </>
  )
}
