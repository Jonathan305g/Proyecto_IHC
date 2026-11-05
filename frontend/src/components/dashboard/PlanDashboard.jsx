import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ErrorState, LoadingState } from '../UiState.jsx'
import IndicatorsCards from './IndicatorsCards.jsx'
import IndicatorsCharts from './IndicatorsCharts.jsx'
import IndicatorsTable from './IndicatorsTable.jsx'
import { indicadores } from '../../services/indicadores.js'
import { plans } from '../../services/persistence.js'

/**
 * Dashboard de Resultados e Indicadores (S3-05 / HU-05).
 * Conecta a la API S3-04 (GET /api/planes/:id/indicadores).
 * Garantiza que tarjetas, gráficos y tabla compartan el mismo conjunto de datos
 * y que los estados de carga o error limpien de inmediato las cifras anteriores.
 */
export default function PlanDashboard({ initialPlanId = null }) {
  const [plansList, setPlansList] = useState([])
  const [selectedPlanId, setSelectedPlanId] = useState(initialPlanId)
  const [loadingPlans, setLoadingPlans] = useState(true)
  const [plansError, setPlansError] = useState('')

  // Estado del reporte actual (S3-04)
  const [report, setReport] = useState(null)
  const [loadingReport, setLoadingReport] = useState(false)
  const [reportError, setReportError] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)

  // 1. Cargar lista de planes disponibles
  const loadPlans = useCallback(async () => {
    setLoadingPlans(true)
    setPlansError('')
    try {
      const data = await plans.list()
      const list = data || []
      setPlansList(list)
      if (!selectedPlanId && list.length > 0) {
        setSelectedPlanId(list[0].id)
      }
    } catch (err) {
      setPlansError(err.message || 'Error al cargar los planes.')
    } finally {
      setLoadingPlans(false)
    }
  }, [selectedPlanId])

  useEffect(() => {
    loadPlans()
  }, [loadPlans])

  // Actualizar si initialPlanId cambia externamente
  useEffect(() => {
    if (initialPlanId) {
      setSelectedPlanId(initialPlanId)
    }
  }, [initialPlanId])

  // 2. Cargar reporte de indicadores al cambiar el plan seleccionado o al reintentar
  // REGLA CLAVE S3-05: Limpiar de inmediato el estado previo al cambiar de plan
  useEffect(() => {
    if (!selectedPlanId) {
      setReport(null)
      setReportError('')
      setLoadingReport(false)
      return undefined
    }

    let active = true
    // Limpieza inmediata de cifras anteriores
    setReport(null)
    setReportError('')
    setLoadingReport(true)

    indicadores
      .getReport(selectedPlanId)
      .then((data) => {
        if (!active) return
        setReport(data)
      })
      .catch((err) => {
        if (!active) return
        setReport(null) // Asegura no conservar cifras ante fallo
        setReportError(err.message || 'Error al obtener los indicadores del plan.')
      })
      .finally(() => {
        if (active) setLoadingReport(false)
      })

    return () => {
      active = false
    }
  }, [selectedPlanId, refreshTick])

  const selectedPlan = plansList.find((p) => String(p.id) === String(selectedPlanId))

  function handleRetry() {
    setRefreshTick((t) => t + 1)
  }

  return (
    <div className="plan-dashboard" role="region" aria-label="Dashboard de resultados de pruebas">
      {/* Barra de control: Selección de plan y acciones */}
      <section className="form-panel dashboard-selector-panel" style={{ maxWidth: '100%', marginBottom: '24px' }}>
        <div className="dashboard-toolbar">
          <div className="dashboard-select-group">
            <label htmlFor="dashboard-plan-select" style={{ fontWeight: 700 }}>
              Plan de prueba para análisis
            </label>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                id="dashboard-plan-select"
                aria-label="Seleccionar plan de pruebas"
                value={selectedPlanId || ''}
                disabled={loadingPlans || plansList.length === 0}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                style={{ minWidth: '280px', maxWidth: '500px' }}
              >
                {plansList.length === 0 && <option value="">Sin planes disponibles</option>}
                {plansList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} ({p.estado})
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="button button-outline button-sm"
                onClick={handleRetry}
                disabled={loadingReport || !selectedPlanId}
                title="Actualizar datos desde la API"
              >
                ↻ Actualizar datos
              </button>
            </div>
          </div>

          {selectedPlan && (
            <div className="dashboard-plan-meta">
              <span className={`badge ${selectedPlan.estado === 'activo' ? 'badge-active' : 'badge-draft'}`}>
                {selectedPlan.estado.toUpperCase()}
              </span>
              <Link className="button button-ghost button-sm" to={`/planes/${selectedPlan.id}`}>
                Ver detalle del plan →
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Estados globales de carga y error en planes */}
      {plansError && <ErrorState message={plansError} onRetry={loadPlans} />}
      {loadingPlans && !plansError && <LoadingState label="Cargando planes..." />}

      {/* Estado del reporte de indicadores */}
      {reportError && (
        <ErrorState
          message={reportError}
          onRetry={handleRetry}
        />
      )}

      {loadingReport && !reportError && (
        <LoadingState label="Consultando indicadores y métricas del plan..." />
      )}

      {/* Ausencia de resultados / Plan sin sesiones */}
      {!loadingReport && !reportError && report && report.sesiones_incluidas === 0 && (
        <div className="notice" role="status" style={{ marginBottom: '20px' }}>
          <div>
            <strong>Sin sesiones cerradas para este plan.</strong>
            <p style={{ margin: '4px 0 0', fontSize: '13px' }}>
              Para calcular tasas y tiempos, se requieren sesiones en estado <em>cerrada</em> con consentimiento confirmado.
              Puedes iniciar y completar una sesión desde el menú de sesiones.
            </p>
          </div>
          <Link className="button button-primary button-sm" to="/sesiones/nueva">
            Iniciar nueva sesión
          </Link>
        </div>
      )}

      {/* Visualización completa de Indicadores cuando hay datos */}
      {!loadingReport && !reportError && report && (
        <div className="dashboard-content-grid">
          {/* 1. Tarjetas de indicadores */}
          <IndicatorsCards
            general={report.general}
            sesionesIncluidas={report.sesiones_incluidas}
            tareasSeleccionadas={report.tareas_seleccionadas}
          />

          {/* 2. Gráficos previstos en el prototipo */}
          <IndicatorsCharts
            general={report.general}
            porTarea={report.por_tarea}
          />

          {/* 3. Tabla detallada por tarea */}
          <IndicatorsTable
            porTarea={report.por_tarea}
          />
        </div>
      )}
    </div>
  )
}
