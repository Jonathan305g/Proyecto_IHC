import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseService } from './database.service'
import { parseIndicatorFilters } from './dto/indicadores.dto'
import { IndicatorsReport, InvalidIndicatorsReport } from './indicators.types'

// Una sola fuente de cálculo; ruta relativa al módulo, independiente del cwd.
const sql = readFileSync(join(__dirname, '../../database/sprint3/s3-01/metricas.sql'), 'utf8')
const filterErrors = {
  PLAN_INVALIDO: { field: 'plan_id', message: 'El identificador del plan es inválido.' },
  PLAN_INEXISTENTE: { field: 'plan_id', message: 'El plan no existe.' },
  PERIODO_INVALIDO: { field: 'hasta', message: 'El período exige desde menor que hasta.' },
  TAREAS_VACIAS: { field: 'tarea_ids', message: 'Selecciona al menos una tarea.' },
  TAREA_INVALIDA: { field: 'tarea_ids', message: 'Las tareas deben ser únicas y pertenecer al plan.' },
} as const

@Injectable()
export class IndicatorsService {
  constructor(private readonly db: DatabaseService) {}

  async report(planId: unknown, query: unknown = {}): Promise<IndicatorsReport> {
    const filters = parseIndicatorFilters(planId, query)
    const { rows } = await this.db.query<{ reporte: IndicatorsReport | InvalidIndicatorsReport }>(sql,
      [filters.plan_id, filters.desde, filters.hasta, filters.tarea_ids])
    const report = rows[0]?.reporte
    if (!report) throw new InternalServerErrorException()
    if (!report.filtro_valido) {
      const error = filterErrors[report.error_filtro]
      if (!error) throw new InternalServerErrorException()
      const payload = { message: error.message, details: [{ field: error.field, rule: report.error_filtro }] }
      if (report.error_filtro === 'PLAN_INEXISTENTE') throw new NotFoundException(payload)
      throw new BadRequestException(payload)
    }
    return report
  }
}
