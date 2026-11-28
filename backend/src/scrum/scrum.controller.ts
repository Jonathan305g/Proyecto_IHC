import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common'
import { ScrumService } from './scrum.service'

@Controller('planes/:planId')
export class ScrumController {
  constructor(private readonly service: ScrumService) {}
  @Get('responsables-producto') responsables(@Param('planId') p: string) { return this.service.responsables(p) }
  @Post('responsables-producto') responsable(@Param('planId') p: string, @Body() b: unknown) { return this.service.guardarResponsable(p, b) }
  @Patch('responsables-producto/:responsableId') editarResponsable(@Param('planId') p: string, @Param('responsableId') r: string, @Body() b: unknown) { return this.service.guardarResponsable(p, b, r) }
  @Get('sprints-producto') listar(@Param('planId') p: string) { return this.service.listar(p) }
  @Post('sprints-producto') crear(@Param('planId') p: string, @Body() b: unknown) { return this.service.guardar(p, b) }
  @Get('sprints-producto/:sprintId') obtener(@Param('planId') p: string, @Param('sprintId') s: string) { return this.service.obtener(p, s) }
  @Put('sprints-producto/:sprintId') editar(@Param('planId') p: string, @Param('sprintId') s: string, @Body() b: unknown) { return this.service.guardar(p, b, s) }
  @Post('sprints-producto/:sprintId/activar') @HttpCode(200) activar(@Param('planId') p: string, @Param('sprintId') s: string, @Body() b: unknown) { return this.service.activar(p, s, b) }
  @Post('sprints-producto/:sprintId/tareas') tarea(@Param('planId') p: string, @Param('sprintId') s: string, @Body() b: unknown) { return this.service.guardarTarea(p, s, b) }
  @Patch('sprints-producto/:sprintId/tareas/:tareaId') editarTarea(@Param('planId') p: string, @Param('sprintId') s: string, @Param('tareaId') t: string, @Body() b: unknown) { return this.service.guardarTarea(p, s, b, t) }
  @Post('sprints-producto/:sprintId/tareas/:tareaId/retirar') @HttpCode(200) retirar(@Param('planId') p: string, @Param('sprintId') s: string, @Param('tareaId') t: string, @Body() b: unknown) { return this.service.retirarTarea(p, s, t, b) }
  @Post('sprints-producto/:sprintId/tareas/:tareaId/estado') @HttpCode(200) mover(@Param('planId') p: string, @Param('sprintId') s: string, @Param('tareaId') t: string, @Body() b: unknown) { return this.service.mover(p, s, t, b) }
}
