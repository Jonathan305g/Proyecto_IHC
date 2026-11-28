import { Link } from 'react-router'
import PageHeader from '../components/PageHeader.jsx'

export default function UpcomingPage({ title, section }) {
  return (
    <>
      <PageHeader eyebrow={section.toUpperCase()} title={title} description="Estructura de navegación preparada para incorporar este flujo en el siguiente trabajo del Sprint 2." />
      <section className="state-panel" aria-label="Módulo en construcción">
        <span className="state-icon" aria-hidden="true">◇</span>
        <h2>Módulo en construcción</h2>
        <p>El formulario y su guardado se integrarán cuando estén listos los servicios y el contrato de datos.</p>
        <Link className="button button-outline" to={section === 'Planes' ? '/planes' : '/sesiones'}>Volver a {section.toLowerCase()}</Link>
      </section>
    </>
  )
}
