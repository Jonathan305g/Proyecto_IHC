import {
  CATEGORIAS_RESULTADO,
  formatErrors,
  formatPercentage,
  formatSeconds,
} from '../../domain/indicadores.js'

/**
 * Tabla detallada por tarea (S3-05).
 * Muestra el desglose de métricas por cada tarea seleccionada del plan,
 * consumiendo exactamente el array `por_tarea` devuelto por la API S3-04.
 */
export default function IndicatorsTable({ porTarea = [] }) {
  if (!porTarea || porTarea.length === 0) {
    return (
      <div className="table-empty-notice" role="region" aria-label="Tabla de tareas vacía">
        <p className="field-hint">Este plan no contiene tareas asociadas para desglosar.</p>
      </div>
    )
  }

  return (
    <section className="dashboard-table-section" role="region" aria-label="Tabla de indicadores por tarea">
      <header className="table-section-header">
        <div>
          <h3 style={{ margin: 0 }}>Desglose de indicadores por tarea ({porTarea.length})</h3>
          <p className="field-hint" style={{ marginTop: '4px' }}>
            Métricas de cobertura, éxito autónomo, éxito con asistencia y no completadas por cada tarea del plan.
          </p>
        </div>
      </header>

      <div className="dashboard-table-container" tabIndex="0" aria-label="Tabla con desplazamiento horizontal">
        <table className="dashboard-table">
          <caption>Resultados detallados e indicadores por cada tarea del plan de prueba</caption>
          <thead>
            <tr>
              <th scope="col" className="col-task">Tarea</th>
              <th scope="col" className="col-coverage">Cobertura</th>
              <th scope="col" className="col-category">
                <span className="th-cat-title" style={{ color: CATEGORIAS_RESULTADO.sin_ayuda.color }}>
                  Sin ayuda
                </span>
                <small className="th-cat-sub">Cant. · % · Tiempo · Err.</small>
              </th>
              <th scope="col" className="col-category">
                <span className="th-cat-title" style={{ color: CATEGORIAS_RESULTADO.con_ayuda.color }}>
                  Con ayuda
                </span>
                <small className="th-cat-sub">Cant. · % · Tiempo · Err.</small>
              </th>
              <th scope="col" className="col-category">
                <span className="th-cat-title" style={{ color: CATEGORIAS_RESULTADO.no_completado.color }}>
                  No completado
                </span>
                <small className="th-cat-sub">Cant. · % · Tiempo · Err.</small>
              </th>
              <th scope="col" className="col-pending">Pendientes</th>
            </tr>
          </thead>
          <tbody>
            {porTarea.map((t) => {
              const sin = t.por_resultado?.sin_ayuda || {}
              const con = t.por_resultado?.con_ayuda || {}
              const noComp = t.por_resultado?.no_completado || {}

              return (
                <tr key={t.tarea_id}>
                  {/* Identificación de la tarea */}
                  <th scope="row" className="cell-task">
                    <div className="task-cell-content">
                      <span className="badge badge-subtle">{t.codigo || `#${t.tarea_id}`}</span>
                      <strong className="task-name">{t.titulo}</strong>
                    </div>
                  </th>

                  {/* Cobertura */}
                  <td className="cell-coverage">
                    <div className="coverage-cell-wrapper">
                      <strong>{formatPercentage(t.cobertura_porcentaje)}</strong>
                      <small className="field-hint">
                        {t.evaluados} de {t.esperados}
                      </small>
                    </div>
                  </td>

                  {/* Sin ayuda */}
                  <td className="cell-cat cell-sin-ayuda">
                    <div className="metric-cell-group">
                      <div className="metric-cell-primary">
                        <strong style={{ color: CATEGORIAS_RESULTADO.sin_ayuda.color }}>
                          {formatPercentage(sin.porcentaje)}
                        </strong>
                        <span className="count-tag">({sin.cantidad ?? 0})</span>
                      </div>
                      <div className="metric-cell-secondary">
                        <small title="Tiempo promedio">⏱ {formatSeconds(sin.tiempo?.promedio_segundos)}</small>
                        <small title="Errores promedio">⚠ {formatErrors(sin.errores?.promedio)} err.</small>
                      </div>
                    </div>
                  </td>

                  {/* Con ayuda */}
                  <td className="cell-cat cell-con-ayuda">
                    <div className="metric-cell-group">
                      <div className="metric-cell-primary">
                        <strong style={{ color: CATEGORIAS_RESULTADO.con_ayuda.color }}>
                          {formatPercentage(con.porcentaje)}
                        </strong>
                        <span className="count-tag">({con.cantidad ?? 0})</span>
                      </div>
                      <div className="metric-cell-secondary">
                        <small title="Tiempo promedio">⏱ {formatSeconds(con.tiempo?.promedio_segundos)}</small>
                        <small title="Errores promedio">⚠ {formatErrors(con.errores?.promedio)} err.</small>
                      </div>
                    </div>
                  </td>

                  {/* No completado */}
                  <td className="cell-cat cell-no-completado">
                    <div className="metric-cell-group">
                      <div className="metric-cell-primary">
                        <strong style={{ color: CATEGORIAS_RESULTADO.no_completado.color }}>
                          {formatPercentage(noComp.porcentaje)}
                        </strong>
                        <span className="count-tag">({noComp.cantidad ?? 0})</span>
                      </div>
                      <div className="metric-cell-secondary">
                        <small title="Tiempo promedio">⏱ {formatSeconds(noComp.tiempo?.promedio_segundos)}</small>
                        <small title="Errores promedio">⚠ {formatErrors(noComp.errores?.promedio)} err.</small>
                      </div>
                    </div>
                  </td>

                  {/* Pendientes */}
                  <td className="cell-pending">
                    <span className={`badge ${t.pendientes > 0 ? 'badge-subtle' : 'badge-active'}`}>
                      {t.pendientes}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
