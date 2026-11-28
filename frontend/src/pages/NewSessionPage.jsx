import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import FieldError from '../components/FieldError.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { ErrorState, LoadingState } from '../components/UiState.jsx'
import { plans, sessions } from '../services/persistence.js'

export default function NewSessionPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState(null)
  const [planId, setPlanId] = useState('')
  const [codigo, setCodigo] = useState('')
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const planRef = useRef(null)
  const codeRef = useRef(null)
  useEffect(() => { plans.list().then(setItems).catch((reason) => setError(reason.message)) }, [])

  function validate() {
    const found = {}
    if (!planId) found.plan = 'Selecciona el plan de prueba al que pertenece la sesión.'
    const trimmed = codigo.trim()
    if (!trimmed) found.codigo = 'Escribe el código anónimo del participante, por ejemplo P-001.'
    else if (trimmed.length > 30) found.codigo = 'El código admite hasta 30 caracteres.'
    return found
  }

  async function submit(event) {
    event.preventDefault(); setError('')
    const found = validate()
    setErrors(found)
    if (found.plan || found.codigo) { (found.plan ? planRef : codeRef).current?.focus(); return }
    setSaving(true)
    try {
      const saved = await sessions.create({ plan_id: planId, codigo_participante: codigo.trim() })
      navigate(`/sesiones/${saved.id}`)
    } catch (reason) { setError(reason.message) }
    finally { setSaving(false) }
  }
  return <>
    <PageHeader eyebrow="EJECUCIÓN" title="Nueva sesión" description="Usa un código anónimo, sin nombre ni correo del participante." />
    {error && <ErrorState message={`No se pudo guardar la sesión. ${error}`} />}
    {items === null && !error && <LoadingState label="Cargando los planes disponibles…" />}
    {items && (items.length === 0 ? <p className="notice">Primero crea un plan de prueba para poder registrar sesiones.</p>
      : <form className="form-panel" onSubmit={submit} noValidate>
        <label>Plan de prueba *
          <select ref={planRef} value={planId} aria-invalid={Boolean(errors.plan)} aria-describedby={errors.plan ? 'error-plan' : undefined} onChange={(e) => { setPlanId(e.target.value); setErrors((c) => ({ ...c, plan: undefined })) }}>
            <option value="">Selecciona un plan</option>{items.map((plan) => <option key={plan.id} value={plan.id}>{plan.nombre}</option>)}
          </select>
          <FieldError id="error-plan" error={errors.plan} />
        </label>
        <label>Código anónimo del participante *
          <span className="field-hint" id="ayuda-codigo">Formato sugerido: P-001. No escribas nombres, correos ni cédulas.</span>
          <input ref={codeRef} maxLength="30" value={codigo} aria-invalid={Boolean(errors.codigo)} aria-describedby={errors.codigo ? 'ayuda-codigo error-codigo' : 'ayuda-codigo'} onChange={(e) => { setCodigo(e.target.value); setErrors((c) => ({ ...c, codigo: undefined })) }} />
          <FieldError id="error-codigo" error={errors.codigo} />
        </label>
        <div className="form-actions"><button className="button button-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar sesión'}</button><Link className="button button-outline" to="/sesiones">Cancelar</Link></div>
      </form>)}
  </>
}
