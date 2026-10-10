import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import PageHeader from '../components/PageHeader.jsx'
import { EmptyState, ErrorState, LoadingState } from '../components/UiState.jsx'
import { plans } from '../services/persistence.js'

export default function PlansPage() {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const load = useCallback(() => {
    setError('')
    plans.list().then(setItems).catch((reason) => setError(reason.message))
  }, [])
  useEffect(() => { load() }, [load])

  return (
    <>
      <PageHeader
        eyebrow="PLANIFICACIÓN"
        title="Planes de prueba"
        description="Organiza las tareas y objetivos de cada evaluación de usabilidad."
        action={<Link className="button button-primary" to="/planes/nuevo">Nuevo plan</Link>}
      />
      {error ? <ErrorState message={error} onRetry={load} /> : items === null ? <LoadingState />
        : items.length === 0 ? <EmptyState title="Todavía no hay planes" description="Crea un plan para comenzar." actionLabel="Preparar un plan" actionTo="/planes/nuevo" />
          : <div className="record-list">{items.map((plan) =>
              <Link className="record-card" key={plan.id} to={`/planes/${plan.id}`}>
                <strong>{plan.nombre}</strong><span>{plan.objetivo}</span><small>Estado: {plan.estado}</small>
              </Link>)}</div>}
    </>
  )
}
