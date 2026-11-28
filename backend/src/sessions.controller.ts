import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common'
import { SessionsService } from './sessions.service'

@Controller('sesiones')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Get()
  list() { return this.sessions.list() }

  @Get(':id')
  detail(@Param('id') id: string) { return this.sessions.detail(id) }

  @Post()
  create(@Body() body: unknown) { return this.sessions.create(body) }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown) { return this.sessions.update(id, body) }
}
