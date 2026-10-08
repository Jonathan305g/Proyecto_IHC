import { Link } from 'react-router'
import PageHeader from '../components/PageHeader.jsx'
import { EmptyState } from '../components/UiState.jsx'

export default function SessionsPage() {
  return (
    <>
      <PageHeader
        eyebrow="EJECUCIÓN"
        title="Sesiones de prueba"
        description="Registra el avance y las observaciones de cada participante durante la prueba."
        action={<Link className="button button-primary" to="/sesiones/nueva">Nueva sesión</Link>}
      />
      <EmptyState
        title="Todavía no hay sesiones"
        description="Las sesiones se podrán iniciar cuando exista al menos un plan de prueba guardado."
        actionLabel="Ir a planes"
        actionTo="/planes"
      />
    </>
  )
}
