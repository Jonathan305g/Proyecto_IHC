import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import PageHeader from '../components/PageHeader.jsx'
import { EmptyState, ErrorState, LoadingState } from '../components/UiState.jsx'
import { sessions } from '../services/persistence.js'

export default function SessionsPage() {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const load = useCallback(() => {
    setError('')
    sessions.list().then(setItems).catch((reason) => setError(reason.message))
  }, [])
  useEffect(() => { load() }, [load])
  return (
    <>
      <PageHeader
        eyebrow="EJECUCIÓN"
        title="Sesiones de prueba"
        description="Registra el avance y las observaciones de cada participante durante la prueba."
        action={<Link className="button button-primary" to="/sesiones/nueva">Nueva sesión</Link>}
      />
      {error ? <ErrorState message={error} onRetry={load} /> : items === null ? <LoadingState />
        : items.length === 0 ? <EmptyState title="Todavía no hay sesiones" description="Crea un plan y luego registra una sesión." actionLabel="Ir a planes" actionTo="/planes" />
          : <div className="record-list">{items.map((session) =>
              <Link className="record-card" key={session.id} to={`/sesiones/${session.id}`}>
                <strong>{session.plan_nombre}</strong><span>Participante: {session.participante_codigo}</span><small>Estado: {session.estado}</small>
              </Link>)}</div>}
    </>
  )
}
