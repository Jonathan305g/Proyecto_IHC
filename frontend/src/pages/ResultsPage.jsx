import PageHeader from '../components/PageHeader.jsx'
import { EmptyState } from '../components/UiState.jsx'

export default function ResultsPage() {
  return (
    <>
      <PageHeader
        eyebrow="ANÁLISIS"
        title="Resultados"
        description="Consulta los resultados y las evidencias de las sesiones completadas."
      />
      <EmptyState
        title="Todavía no hay resultados"
        description="Completa una sesión de prueba para poder revisar aquí sus resultados."
        actionLabel="Ver sesiones"
        actionTo="/sesiones"
      />
    </>
  )
}
