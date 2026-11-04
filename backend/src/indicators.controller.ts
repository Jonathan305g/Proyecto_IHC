import { Controller, Get, Param, Query } from '@nestjs/common'
import { IndicatorsService } from './indicators.service'

@Controller('planes/:id/indicadores')
export class IndicatorsController {
  constructor(private readonly indicators: IndicatorsService) {}

  @Get()
  report(@Param('id') id: string, @Query() query: unknown) {
    return this.indicators.report(id, query)
  }

  @Get('general')
  async general(@Param('id') id: string, @Query() query: unknown) {
    const { por_tarea, ...report } = await this.indicators.report(id, query)
    return report
  }

  @Get('tareas')
  async tasks(@Param('id') id: string, @Query() query: unknown) {
    const { general, ...report } = await this.indicators.report(id, query)
    return report
  }
}
