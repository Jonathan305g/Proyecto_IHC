import { useEffect, useId, useState } from 'react'
import {
  describeActiveFilters,
  hasActiveFilters,
  validateIndicatorFilters,
} from '../../domain/indicadores.js'

/**
 * Componente de Filtros para el Dashboard de Resultados (HU-05 / S3-06).
 * Permite filtrar por:
 * 1. Período de fechas de cierre de sesión (desde inclusivo / hasta exclusivo).
 * 2. Tareas específicas del plan (tarea_ids).
 * Aplica validaciones de cliente según el contrato S3-01 / S3-04:
 * - Selección vacía de tareas es inválida.
 * - Período debe cumplir desde < hasta.
 * - Restablecer utiliza NULL para recuperar el universo completo.
 */
export default function IndicatorsFilters({
  tasks = [],
  activeFilters = { desde: null, hasta: null, tarea_ids: null },
  onApplyFilters,
  onResetFilters,
  disabled = false,
}) {
  const allTaskIds = tasks.map((t) => String(t.id))
  const errorId = useId()

  // Estado local para los campos del formulario
  const [desdeDate, setDesdeDate] = useState('')
  const [hastaDate, setHastaDate] = useState('')
  const [selectedTaskIds, setSelectedTaskIds] = useState(allTaskIds)
  const [validationError, setValidationError] = useState('')

  // Sincronizar estado local cuando cambian las tareas del plan o activeFilters externamente
  useEffect(() => {
    if (activeFilters.tarea_ids && activeFilters.tarea_ids.length > 0) {
      const activeIds = Array.isArray(activeFilters.tarea_ids)
        ? activeFilters.tarea_ids.map(String)
        : String(activeFilters.tarea_ids).split(',').map((id) => id.trim())
      setSelectedTaskIds(activeIds)
    } else {
      setSelectedTaskIds(allTaskIds)
    }
  }, [tasks])

  function handleTaskToggle(taskIdStr) {
    setValidationError('')
    setSelectedTaskIds((prev) => {
      if (prev.includes(taskIdStr)) {
        return prev.filter((id) => id !== taskIdStr)
      }
      return [...prev, taskIdStr]
    })
  }

  function handleSelectAllTasks() {
    setValidationError('')
    setSelectedTaskIds(allTaskIds)
  }

  function handleDeselectAllTasks() {
    setValidationError('')
    setSelectedTaskIds([])
  }

  function handleSubmit(event) {
    event.preventDefault()
    setValidationError('')

    const result = validateIndicatorFilters({
      desdeDate,
      hastaDate,
      selectedTaskIds,
      allTaskIds,
    })

    if (!result.valid) {
      setValidationError(result.error)
      return
    }

    if (onApplyFilters) {
      onApplyFilters(result.filters)
    }
  }

  function handleReset() {
    setDesdeDate('')
    setHastaDate('')
    setSelectedTaskIds(allTaskIds)
    setValidationError('')
    if (onResetFilters) {
      onResetFilters()
    }
  }

  const isFiltered = hasActiveFilters(activeFilters)
  const allSelected = allTaskIds.length > 0 && selectedTaskIds.length === allTaskIds.length

  return (
    <section
      className="dashboard-filters-panel"
      role="region"
      aria-label="Filtros de indicadores del plan"
      style={{ marginBottom: '24px' }}
    >
      <div className="filters-panel-header">
        <div className="filters-title-group">
          <h3 className="filters-heading" style={{ margin: 0, fontSize: '15px', color: '#172536' }}>
            Filtros de análisis (S3-06)
          </h3>
          <p className="filters-subtitle" style={{ margin: '2px 0 0', fontSize: '13px', color: '#516275' }}>
            Filtra por fecha de cierre y selecciona tareas específicas para recalcular las métricas.
          </p>
        </div>

        <div className="filters-badge-group">
          {isFiltered ? (
            <span className="badge badge-active" title="Métricas filtradas">
              ● Filtros activos
            </span>
          ) : (
            <span className="badge badge-subtle" title="Métricas globales sin filtro">
              Reporte completo
            </span>
          )}
        </div>
      </div>

      {/* Resumen textual accesible del filtro activo */}
      {isFiltered && (
        <div className="active-filters-summary" role="status" aria-live="polite">
          <span className="summary-icon" aria-hidden="true">
            🔍
          </span>
          <span className="summary-text">
            <strong>Filtro aplicado:</strong> {describeActiveFilters(activeFilters)}
          </span>
          <button
            type="button"
            className="button button-ghost button-sm"
            onClick={handleReset}
            disabled={disabled}
            style={{ padding: '2px 8px', fontSize: '12px', height: 'auto' }}
          >
            ✕ Quitar filtros
          </button>
        </div>
      )}

      {/* Formulario de filtros */}
      <form onSubmit={handleSubmit} noValidate>
        <div className="filters-grid">
          {/* 1. Período de evaluación */}
          <fieldset className="filters-fieldset">
            <legend className="filters-legend">Período de evaluación (sesiones cerradas)</legend>
            <p className="field-hint" style={{ margin: '0 0 10px', fontSize: '12px' }}>
              Rango temporal de cierre en hora local de Ecuador (-05:00).
            </p>

            <div className="date-inputs-row">
              <div className="filter-input-col">
                <label htmlFor="filter-desde" style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                  Desde (inclusivo)
                </label>
                <input
                  id="filter-desde"
                  type="date"
                  className="input-field"
                  value={desdeDate}
                  onChange={(e) => {
                    setValidationError('')
                    setDesdeDate(e.target.value)
                  }}
                  disabled={disabled}
                  aria-invalid={Boolean(validationError && validationError.includes('Desde'))}
                  aria-describedby={validationError ? errorId : undefined}
                />
              </div>

              <div className="filter-input-col">
                <label htmlFor="filter-hasta" style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                  Hasta (inclusivo)
                </label>
                <input
                  id="filter-hasta"
                  type="date"
                  className="input-field"
                  value={hastaDate}
                  onChange={(e) => {
                    setValidationError('')
                    setHastaDate(e.target.value)
                  }}
                  disabled={disabled}
                  aria-invalid={Boolean(validationError && validationError.includes('Hasta'))}
                  aria-describedby={validationError ? errorId : undefined}
                />
              </div>
            </div>
          </fieldset>

          {/* 2. Tareas a evaluar */}
          <fieldset className="filters-fieldset">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <legend className="filters-legend" style={{ margin: 0, float: 'left' }}>
                Tareas del plan ({selectedTaskIds.length}/{allTaskIds.length})
              </legend>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className="button button-ghost button-sm"
                  onClick={handleSelectAllTasks}
                  disabled={disabled || allSelected}
                  style={{ fontSize: '11px', padding: '2px 6px', height: 'auto' }}
                  title="Marcar todas las tareas del plan"
                >
                  Todas
                </button>
                <button
                  type="button"
                  className="button button-ghost button-sm"
                  onClick={handleDeselectAllTasks}
                  disabled={disabled || selectedTaskIds.length === 0}
                  style={{ fontSize: '11px', padding: '2px 6px', height: 'auto' }}
                  title="Desmarcar todas las tareas"
                >
                  Ninguna
                </button>
              </div>
            </div>

            {tasks.length === 0 ? (
              <p className="field-hint" style={{ fontSize: '12px', fontStyle: 'italic', margin: '4px 0' }}>
                Este plan no cuenta con tareas configuradas.
              </p>
            ) : (
              <div
                className="task-checkbox-list"
                role="group"
                aria-label="Selección de tareas a filtrar"
                style={{
                  maxHeight: '140px',
                  overflowY: 'auto',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '8px',
                  background: '#f8fafc',
                }}
              >
                {tasks.map((task) => {
                  const taskIdStr = String(task.id)
                  const isChecked = selectedTaskIds.includes(taskIdStr)
                  const codeLabel = task.codigo || `T${task.orden || ''}`
                  return (
                    <label
                      key={task.id}
                      htmlFor={`filter-task-${task.id}`}
                      className="task-checkbox-row"
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        padding: '4px 6px',
                        borderRadius: '4px',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        fontSize: '12px',
                        marginBottom: '4px',
                        background: isChecked ? '#ffffff' : 'transparent',
                        border: isChecked ? '1px solid #cbd5e1' : '1px solid transparent',
                      }}
                    >
                      <input
                        id={`filter-task-${task.id}`}
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleTaskToggle(taskIdStr)}
                        disabled={disabled}
                        aria-invalid={Boolean(validationError && validationError.includes('tareas'))}
                        style={{ marginTop: '2px' }}
                      />
                      <span>
                        <strong style={{ color: '#0f172a' }}>{codeLabel}</strong> — {task.titulo}
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
          </fieldset>
        </div>

        {/* Alerta accesible de error de validación */}
        {validationError && (
          <div
            id={errorId}
            role="alert"
            aria-live="assertive"
            className="filter-validation-error"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              marginTop: '12px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              color: '#991b1b',
              fontSize: '13px',
            }}
          >
            <span aria-hidden="true" style={{ fontWeight: 800 }}>
              ⚠
            </span>
            <span>{validationError}</span>
          </div>
        )}

        {/* Botones de acción del filtro */}
        <div
          className="filters-actions-row"
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            marginTop: '16px',
            paddingTop: '12px',
            borderTop: '1px solid #e2e8f0',
          }}
        >
          <button
            type="button"
            className="button button-outline button-sm"
            onClick={handleReset}
            disabled={disabled || (!isFiltered && !desdeDate && !hastaDate && allSelected)}
            title="Restablecer filtros y ver el reporte completo del plan"
          >
            Restablecer filtros
          </button>
          <button
            type="submit"
            className="button button-primary button-sm"
            disabled={disabled}
            title="Aplicar filtros seleccionados al reporte de indicadores"
          >
            Aplicar filtros
          </button>
        </div>
      </form>
    </section>
  )
}
