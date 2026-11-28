import { Body, Controller, Get, Param, Put } from '@nestjs/common'
import { ResultsService } from './results.service'

@Controller('sesiones/:id/resultados')
export class ResultsController {
  constructor(private readonly results: ResultsService) {}

  @Get()
  list(@Param('id') id: string) { return this.results.list(id) }

  @Put(':tareaId')
  save(@Param('id') id: string, @Param('tareaId') taskId: string, @Body() body: unknown) {
    return this.results.save(id, taskId, body)
  }
}
