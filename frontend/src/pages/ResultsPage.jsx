import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import EvidenceLink from '../components/EvidenceLink.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { EmptyState, ErrorState, LoadingState } from '../components/UiState.jsx'
import PlanDashboard from '../components/dashboard/PlanDashboard.jsx'
import { sessions } from '../services/persistence.js'
import { evidencias, formatFileSize } from '../services/evidencias.js'
import { results } from '../services/results.js'
import { RESULT_LABELS, formatClock } from '../domain/sessionRun.js'

export default function ResultsPage() {
  const [searchParams] = useSearchParams()
  const initialPlanId = searchParams.get('plan_id')

  const [items, setItems] = useState([])
  const [selectedSessionId, setSelectedSessionId] = useState(null)
  const [sessionResults, setSessionResults] = useState([])
  const [sessionEvidences, setSessionEvidences] = useState([])
  const [detailError, setDetailError] = useState('')
  const [retry, setRetry] = useState(0)
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

  useEffect(() => {
    if (!selectedSessionId) return undefined
    let active = true
    setLoadingDetail(true)
    setDetailError('')
    setSessionResults([])
    setSessionEvidences([])
    Promise.all([results.list(selectedSessionId), evidencias.listBySession(selectedSessionId)])
      .then(([resList, evList]) => {
        if (active) {
          setSessionResults(resList || [])
          setSessionEvidences(evList || [])
        }
      })
      .catch((reason) => {
        if (active) setDetailError(reason.message || 'No se pudo consultar la sesión.')
      })
      .finally(() => {
        if (active) setLoadingDetail(false)
      })
    return () => {
      active = false
    }
  }, [selectedSessionId, retry])

  const selectedSession = items.find((s) => String(s.id) === String(selectedSessionId))

  return (
    <>
      <PageHeader
        eyebrow="ANÁLISIS Y RESULTADOS"
        title="Dashboard de resultados y análisis"
        description="Visualiza métricas consolidadas, cobertura y efectividad por plan según el contrato S3-01 / S3-04, y consulta el detalle por sesión."
      />

      {/* SECCIÓN 1: Dashboard de Indicadores del Plan (S3-05 / HU-05) */}
      <section className="dashboard-main-section" aria-label="Dashboard general de métricas">
        <h2 style={{ fontSize: '18px', color: '#17304a', marginBottom: '16px' }}>
          Métricas consolidadas por plan de prueba
        </h2>
        <PlanDashboard initialPlanId={initialPlanId} />
      </section>

      {/* SECCIÓN 2: Consulta individual por sesión y evidencias (S2-08) */}
      <section
        className="session-detail-section"
        aria-label="Detalle individual de sesión"
        style={{ marginTop: '48px', paddingTop: '32px', borderTop: '2px solid #e2e8f0' }}
      >
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', color: '#17304a', margin: '0 0 6px' }}>
            Resultados individuales y evidencias por sesión
          </h2>
          <p className="field-hint" style={{ margin: 0 }}>
            Consulta las respuestas de cada participante y los archivos de evidencia adjuntos durante la prueba.
          </p>
        </div>

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
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px' }}>
                      Sesión de {selectedSession.participante_codigo}
                    </h3>
                    <small className="field-hint">
                      Plan: <Link to={`/planes/${selectedSession.plan_id}`}>{selectedSession.plan_nombre}</Link>
                    </small>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span
                      className={`badge ${
                        selectedSession.estado === 'en_curso'
                          ? 'badge-active'
                          : selectedSession.estado === 'cerrada'
                          ? 'badge-subtle'
                          : 'badge-draft'
                      }`}
                    >
                      {selectedSession.estado.toUpperCase()}
                    </span>
                    <Link className="button button-outline button-sm" to={`/sesiones/${selectedSession.id}`}>
                      Ver sesión
                    </Link>
                    {selectedSession.estado === 'en_curso' && (
                      <Link
                        className="button button-primary button-sm"
                        to={`/sesiones/${selectedSession.id}/ejecutar`}
                      >
                        Continuar ejecución
                      </Link>
                    )}
                  </div>
                </div>

                {detailError ? (
                  <ErrorState message={detailError} onRetry={() => setRetry((value) => value + 1)} />
                ) : loadingDetail ? (
                  <LoadingState label="Cargando resultados y evidencias de la sesión…" />
                ) : (
                  <>
                    {/* Tabla de resultados */}
                    <h4>Resultados registrados ({sessionResults.length})</h4>
                    {sessionResults.length === 0 ? (
                      <p className="field-hint">
                        Aún no se han guardado resultados para las tareas de esta sesión.
                      </p>
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
                    <h4 style={{ marginTop: '20px' }}>Evidencias asociadas ({sessionEvidences.length})</h4>
                    {sessionEvidences.length === 0 ? (
                      <p className="field-hint">No hay evidencias adjuntas para esta sesión.</p>
                    ) : (
                      <div className="evidence-list">
                        {sessionEvidences.map((ev) => {
                          const isLink = ev.tipo === 'enlace'
                          return (
                            <article key={ev.id} className="evidence-item">
                              <div className="evidence-meta">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span className="badge badge-subtle">{ev.tipo.toUpperCase()}</span>
                                  <strong className="evidence-title">
                                    {ev.nombre_archivo || ev.ruta}
                                  </strong>
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
                                <EvidenceLink evidence={ev} />
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
      </section>
    </>
  )
}
