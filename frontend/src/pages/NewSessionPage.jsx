import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import PageHeader from '../components/PageHeader.jsx'
import { ErrorState, LoadingState } from '../components/UiState.jsx'
import { plans, sessions } from '../services/persistence.js'

export default function NewSessionPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState(null)
  const [planId, setPlanId] = useState('')
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => { plans.list().then(setItems).catch((reason) => setError(reason.message)) }, [])

  async function submit(event) {
    event.preventDefault(); setSaving(true); setError('')
    try {
      const saved = await sessions.create({ plan_id: planId, codigo_participante: codigo })
      navigate(`/sesiones/${saved.id}`)
    } catch (reason) { setError(reason.message) }
    finally { setSaving(false) }
  }
  return <>
    <PageHeader eyebrow="EJECUCIÓN" title="Nueva sesión" description="Usa un código anónimo, sin nombre ni correo del participante." />
    {error && <ErrorState message={error} />}
    {items === null && !error && <LoadingState />}
    {items && (items.length === 0 ? <p className="notice">Primero crea un plan de prueba.</p>
      : <form className="form-panel" onSubmit={submit}>
        <label>Plan de prueba<select required value={planId} onChange={(e) => setPlanId(e.target.value)}><option value="">Selecciona un plan</option>{items.map((plan) => <option key={plan.id} value={plan.id}>{plan.nombre}</option>)}</select></label>
        <label>Código anónimo<input required maxLength="30" placeholder="P-001" value={codigo} onChange={(e) => setCodigo(e.target.value)} /></label>
        <div className="form-actions"><button className="button button-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar sesión'}</button><Link className="button button-outline" to="/sesiones">Cancelar</Link></div>
      </form>)}
  </>
}
