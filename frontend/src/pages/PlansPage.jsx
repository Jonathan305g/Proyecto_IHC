import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import PageHeader from '../components/PageHeader.jsx'
import { EmptyState, ErrorState, LoadingState } from '../components/UiState.jsx'
import { plans } from '../services/persistence.js'
import { deserializePlanObjective } from '../services/planHelpers.js'

export default function PlansPage() {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setError('')
    plans
      .list()
      .then(setItems)
      .catch((reason) => setError(reason.message))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <>
      <PageHeader
        eyebrow="PLANIFICACIÓN / HU-01"
        title="Planes de prueba"
        description="Organiza las tareas, criterios de éxito y objetivos de cada evaluación de usabilidad."
        action={
          <Link className="button button-primary" to="/planes/nuevo">
            + Nuevo plan (Asistente)
          </Link>
        }
      />

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : items === null ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <EmptyState
          title="Todavía no hay planes de prueba"
          description="Diseña tu primer plan de evaluación de usabilidad con el asistente guiado."
          actionLabel="Iniciar asistente de plan"
          actionTo="/planes/nuevo"
        />
      ) : (
        <div className="record-list">
          {items.map((plan) => {
            const parsed = deserializePlanObjective(plan.objetivo)
            return (
              <Link className="record-card" key={plan.id} to={`/planes/${plan.id}`}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <strong style={{ fontSize: '16px', color: '#173d66' }}>{plan.nombre}</strong>
                  <span
                    className={`badge ${
                      plan.estado === 'activo'
                        ? 'badge-active'
                        : plan.estado === 'borrador'
                        ? 'badge-draft'
                        : 'badge-subtle'
                    }`}
                  >
                    {plan.estado.toUpperCase()}
                  </span>
                </div>
                <span>{parsed.objetivo}</span>
                <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#526476' }}>
                  {parsed.interfazEvaluada && (
                    <span>
                      <strong>Interfaz:</strong> {parsed.interfazEvaluada}
                    </span>
                  )}
                  {parsed.modalidad && (
                    <span>
                      <strong>Modalidad:</strong> {parsed.modalidad}
                    </span>
                  )}
                  {parsed.numeroParticipantes && (
                    <span>
                      <strong>Previsto:</strong> {parsed.numeroParticipantes} participantes
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}
