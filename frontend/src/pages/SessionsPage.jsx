import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import PageHeader from '../components/PageHeader.jsx'
import { EmptyState, ErrorState, LoadingState } from '../components/UiState.jsx'
import { sessions } from '../services/persistence.js'
import '../execution.css'

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
          : <div className="record-list">{items.map((session) => {
              const estados = { pendiente: 'Pendiente de iniciar', en_curso: 'En curso', cerrada: 'Cerrada' }
              const closed = session.estado === 'cerrada'
              return <article className="record-card" key={session.id}>
                <strong>{session.plan_nombre}</strong>
                <span>Participante: {session.participante_codigo}</span>
                <small>Estado: {estados[session.estado] ?? session.estado}</small>
                {session.cupo_completo && <p className="badge badge-warning">Cupo completo: puedes continuar esta sesión, pero no abrir otra en este plan.</p>}
                <div className="run-card-actions">
                  {!closed && <Link className="button button-primary" to={`/sesiones/${session.id}/ejecutar`}>{session.estado === 'en_curso' ? 'Continuar sesión' : 'Ir a la sesión'}<span className="visually-hidden"> de {session.participante_codigo}</span></Link>}
                  <Link className="button button-outline" to={closed ? `/sesiones/${session.id}/ejecutar` : `/sesiones/${session.id}`}>{closed ? 'Ver resumen' : 'Ver detalle'}<span className="visually-hidden"> de {session.participante_codigo}</span></Link>
                </div>
              </article>
            })}</div>}
    </>
  )
}
