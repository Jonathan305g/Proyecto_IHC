import { Body, Controller, Get, HttpCode, Param, Post, Put } from '@nestjs/common'
import { AnalisisService } from './analisis.service'

@Controller('planes/:planId/analisis-ia')
export class AnalisisController {
  constructor(private readonly analisis: AnalisisService) {}

  @Post()
  crear(@Param('planId') planId: string, @Body() body: unknown) {
    return this.analisis.crear(planId, body)
  }

  @Get(':analisisId')
  consultar(@Param('planId') planId: string, @Param('analisisId') analisisId: string) {
    return this.analisis.consultar(planId, analisisId)
  }

  @Put(':analisisId/revision')
  revisar(@Param('planId') planId: string, @Param('analisisId') analisisId: string, @Body() body: unknown) {
    return this.analisis.revisar(planId, analisisId, body)
  }

  @Post(':analisisId/ejecutar')
  @HttpCode(200)
  ejecutar(@Param('planId') planId: string, @Param('analisisId') analisisId: string, @Body() body: unknown) {
    return this.analisis.ejecutar(planId, analisisId, body, false)
  }

  @Post(':analisisId/reintentar')
  @HttpCode(200)
  reintentar(@Param('planId') planId: string, @Param('analisisId') analisisId: string, @Body() body: unknown) {
    return this.analisis.ejecutar(planId, analisisId, body, true)
  }
}
