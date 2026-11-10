import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ErrorState, LoadingState } from '../UiState.jsx'
import IndicatorsCards from './IndicatorsCards.jsx'
import IndicatorsCharts from './IndicatorsCharts.jsx'
import IndicatorsFilters from './IndicatorsFilters.jsx'
import IndicatorsTable from './IndicatorsTable.jsx'
import { hasActiveFilters } from '../../domain/indicadores.js'
import { indicadores } from '../../services/indicadores.js'
import { plans } from '../../services/persistence.js'

/**
 * Dashboard de Resultados e Indicadores (S3-05 / S3-06 / HU-05).
 * Conecta a la API S3-04 (GET /api/planes/:id/indicadores).
 * Garantiza que tarjetas, gráficos y tabla compartan el mismo conjunto de datos
 * y que los estados de carga o error limpien de inmediato las cifras anteriores.
 * Incluye panel interactivo de filtros de período y tareas (S3-06).
 */
export default function PlanDashboard({ initialPlanId = null }) {
  const [plansList, setPlansList] = useState([])
  const [selectedPlanId, setSelectedPlanId] = useState(initialPlanId)
  const [loadingPlans, setLoadingPlans] = useState(true)
  const [plansError, setPlansError] = useState('')

  // Tareas del plan actual para alimentar los filtros (S3-06)
  const [planTasks, setPlanTasks] = useState([])
  const [activeFilters, setActiveFilters] = useState({
    desde: null,
    hasta: null,
    tarea_ids: null,
  })

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

  // 2. Al cambiar el plan seleccionado, cargar sus tareas y reiniciar filtros
  useEffect(() => {
    if (!selectedPlanId) {
      setPlanTasks([])
      setActiveFilters({ desde: null, hasta: null, tarea_ids: null })
      return undefined
    }

    let active = true
    setActiveFilters({ desde: null, hasta: null, tarea_ids: null })

    plans
      .detail(selectedPlanId)
      .then((detail) => {
        if (!active) return
        setPlanTasks(detail?.tareas || [])
      })
      .catch(() => {
        if (!active) return
        setPlanTasks([])
      })

    return () => {
      active = false
    }
  }, [selectedPlanId])

  // 3. Cargar reporte de indicadores al cambiar el plan, los filtros o al reintentar
  // REGLA CLAVE S3-05: Limpiar de inmediato el estado previo al cambiar de plan o filtro
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
      .getReport(selectedPlanId, activeFilters)
      .then((data) => {
        if (!active) return
        setReport(data)
        // Sembrar tareas si detail aún no las trajo y el reporte trajo por_tarea
        if (data?.por_tarea?.length > 0) {
          setPlanTasks((prev) => {
            if (prev.length > 0) return prev
            return data.por_tarea.map((t) => ({
              id: t.tarea_id,
              codigo: t.codigo,
              titulo: t.titulo,
              orden: t.orden,
            }))
          })
        }
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
  }, [selectedPlanId, activeFilters, refreshTick])

  const selectedPlan = plansList.find((p) => String(p.id) === String(selectedPlanId))

  function handleRetry() {
    setRefreshTick((t) => t + 1)
  }

  function handleApplyFilters(newFilters) {
    setActiveFilters(newFilters)
  }

  function handleResetFilters() {
    setActiveFilters({ desde: null, hasta: null, tarea_ids: null })
  }

  const isFiltered = hasActiveFilters(activeFilters)

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

      {/* Panel interactivo de filtros de período y tareas (S3-06 / HU-05) */}
      {selectedPlanId && !plansError && (
        <IndicatorsFilters
          tasks={planTasks}
          activeFilters={activeFilters}
          onApplyFilters={handleApplyFilters}
          onResetFilters={handleResetFilters}
          disabled={loadingReport || loadingPlans}
        />
      )}

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

      {/* Ausencia de resultados / Plan sin sesiones o sin coincidencias de filtro */}
      {!loadingReport && !reportError && report && report.sesiones_incluidas === 0 && (
        <div className="notice" role="status" style={{ marginBottom: '20px' }}>
          <div>
            <strong>
              {isFiltered
                ? 'Sin sesiones cerradas para los filtros aplicados.'
                : 'Sin sesiones cerradas para este plan.'}
            </strong>
            <p style={{ margin: '4px 0 0', fontSize: '13px' }}>
              {isFiltered
                ? 'No se encontraron sesiones cerradas dentro del período o tareas seleccionadas. Puedes ampliar el rango de fechas o restablecer los filtros para ver el universo completo.'
                : 'Para calcular tasas y tiempos, se requieren sesiones en estado cerrada con consentimiento confirmado. Puedes iniciar y completar una sesión desde el menú de sesiones.'}
            </p>
          </div>
          {isFiltered ? (
            <button
              type="button"
              className="button button-outline button-sm"
              onClick={handleResetFilters}
              title="Restablecer filtros y consultar todas las sesiones"
            >
              Restablecer filtros
            </button>
          ) : (
            <Link className="button button-primary button-sm" to="/sesiones/nueva">
              Iniciar nueva sesión
            </Link>
          )}
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

