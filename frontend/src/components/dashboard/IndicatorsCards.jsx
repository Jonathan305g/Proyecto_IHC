import {
  CATEGORIAS_RESULTADO,
  formatCount,
  formatErrors,
  formatPercentage,
  formatSeconds,
} from '../../domain/indicadores.js'

/**
 * Tarjetas de indicadores de alto nivel (S3-05).
 * Presenta cobertura, sesiones y el desglose estricto por resultado (sin ayuda vs con ayuda vs no completado).
 */
export default function IndicatorsCards({ general, sesionesIncluidas, tareasSeleccionadas }) {
  if (!general) return null

  const sinAyuda = general.por_resultado?.sin_ayuda || {}
  const conAyuda = general.por_resultado?.con_ayuda || {}
  const noCompletado = general.por_resultado?.no_completado || {}

  return (
    <div className="dashboard-cards-grid" role="region" aria-label="Tarjetas de indicadores generales">
      {/* 1. Cobertura general */}
      <article className="dashboard-card card-cobertura">
        <header className="dashboard-card-header">
          <span className="eyebrow">COBERTURA</span>
          <span className="badge badge-primary">
            {formatCount(sesionesIncluidas, sesionesIncluidas === 1 ? 'sesión' : 'sesiones')}
          </span>
        </header>
        <div className="dashboard-card-body">
          <div className="dashboard-card-main-val">
            {formatPercentage(general.cobertura_porcentaje)}
          </div>
          <p className="dashboard-card-label">Tasa de cobertura evaluada</p>
          <dl className="dashboard-metrics-list">
            <div className="metric-row">
              <dt>Evaluados:</dt>
              <dd><strong>{general.evaluados}</strong> de {general.esperados} esperados</dd>
            </div>
            <div className="metric-row">
              <dt>Pendientes:</dt>
              <dd><strong>{general.pendientes}</strong> pares</dd>
            </div>
            <div className="metric-row">
              <dt>Tareas:</dt>
              <dd><strong>{tareasSeleccionadas}</strong> seleccionadas</dd>
            </div>
          </dl>
        </div>
      </article>

      {/* 2. Éxito sin ayuda */}
      <article className="dashboard-card card-sin-ayuda">
        <header className="dashboard-card-header">
          <span className="eyebrow" style={{ color: CATEGORIAS_RESULTADO.sin_ayuda.color }}>
            AUTÓNOMO
          </span>
          <span className="badge badge-active">{CATEGORIAS_RESULTADO.sin_ayuda.label}</span>
        </header>
        <div className="dashboard-card-body">
          <div className="dashboard-card-main-val" style={{ color: CATEGORIAS_RESULTADO.sin_ayuda.color }}>
            {formatPercentage(sinAyuda.porcentaje)}
          </div>
          <p className="dashboard-card-label">Éxito sin asistencia</p>
          <dl className="dashboard-metrics-list">
            <div className="metric-row">
              <dt>Cantidad:</dt>
              <dd><strong>{sinAyuda.cantidad ?? 0}</strong> evaluaciones</dd>
            </div>
            <div className="metric-row">
              <dt>Tiempo prom.:</dt>
              <dd><strong>{formatSeconds(sinAyuda.tiempo?.promedio_segundos)}</strong></dd>
            </div>
            <div className="metric-row">
              <dt>Errores prom.:</dt>
              <dd><strong>{formatErrors(sinAyuda.errores?.promedio)}</strong> por eval.</dd>
            </div>
          </dl>
        </div>
      </article>

      {/* 3. Éxito con ayuda */}
      <article className="dashboard-card card-con-ayuda">
        <header className="dashboard-card-header">
          <span className="eyebrow" style={{ color: CATEGORIAS_RESULTADO.con_ayuda.color }}>
            ASISTIDO
          </span>
          <span className="badge badge-draft">{CATEGORIAS_RESULTADO.con_ayuda.label}</span>
        </header>
        <div className="dashboard-card-body">
          <div className="dashboard-card-main-val" style={{ color: CATEGORIAS_RESULTADO.con_ayuda.color }}>
            {formatPercentage(conAyuda.porcentaje)}
          </div>
          <p className="dashboard-card-label">Éxito con asistencia / pistas</p>
          <dl className="dashboard-metrics-list">
            <div className="metric-row">
              <dt>Cantidad:</dt>
              <dd><strong>{conAyuda.cantidad ?? 0}</strong> evaluaciones</dd>
            </div>
            <div className="metric-row">
              <dt>Tiempo prom.:</dt>
              <dd><strong>{formatSeconds(conAyuda.tiempo?.promedio_segundos)}</strong></dd>
            </div>
            <div className="metric-row">
              <dt>Errores prom.:</dt>
              <dd><strong>{formatErrors(conAyuda.errores?.promedio)}</strong> por eval.</dd>
            </div>
          </dl>
        </div>
      </article>

      {/* 4. No completado */}
      <article className="dashboard-card card-no-completado">
        <header className="dashboard-card-header">
          <span className="eyebrow" style={{ color: CATEGORIAS_RESULTADO.no_completado.color }}>
            ABANDONO / FRACASO
          </span>
          <span className="badge badge-danger" style={{ background: '#fef2f2', color: '#b91c1c' }}>
            {CATEGORIAS_RESULTADO.no_completado.label}
          </span>
        </header>
        <div className="dashboard-card-body">
          <div className="dashboard-card-main-val" style={{ color: CATEGORIAS_RESULTADO.no_completado.color }}>
            {formatPercentage(noCompletado.porcentaje)}
          </div>
          <p className="dashboard-card-label">No completadas / abandonadas</p>
          <dl className="dashboard-metrics-list">
            <div className="metric-row">
              <dt>Cantidad:</dt>
              <dd><strong>{noCompletado.cantidad ?? 0}</strong> evaluaciones</dd>
            </div>
            <div className="metric-row">
              <dt>Tiempo prom.:</dt>
              <dd><strong>{formatSeconds(noCompletado.tiempo?.promedio_segundos)}</strong></dd>
            </div>
            <div className="metric-row">
              <dt>Errores prom.:</dt>
              <dd><strong>{formatErrors(noCompletado.errores?.promedio)}</strong> por eval.</dd>
            </div>
          </dl>
        </div>
      </article>
    </div>
  )
}

