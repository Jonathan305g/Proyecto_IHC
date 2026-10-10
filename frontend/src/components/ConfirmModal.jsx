/**
 * Diálogo modal simple y accesible para confirmaciones de acción (cancelar o eliminar).
 */
export default function ConfirmModal({ isOpen, title, message, confirmText = 'Confirmar', cancelText = 'Cancelar', isDanger = false, onConfirm, onCancel }) {
  if (!isOpen) return null

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-content">
        <h3 id="modal-title" className="modal-title">{title}</h3>
        <p className="modal-message">{message}</p>
        <div className="form-actions" style={{ justifyContent: 'flex-end', marginTop: '20px' }}>
          <button type="button" className="button button-outline" onClick={onCancel}>
            {cancelText}
          </button>
          <button
            type="button"
            className={`button ${isDanger ? 'button-danger' : 'button-primary'}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
