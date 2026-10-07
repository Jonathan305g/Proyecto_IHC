import { Link } from 'react-router'
import PageHeader from '../components/PageHeader.jsx'
import { EmptyState } from '../components/UiState.jsx'

export default function PlansPage() {
  return (
    <>
      <PageHeader
        eyebrow="PLANIFICACIÓN"
        title="Planes de prueba"
        description="Organiza las tareas, participantes y objetivos de cada evaluación de usabilidad."
        action={<Link className="button button-primary" to="/planes/nuevo">Nuevo plan</Link>}
      />
      <EmptyState
        title="Todavía no hay planes"
        description="Aquí se mostrarán los planes guardados cuando se incorpore su creación y consulta."
        actionLabel="Preparar un plan"
        actionTo="/planes/nuevo"
      />
    </>
  )
}
