import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import PageHeader from '../components/PageHeader.jsx'
import { ErrorState, LoadingState } from '../components/UiState.jsx'
import { plans } from '../services/persistence.js'

export default function PlanDetailPage() {
  const { id } = useParams()
  const [plan, setPlan] = useState(null)
  const [nombre, setNombre] = useState('')
  const [objetivo, setObjetivo] = useState('')
  const [estado, setEstado] = useState('borrador')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const load = useCallback(() => {
    setError('')
    plans.detail(id).then((value) => {
      setPlan(value); setNombre(value.nombre); setObjetivo(value.objetivo); setEstado(value.estado)
    }).catch((reason) => setError(reason.message))
  }, [id])
  useEffect(() => { load() }, [load])

  async function save(event) {
    event.preventDefault()
    setError(''); setMessage('')
    try {
      const updated = await plans.update(id, { nombre, objetivo, estado })
      setPlan(updated); setMessage('Cambios guardados.')
    } catch (reason) { setError(reason.message) }
  }

  return <>
    <PageHeader eyebrow="PLANIFICACIÓN" title={plan?.nombre ?? 'Detalle del plan'} description="Puedes volver a abrir este plan después de recargar la página." />
    {error && <ErrorState message={error} onRetry={load} />}
    {!plan && !error && <LoadingState />}
    {plan && <>
      {message && <p className="notice" role="status">{message}</p>}
      <form className="form-panel" onSubmit={save}>
        <label>Nombre<input required maxLength="150" value={nombre} onChange={(e) => setNombre(e.target.value)} /></label>
        <label>Objetivo<textarea required value={objetivo} onChange={(e) => setObjetivo(e.target.value)} /></label>
        <label>Estado<select value={estado} onChange={(e) => setEstado(e.target.value)}><option value="borrador">Borrador</option><option value="activo">Activo</option><option value="finalizado">Finalizado</option></select></label>
        <button className="button button-primary">Guardar cambios</button>
      </form>
      <h2>Tareas del plan</h2>
      <div className="record-list">{plan.tareas.map((task) => <TaskEditor key={task.id} task={task} planId={id} onSaved={load} />)}</div>
      <AddTask planId={id} nextOrder={Math.max(0, ...plan.tareas.map((task) => task.orden)) + 1} onSaved={load} />
      <p><Link className="button button-outline" to="/planes">Volver a planes</Link></p>
    </>}
  </>
}

function AddTask({ planId, nextOrder, onSaved }) {
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [error, setError] = useState('')
  async function save(event) {
    event.preventDefault(); setError('')
    try {
      await plans.addTask(planId, { titulo, descripcion, orden: nextOrder })
      setTitulo(''); setDescripcion(''); onSaved()
    } catch (reason) { setError(reason.message) }
  }
  return <form className="form-panel" onSubmit={save}>
    <h2>Agregar tarea</h2>
    <label>Título<input required maxLength="150" value={titulo} onChange={(e) => setTitulo(e.target.value)} /></label>
    <label>Descripción<textarea required value={descripcion} onChange={(e) => setDescripcion(e.target.value)} /></label>
    {error && <ErrorState message={error} />}
    <button className="button button-outline">Agregar al plan</button>
  </form>
}

function TaskEditor({ task, planId, onSaved }) {
  const [titulo, setTitulo] = useState(task.titulo)
  const [descripcion, setDescripcion] = useState(task.descripcion)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  async function save(event) {
    event.preventDefault(); setError(''); setSaved(false)
    try {
      await plans.updateTask(planId, task.id, { titulo, descripcion })
      setSaved(true); onSaved()
    } catch (reason) { setError(reason.message) }
  }
  return <form className="form-panel" onSubmit={save}>
    <h3>Tarea {task.orden}</h3>
    <label>Título<input required maxLength="150" value={titulo} onChange={(e) => setTitulo(e.target.value)} /></label>
    <label>Descripción<textarea required value={descripcion} onChange={(e) => setDescripcion(e.target.value)} /></label>
    {error && <ErrorState message={error} />}{saved && <p role="status">Tarea guardada.</p>}
    <button className="button button-outline">Actualizar tarea</button>
  </form>
}
