import { IndicatorFilters } from './dto/indicadores.dto'

export interface CategoryIndicators {
  cantidad: number
  porcentaje: number | null
  tiempo: { n: number; total_segundos: number | null; promedio_segundos: number | null }
  errores: { n: number; total: number | null; promedio: number | null }
}

export interface Indicators {
  esperados: number
  evaluados: number
  pendientes: number
  cobertura_porcentaje: number | null
  por_resultado: Record<'sin_ayuda' | 'con_ayuda' | 'no_completado', CategoryIndicators>
}

export interface IndicatorsReport {
  version: '1.0'
  filtro_valido: true
  error_filtro: null
  filtros: IndicatorFilters
  sesiones_incluidas: number
  tareas_seleccionadas: number
  general: Indicators
  por_tarea: (Indicators & { tarea_id: string; codigo: string | null; titulo: string })[]
}

export type InvalidIndicatorsReport = {
  filtro_valido: false
  error_filtro: 'PLAN_INVALIDO' | 'PLAN_INEXISTENTE' | 'PERIODO_INVALIDO' | 'TAREAS_VACIAS' | 'TAREA_INVALIDA'
}
