import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import PageHeader from '../components/PageHeader.jsx'
import { ErrorState, LoadingState } from '../components/UiState.jsx'
import { sessions } from '../services/persistence.js'

export default function SessionDetailPage() {
  const { id } = useParams()
  const [session, setSession] = useState(null)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const load = useCallback(() => {
    setError('')
    sessions.detail(id).then(setSession).catch((reason) => setError(reason.message))
  }, [id])
  useEffect(() => { load() }, [load])

  async function change(action) {
    setBusy(true); setError('')
    try { setSession(await sessions.update(id, { accion: action, consentimiento_confirmado: consent })) }
    catch (reason) { setError(reason.message) }
    finally { setBusy(false) }
  }

  return <>
    <PageHeader eyebrow="EJECUCIÓN" title={session ? `Sesión de ${session.participante_codigo}` : 'Detalle de sesión'} description="El avance guardado permanece disponible al recargar o reabrir esta dirección." />
    {error && <ErrorState message={error} onRetry={load} />}
    {!session && !error && <LoadingState />}
    {session && <section className="form-panel">
      <p><strong>Plan:</strong> <Link to={`/planes/${session.plan_id}`}>{session.plan_nombre}</Link></p>
      <p><strong>Estado:</strong> {session.estado}</p>
      {session.estado === 'pendiente' && <>
        <label className="checkbox-label"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> Confirmo que se obtuvo el consentimiento del participante.</label>
        <button className="button button-primary" disabled={!consent || busy} onClick={() => change('iniciar')}>Iniciar sesión</button>
      </>}
      {session.estado === 'en_curso' && <button className="button button-primary" disabled={busy} onClick={() => change('cerrar')}>Cerrar sesión</button>}
      <h2>Tareas</h2><ol>{session.tareas.map((task) => <li key={task.id}>{task.titulo}</li>)}</ol>
      <Link className="button button-outline" to="/sesiones">Volver a sesiones</Link>
    </section>}
  </>
}
