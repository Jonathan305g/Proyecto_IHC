import {
  CATEGORIAS_RESULTADO,
  formatPercentage,
  formatSeconds,
} from '../../domain/indicadores.js'

/**
 * Gráficos del dashboard de resultados (S3-05).
 * 1. Barra de distribución global de resultados evaluados (Sin ayuda, Con ayuda, No completado).
 * 2. Gráfico comparativo de resultados por tarea.
 * 3. Gráfico comparativo de tiempos promedio por tarea.
 */
export default function IndicatorsCharts({ general, porTarea = [] }) {
  if (!general) return null

  const sinAyuda = general.por_resultado?.sin_ayuda || {}
  const conAyuda = general.por_resultado?.con_ayuda || {}
  const noComp = general.por_resultado?.no_completado || {}

  // Porcentajes reales de la consulta
  const pSin = sinAyuda.porcentaje ?? 0
  const pCon = conAyuda.porcentaje ?? 0
  const pNo = noComp.porcentaje ?? 0

  const hayEvaluados = general.evaluados > 0

  // Cálculo para gráfico de tiempos (encontrar el máximo para escalar barras)
  const tiemposTareas = porTarea.map((t) => {
    const tSin = t.por_resultado?.sin_ayuda?.tiempo?.promedio_segundos
    const tCon = t.por_resultado?.con_ayuda?.tiempo?.promedio_segundos
    return {
      tarea_id: t.tarea_id,
      codigo: t.codigo || `#${t.tarea_id}`,
      titulo: t.titulo,
      sinAyudaSeg: tSin,
      conAyudaSeg: tCon,
    }
  })

  const maxSeg = Math.max(
    1,
    ...tiemposTareas.flatMap((t) => [t.sinAyudaSeg || 0, t.conAyudaSeg || 0])
  )

  return (
    <div className="dashboard-charts-wrapper" role="region" aria-label="Visualizaciones y gráficos del dashboard">
      {/* 1. Gráfico de distribución general de resultados */}
      <section className="dashboard-chart-card">
        <header className="chart-card-header">
          <div>
            <h3 className="chart-title">Distribución general de resultados</h3>
            <p className="field-hint">
              Proporción de evaluaciones realizadas según el nivel de asistencia requerido ({general.evaluados} evaluadas).
            </p>
          </div>
        </header>

        {!hayEvaluados ? (
          <div className="chart-empty-notice">
            <p>No hay evaluaciones registradas para generar la distribución de resultados.</p>
          </div>
        ) : (
          <div className="distribution-chart-container">
            {/* Barra segmentada horizontal accesible */}
            <div
              className="stacked-bar-container"
              role="img"
              aria-label={`Distribución general: Sin ayuda ${formatPercentage(pSin)}, Con ayuda ${formatPercentage(pCon)}, No completado ${formatPercentage(pNo)}`}
            >
              {pSin > 0 && (
                <div
                  className="bar-segment segment-sin-ayuda"
                  style={{ width: `${pSin}%`, background: CATEGORIAS_RESULTADO.sin_ayuda.color }}
                  title={`Sin ayuda: ${formatPercentage(pSin)} (${sinAyuda.cantidad})`}
                >
                  {pSin >= 12 && <span>{formatPercentage(pSin)}</span>}
                </div>
              )}
              {pCon > 0 && (
                <div
                  className="bar-segment segment-con-ayuda"
                  style={{ width: `${pCon}%`, background: CATEGORIAS_RESULTADO.con_ayuda.color }}
                  title={`Con ayuda: ${formatPercentage(pCon)} (${conAyuda.cantidad})`}
                >
                  {pCon >= 12 && <span>{formatPercentage(pCon)}</span>}
                </div>
              )}
              {pNo > 0 && (
                <div
                  className="bar-segment segment-no-completado"
                  style={{ width: `${pNo}%`, background: CATEGORIAS_RESULTADO.no_completado.color }}
                  title={`No completado: ${formatPercentage(pNo)} (${noComp.cantidad})`}
                >
                  {pNo >= 12 && <span>{formatPercentage(pNo)}</span>}
                </div>
              )}
            </div>

            {/* Leyenda de la distribución */}
            <div className="chart-legend">
              <div className="legend-item">
                <span className="legend-dot" style={{ background: CATEGORIAS_RESULTADO.sin_ayuda.color }} aria-hidden="true" />
                <span>
                  <strong>Sin ayuda:</strong> {formatPercentage(sinAyuda.porcentaje)} ({sinAyuda.cantidad} eval.)
                </span>
              </div>
              <div className="legend-item">
                <span className="legend-dot" style={{ background: CATEGORIAS_RESULTADO.con_ayuda.color }} aria-hidden="true" />
                <span>
                  <strong>Con ayuda:</strong> {formatPercentage(conAyuda.porcentaje)} ({conAyuda.cantidad} eval.)
                </span>
              </div>
              <div className="legend-item">
                <span className="legend-dot" style={{ background: CATEGORIAS_RESULTADO.no_completado.color }} aria-hidden="true" />
                <span>
                  <strong>No completado:</strong> {formatPercentage(noComp.porcentaje)} ({noComp.cantidad} eval.)
                </span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 2. Gráfico comparativo por tarea */}
      {porTarea.length > 0 && (
        <section className="dashboard-chart-card">
          <header className="chart-card-header">
            <div>
              <h3 className="chart-title">Comparativa de resultados por tarea</h3>
              <p className="field-hint">
                Distribución porcentual de éxito autónomo, asistido y abandono en cada tarea del plan.
              </p>
            </div>
          </header>

          <div className="task-bars-list" role="list">
            {porTarea.map((t) => {
              const tSin = t.por_resultado?.sin_ayuda?.porcentaje ?? 0
              const tCon = t.por_resultado?.con_ayuda?.porcentaje ?? 0
              const tNo = t.por_resultado?.no_completado?.porcentaje ?? 0
              const label = t.codigo ? `${t.codigo} — ${t.titulo}` : t.titulo
              const sinDatos = t.evaluados === 0

              return (
                <div key={t.tarea_id} className="task-bar-row" role="listitem">
                  <div className="task-bar-info">
                    <strong className="task-bar-title">{label}</strong>
                    <small className="field-hint">
                      {t.evaluados} de {t.esperados} evaluadas ({formatPercentage(t.cobertura_porcentaje)} cob.)
                    </small>
                  </div>

                  <div className="task-bar-track">
                    {sinDatos ? (
                      <div className="bar-segment-empty">Sin evaluaciones registradas</div>
                    ) : (
                      <div
                        className="stacked-bar-container bar-sm"
                        role="img"
                        aria-label={`${label}: Sin ayuda ${formatPercentage(tSin)}, Con ayuda ${formatPercentage(tCon)}, No completado ${formatPercentage(tNo)}`}
                      >
                        {tSin > 0 && (
                          <div
                            className="bar-segment"
                            style={{ width: `${tSin}%`, background: CATEGORIAS_RESULTADO.sin_ayuda.color }}
                            title={`Sin ayuda: ${formatPercentage(tSin)}`}
                          >
                            {tSin >= 15 && <span>{formatPercentage(tSin)}</span>}
                          </div>
                        )}
                        {tCon > 0 && (
                          <div
                            className="bar-segment"
                            style={{ width: `${tCon}%`, background: CATEGORIAS_RESULTADO.con_ayuda.color }}
                            title={`Con ayuda: ${formatPercentage(tCon)}`}
                          >
                            {tCon >= 15 && <span>{formatPercentage(tCon)}</span>}
                          </div>
                        )}
                        {tNo > 0 && (
                          <div
                            className="bar-segment"
                            style={{ width: `${tNo}%`, background: CATEGORIAS_RESULTADO.no_completado.color }}
                            title={`No completado: ${formatPercentage(tNo)}`}
                          >
                            {tNo >= 15 && <span>{formatPercentage(tNo)}</span>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* 3. Comparativa de tiempos promedio por tarea */}
      {porTarea.length > 0 && tiemposTareas.some((t) => t.sinAyudaSeg !== null || t.conAyudaSeg !== null) && (
        <section className="dashboard-chart-card">
          <header className="chart-card-header">
            <div>
              <h3 className="chart-title">Tiempos promedio por tarea (segundos)</h3>
              <p className="field-hint">
                Duración media en segundos para resoluciones autónomas (sin ayuda) vs asistidas (con ayuda).
              </p>
            </div>
            <div className="chart-legend inline">
              <span className="legend-item">
                <span className="legend-dot" style={{ background: CATEGORIAS_RESULTADO.sin_ayuda.color }} aria-hidden="true" />
                <small>Sin ayuda</small>
              </span>
              <span className="legend-item">
                <span className="legend-dot" style={{ background: CATEGORIAS_RESULTADO.con_ayuda.color }} aria-hidden="true" />
                <small>Con ayuda</small>
              </span>
            </div>
          </header>

          <div className="time-comparison-grid">
            {tiemposTareas.map((t) => {
              const widthSin = t.sinAyudaSeg !== null && t.sinAyudaSeg !== undefined ? Math.max(4, (t.sinAyudaSeg / maxSeg) * 100) : 0
              const widthCon = t.conAyudaSeg !== null && t.conAyudaSeg !== undefined ? Math.max(4, (t.conAyudaSeg / maxSeg) * 100) : 0

              return (
                <div key={t.tarea_id} className="time-row">
                  <div className="time-row-label">
                    <strong>{t.codigo}</strong>
                    <span className="time-task-name">{t.titulo}</span>
                  </div>
                  <div className="time-bars-group">
                    {/* Barra Sin ayuda */}
                    <div className="time-bar-line">
                      <span className="time-bar-tag">Sin ayuda:</span>
                      <div className="time-bar-bg">
                        {t.sinAyudaSeg !== null && t.sinAyudaSeg !== undefined ? (
                          <div
                            className="time-bar-fill"
                            style={{ width: `${widthSin}%`, background: CATEGORIAS_RESULTADO.sin_ayuda.color }}
                          />
                        ) : null}
                      </div>
                      <span className="time-val">{formatSeconds(t.sinAyudaSeg)}</span>
                    </div>

                    {/* Barra Con ayuda */}
                    <div className="time-bar-line">
                      <span className="time-bar-tag">Con ayuda:</span>
                      <div className="time-bar-bg">
                        {t.conAyudaSeg !== null && t.conAyudaSeg !== undefined ? (
                          <div
                            className="time-bar-fill"
                            style={{ width: `${widthCon}%`, background: CATEGORIAS_RESULTADO.con_ayuda.color }}
                          />
                        ) : null}
                      </div>
                      <span className="time-val">{formatSeconds(t.conAyudaSeg)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
