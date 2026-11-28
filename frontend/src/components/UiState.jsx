import { Link } from 'react-router'

export function EmptyState({ title, description, actionLabel, actionTo }) {
  return (
    <section className="state-panel" aria-label={title}>
      <span className="state-icon" aria-hidden="true">＋</span>
      <h2>{title}</h2>
      <p>{description}</p>
      {actionLabel && actionTo && <Link className="button button-primary" to={actionTo}>{actionLabel}</Link>}
    </section>
  )
}

export function LoadingState({ label = 'Cargando información…' }) {
  return <p className="notice" role="status" aria-live="polite">{label}</p>
}

export function ErrorState({ message = 'No se pudieron cargar los datos.', onRetry }) {
  return (
    <div className="notice notice-error" role="alert">
      <span>{message}</span>
      {onRetry && <button className="button button-outline" type="button" onClick={onRetry}>Reintentar</button>}
    </div>
  )
}
