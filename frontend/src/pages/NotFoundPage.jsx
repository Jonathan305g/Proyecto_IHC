import { Link } from 'react-router'
import PageHeader from '../components/PageHeader.jsx'

export default function NotFoundPage() {
  return (
    <>
      <PageHeader eyebrow="NAVEGACIÓN" title="Página no encontrada" description="La dirección solicitada no corresponde a una pantalla disponible." />
      <Link className="button button-primary" to="/planes">Volver a Planes</Link>
    </>
  )
}
