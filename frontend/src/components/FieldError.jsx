/**
 * Componente accesible para renderizar errores de validación junto al campo correspondiente.
 */
export default function FieldError({ error }) {
  if (!error) return null

  return (
    <span className="field-error" role="alert">
      <svg
        aria-hidden="true"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      {error}
    </span>
  )
}
