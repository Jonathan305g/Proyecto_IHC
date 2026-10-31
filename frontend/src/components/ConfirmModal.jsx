import { useEffect, useId, useRef } from 'react'

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Diálogo modal accesible para confirmaciones de acción (cancelar o eliminar).
 * Al abrirse lleva el foco al botón seguro, lo mantiene dentro del diálogo, se cierra con Escape
 * y devuelve el foco al elemento que lo abrió.
 */
export default function ConfirmModal({ isOpen, title, message, confirmText = 'Confirmar', cancelText = 'Cancelar', isDanger = false, busy = false, onConfirm, onCancel }) {
  const dialogRef = useRef(null)
  const cancelRef = useRef(null)
  const baseId = useId()
  const titleId = `${baseId}-titulo`
  const messageId = `${baseId}-mensaje`

  useEffect(() => {
    if (!isOpen) return undefined
    const opener = document.activeElement
    cancelRef.current?.focus()
    return () => { if (opener instanceof HTMLElement && document.contains(opener)) opener.focus() }
  }, [isOpen])

  if (!isOpen) return null

  function handleKeyDown(event) {
    if (event.key === 'Escape' && !busy) {
      event.stopPropagation()
      onCancel()
      return
    }
    if (event.key !== 'Tab') return
    const items = [...dialogRef.current.querySelectorAll(FOCUSABLE)]
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div ref={dialogRef} className="modal-content" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={messageId} onKeyDown={handleKeyDown}>
        <h3 id={titleId} className="modal-title">{title}</h3>
        <p id={messageId} className="modal-message">{message}</p>
        <div className="form-actions" style={{ justifyContent: 'flex-end', marginTop: '20px' }}>
          <button ref={cancelRef} type="button" className="button button-outline" disabled={busy} onClick={onCancel}>
            {cancelText}
          </button>
          <button
            type="button"
            className={`button ${isDanger ? 'button-danger' : 'button-primary'}`}
            disabled={busy}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
