import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import PageHeader from '../components/PageHeader.jsx'
import { ErrorState } from '../components/UiState.jsx'
import { plans } from '../services/persistence.js'

const blankTask = () => ({ titulo: '', descripcion: '', criterio_exito: '', codigo: '' })

export default function NewPlanPage() {
  const navigate = useNavigate()
  const [nombre, setNombre] = useState('')
  const [objetivo, setObjetivo] = useState('')
  const [tareas, setTareas] = useState([blankTask()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function editTask(index, field, value) {
    setTareas((previous) => previous.map((task, position) => position === index ? { ...task, [field]: value } : task))
  }

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const created = await plans.create({ nombre, objetivo, tareas: tareas.map((task, index) => ({
        ...task, criterio_exito: task.criterio_exito || null, codigo: task.codigo || null, orden: index + 1,
      })) })
      navigate(`/planes/${created.id}`)
    } catch (reason) { setError(reason.message) }
    finally { setSaving(false) }
  }

  return <>
    <PageHeader eyebrow="PLANIFICACIÓN" title="Nuevo plan de prueba" description="Guarda el plan junto con todas sus tareas." />
    {error && <ErrorState message={error} />}
    <form className="form-panel" onSubmit={submit}>
      <label>Nombre del plan<input required maxLength="150" value={nombre} onChange={(e) => setNombre(e.target.value)} /></label>
      <label>Objetivo<textarea required value={objetivo} onChange={(e) => setObjetivo(e.target.value)} /></label>
      <h2>Tareas</h2>
      {tareas.map((task, index) => <fieldset key={index}>
        <legend>Tarea {index + 1}</legend>
        <label>Título<input required maxLength="150" value={task.titulo} onChange={(e) => editTask(index, 'titulo', e.target.value)} /></label>
        <label>Descripción<textarea required value={task.descripcion} onChange={(e) => editTask(index, 'descripcion', e.target.value)} /></label>
        <label>Criterio de éxito<textarea value={task.criterio_exito} onChange={(e) => editTask(index, 'criterio_exito', e.target.value)} /></label>
        <label>Código equivalente<input maxLength="30" value={task.codigo} onChange={(e) => editTask(index, 'codigo', e.target.value)} /></label>
        {tareas.length > 1 && <button className="button button-outline" type="button" onClick={() => setTareas((previous) => previous.filter((_, position) => position !== index))}>Quitar tarea</button>}
      </fieldset>)}
      <button className="button button-outline" type="button" onClick={() => setTareas((previous) => [...previous, blankTask()])}>Agregar tarea</button>
      <div className="form-actions"><button className="button button-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar plan'}</button><Link className="button button-outline" to="/planes">Cancelar</Link></div>
    </form>
  </>
}
