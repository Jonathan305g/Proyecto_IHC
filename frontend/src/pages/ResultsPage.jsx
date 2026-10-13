import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import PageHeader from '../components/PageHeader.jsx'
import { EmptyState, ErrorState, LoadingState } from '../components/UiState.jsx'
import { sessions } from '../services/persistence.js'
import { evidencias, formatFileSize } from '../services/evidencias.js'
import { results } from '../services/results.js'
import { RESULT_LABELS, formatClock } from '../domain/sessionRun.js'

export default function ResultsPage() {
  const [items, setItems] = useState([])
  const [selectedSessionId, setSelectedSessionId] = useState(null)
  const [sessionResults, setSessionResults] = useState([])
  const [sessionEvidences, setSessionEvidences] = useState([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadSessions = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const list = await sessions.list()
      setItems(list || [])
      if (list && list.length > 0) {
        setSelectedSessionId(list[0].id)
      }
    } catch (err) {
      setError(err.message || 'Error al cargar las sesiones.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  const loadSessionDetails = useCallback(async (sessionId) => {
    if (!sessionId) return
    setLoadingDetail(true)
    try {
      const [resList, evList] = await Promise.all([
        results.list(sessionId).catch(() => []),
        evidencias.listBySession(sessionId).catch(() => []),
      ])
      setSessionResults(resList || [])
      setSessionEvidences(evList || [])
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  useEffect(() => {
    if (selectedSessionId) {
      loadSessionDetails(selectedSessionId)
    }
  }, [selectedSessionId, loadSessionDetails])

  const selectedSession = items.find((s) => String(s.id) === String(selectedSessionId))

  return (
    <>
      <PageHeader
        eyebrow="ANÁLISIS"
        title="Resultados y evidencias"
        description="Consulta las evaluaciones registradas y las evidencias de las sesiones de prueba."
      />

      {error && <ErrorState message={error} onRetry={loadSessions} />}
      {loading && !error && <LoadingState label="Cargando resultados…" />}

      {!loading && !error && items.length === 0 && (
        <EmptyState
          title="Todavía no hay resultados"
          description="Inicia y completa una sesión de prueba para consultar aquí sus resultados y evidencias."
          actionLabel="Ver sesiones"
          actionTo="/sesiones"
        />
      )}

      {!loading && !error && items.length > 0 && (
        <div style={{ display: 'grid', gap: '20px' }}>
          {/* Selector de sesión */}
          <div className="form-panel" style={{ maxWidth: '100%' }}>
            <label>
              Seleccionar sesión de prueba
              <select
                value={selectedSessionId || ''}
                onChange={(e) => setSelectedSessionId(e.target.value)}
              >
                {items.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.participante_codigo} — {s.plan_nombre} ({s.estado})
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selectedSession && (
            <section className="form-panel" style={{ maxWidth: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <h2 style={{ margin: 0 }}>Sesión de {selectedSession.participante_codigo}</h2>
                  <small className="field-hint">
                    Plan: <Link to={`/planes/${selectedSession.plan_id}`}>{selectedSession.plan_nombre}</Link>
                  </small>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span className={`badge ${selectedSession.estado === 'en_curso' ? 'badge-active' : selectedSession.estado === 'cerrada' ? 'badge-subtle' : 'badge-draft'}`}>
                    {selectedSession.estado.toUpperCase()}
                  </span>
                  <Link className="button button-outline button-sm" to={`/sesiones/${selectedSession.id}`}>
                    Ver sesión
                  </Link>
                  {selectedSession.estado === 'en_curso' && (
                    <Link className="button button-primary button-sm" to={`/sesiones/${selectedSession.id}/ejecutar`}>
                      Continuar ejecución
                    </Link>
                  )}
                </div>
              </div>

              {loadingDetail ? (
                <LoadingState label="Cargando resultados y evidencias de la sesión…" />
              ) : (
                <>
                  {/* Tabla de resultados */}
                  <h3>Resultados registrados ({sessionResults.length})</h3>
                  {sessionResults.length === 0 ? (
                    <p className="field-hint">Aún no se han guardado resultados para las tareas de esta sesión.</p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="run-table">
                        <thead>
                          <tr>
                            <th scope="col">Tarea</th>
                            <th scope="col">Resultado</th>
                            <th scope="col">Tiempo</th>
                            <th scope="col">Errores</th>
                            <th scope="col">Observaciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sessionResults.map((r) => (
                            <tr key={r.id}>
                              <th scope="row">Tarea #{r.tarea_id}</th>
                              <td>{r.resultado ? RESULT_LABELS[r.resultado] : 'Sin especificar'}</td>
                              <td>{formatClock(r.tiempo_segundos ?? r.duracion_segundos ?? 0)}</td>
                              <td>{r.errores ?? r.cantidad_errores ?? 0}</td>
                              <td>{r.observaciones || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Evidencias asociadas */}
                  <h3 style={{ marginTop: '20px' }}>Evidencias asociadas ({sessionEvidences.length})</h3>
                  {sessionEvidences.length === 0 ? (
                    <p className="field-hint">No hay evidencias adjuntas para esta sesión.</p>
                  ) : (
                    <div className="evidence-list">
                      {sessionEvidences.map((ev) => {
                        const isLink = ev.tipo === 'enlace'
                        const openUrl = isLink ? ev.ruta : evidencias.getFileUrl(ev.id)
                        return (
                          <article key={ev.id} className="evidence-item">
                            <div className="evidence-meta">
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className="badge badge-subtle">{ev.tipo.toUpperCase()}</span>
                                <strong className="evidence-title">{ev.nombre_archivo || ev.ruta}</strong>
                                {ev.tarea_titulo && (
                                  <span className="badge badge-primary">{ev.tarea_titulo}</span>
                                )}
                              </div>
                              <small className="evidence-sub">
                                {ev.tamano_bytes ? `${formatFileSize(ev.tamano_bytes)} · ` : ''}
                                {ev.descripcion || (isLink ? 'Enlace externo' : 'Archivo adjunto')}
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
                              </a>
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </section>
          )}
        </div>
      )}
    </>
  )
}
