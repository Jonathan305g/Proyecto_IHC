import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common'
import { PlansService } from './plans.service'

@Controller('planes')
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Get()
  list() { return this.plans.list() }

  @Get(':id')
  detail(@Param('id') id: string) { return this.plans.detail(id) }

  @Post()
  create(@Body() body: unknown) { return this.plans.create(body) }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown) { return this.plans.update(id, body) }

}
