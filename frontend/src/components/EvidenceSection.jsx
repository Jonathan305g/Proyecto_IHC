import { useCallback, useEffect, useRef, useState } from 'react'
import ConfirmModal from './ConfirmModal.jsx'
import {
  ACCEPT_FILE_TYPES,
  evidencias,
  formatFileSize,
  validateClientFile,
  validateClientUrl,
} from '../services/evidencias.js'

export default function EvidenceSection({ sessionId, taskId, readOnly = false }) {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState('none') // 'none' | 'file' | 'link'
  const [file, setFile] = useState(null)
  const [url, setUrl] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [evidenceToDelete, setEvidenceToDelete] = useState(null)
  const fileInputRef = useRef(null)
  const urlInputRef = useRef(null)
  const successRef = useRef(null)
  const errorId = `evidencia-error-${taskId}`

  // Tras adjuntar, el formulario desaparece: el foco pasa al aviso para no perder la posición.
  useEffect(() => { if (success) successRef.current?.focus() }, [success])

  const loadEvidences = useCallback(async () => {
    if (!sessionId || !taskId) return
    setLoading(true)
    try {
      const items = await evidencias.listByTask(sessionId, taskId)
      setList(items || [])
    } catch (_) {
      // Si la sesión aún no tiene resultados para esta tarea, devuelve lista vacía
      setList([])
    } finally {
      setLoading(false)
    }
  }, [sessionId, taskId])

  useEffect(() => {
    loadEvidences()
    setMode('none')
    setFile(null)
    setUrl('')
    setDescripcion('')
    setError('')
    setSuccess('')
    setProgress(0)
  }, [loadEvidences])

  async function handleUploadFile(e) {
    e.preventDefault()
    setError('')
    setSuccess('')

    const clientErr = validateClientFile(file)
    if (clientErr) {
      setError(clientErr)
      fileInputRef.current?.focus()
      return
    }

    setUploading(true)
    setProgress(0)
    try {
      await evidencias.uploadFile(sessionId, taskId, file, descripcion, (p) => {
        setProgress(p.percent)
      })
      setSuccess('Evidencia adjuntada correctamente.')
      setFile(null)
      setDescripcion('')
      setMode('none')
      if (fileInputRef.current) fileInputRef.current.value = ''
      await loadEvidences()
    } catch (err) {
      setError(err.message || 'Fallo de transferencia al subir el archivo.')
    } finally {
      setUploading(false)
    }
  }

  async function handleAddLink(e) {
    e.preventDefault()
    setError('')
    setSuccess('')

    const clientErr = validateClientUrl(url)
    if (clientErr) {
      setError(clientErr)
      urlInputRef.current?.focus()
      return
    }

    setUploading(true)
    try {
      await evidencias.addLink(sessionId, taskId, {
        url: url.trim(),
        descripcion: descripcion.trim() || null,
      })
      setSuccess('Enlace registrado correctamente.')
      setUrl('')
      setDescripcion('')
      setMode('none')
      await loadEvidences()
    } catch (err) {
      setError(err.message || 'Error al guardar el enlace de evidencia.')
    } finally {
      setUploading(false)
    }
  }

  async function confirmDelete() {
    if (!evidenceToDelete) return
    try {
      await evidencias.delete(evidenceToDelete.id)
      setEvidenceToDelete(null)
      setSuccess('Evidencia eliminada.')
      await loadEvidences()
    } catch (err) {
      setError(err.message || 'No se pudo eliminar la evidencia.')
      setEvidenceToDelete(null)
    }
  }

  return (
    <section className="evidence-section" aria-labelledby={`evidencias-tarea-${taskId}`}>
      <div className="evidence-section-header">
        <div>
          <h3 id={`evidencias-tarea-${taskId}`}>Evidencias de la tarea (opcional)</h3>
          <small className="field-hint">
            Adjunta capturas, grabaciones o notas para respaldar la evaluación.
          </small>
        </div>

        {!readOnly && (
          <div className="evidence-tabs" role="group" aria-label="Opciones de carga de evidencia">
            <button
              type="button"
              aria-expanded={mode === 'file'}
              className={`evidence-tab-btn ${mode === 'file' ? 'active' : ''}`}
              onClick={() => {
                setMode(mode === 'file' ? 'none' : 'file')
                setError('')
                setSuccess('')
              }}
            >
              {mode === 'file' ? 'Cancelar archivo' : 'Subir archivo'}
            </button>
            <button
              type="button"
              aria-expanded={mode === 'link'}
              className={`evidence-tab-btn ${mode === 'link' ? 'active' : ''}`}
              onClick={() => {
                setMode(mode === 'link' ? 'none' : 'link')
                setError('')
                setSuccess('')
              }}
            >
              {mode === 'link' ? 'Cancelar enlace' : 'Agregar enlace'}
            </button>
          </div>
        )}
      </div>

      {error && (
        <p id={errorId} className="notice notice-error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p ref={successRef} tabIndex="-1" className="notice" role="status">
          {success}
        </p>
      )}

      {/* Formulario de carga de archivo */}
      {!readOnly && mode === 'file' && (
        <form className="evidence-upload-box" onSubmit={handleUploadFile} noValidate>
          <label>
            Archivo (imagen, video, audio, PDF o TXT, máx. 15 MB)
            <input
              ref={fileInputRef}
              type="file"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
              accept={ACCEPT_FILE_TYPES}
              disabled={uploading}
              onChange={(e) => {
                setFile(e.target.files?.[0] || null)
                setError('')
              }}
            />
          </label>

          <label>
            Descripción o nota (opcional)
            <input
              type="text"
              maxLength="1000"
              placeholder="Ej. Momento en que el participante confunde el botón"
              value={descripcion}
              disabled={uploading}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </label>

          {uploading && (
            <div style={{ display: 'grid', gap: '4px' }}>
              <div className="evidence-progress-bar" role="progressbar" aria-label="Progreso de la subida del archivo" aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100">
                <div className="evidence-progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <small className="field-hint">Subiendo archivo: {progress}%</small>
            </div>
          )}

          <div className="form-actions">
            <button type="submit" className="button button-primary button-sm" disabled={uploading || !file}>
              {uploading ? 'Subiendo…' : 'Adjuntar archivo'}
            </button>
            <button
              type="button"
              className="button button-outline button-sm"
              disabled={uploading}
              onClick={() => setMode('none')}
            >
              Descartar
            </button>
          </div>
        </form>
      )}

      {/* Formulario de carga de enlace */}
      {!readOnly && mode === 'link' && (
        <form className="evidence-upload-box" onSubmit={handleAddLink} noValidate>
          <label>
            URL del enlace (debe iniciar con http:// o https://)
            <input
              ref={urlInputRef}
              type="url"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
              placeholder="https://drive.google.com/..."
              value={url}
              disabled={uploading}
              onChange={(e) => {
                setUrl(e.target.value)
                setError('')
              }}
            />
          </label>

          <label>
            Descripción o título (opcional)
            <input
              type="text"
              maxLength="1000"
              placeholder="Ej. Grabación de videollamada completa"
              value={descripcion}
              disabled={uploading}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </label>

          <div className="form-actions">
            <button type="submit" className="button button-primary button-sm" disabled={uploading || !url.trim()}>
              {uploading ? 'Guardando…' : 'Adjuntar enlace'}
            </button>
            <button
              type="button"
              className="button button-outline button-sm"
              disabled={uploading}
              onClick={() => setMode('none')}
            >
              Descartar
            </button>
          </div>
        </form>
      )}

      {/* Lista de evidencias registradas */}
      <div className="evidence-list" aria-label="Evidencias asociadas">
        {loading && <small className="field-hint">Cargando evidencias…</small>}
        {!loading && list.length === 0 && (
          <small className="field-hint">No hay evidencias adjuntas para esta tarea.</small>
        )}
        {!loading &&
          list.map((item) => {
            const isLink = item.tipo === 'enlace'
            const openUrl = isLink ? item.ruta : evidencias.getFileUrl(item.id)
            const title = item.nombre_archivo || (isLink ? item.ruta : `Evidencia #${item.id}`)

            return (
              <article key={item.id} className="evidence-item">
                <div className="evidence-meta">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="badge badge-subtle">{item.tipo.toUpperCase()}</span>
                    <strong className="evidence-title">{title}</strong>
                  </div>
                  <small className="evidence-sub">
                    {item.tamano_bytes ? `${formatFileSize(item.tamano_bytes)} · ` : ''}
                    {item.descripcion || (isLink ? 'Enlace externo' : 'Archivo adjunto')}
                  </small>
                </div>

                <div className="evidence-actions">
                  <a
                    href={openUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="button button-outline button-sm"
                  >
                    Abrir evidencia
                    <span className="visually-hidden"> «{title}» (se abre en una pestaña nueva)</span>
                  </a>
                  {!readOnly && (
                    <button
                      type="button"
                      className="button button-danger button-sm"
                      onClick={() => setEvidenceToDelete(item)}
                    >
                      Eliminar<span className="visually-hidden"> evidencia «{title}»</span>
                    </button>
                  )}
                </div>
              </article>
            )
          })}
      </div>

      <ConfirmModal
        isOpen={Boolean(evidenceToDelete)}
        title="Eliminar evidencia"
        message={
          evidenceToDelete
            ? `¿Deseas eliminar la evidencia «${
                evidenceToDelete.nombre_archivo || evidenceToDelete.ruta
              }»? Esta acción removerá el archivo.`
            : ''
        }
        confirmText="Eliminar evidencia"
        cancelText="Conservar"
        isDanger={true}
        onConfirm={confirmDelete}
        onCancel={() => setEvidenceToDelete(null)}
      />
    </section>
  )
}
