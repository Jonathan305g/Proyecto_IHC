import { Body, Controller, Get, HttpCode, Param, Post, Put } from '@nestjs/common'
import { CierreService } from './cierre.service'
@Controller('planes/:planId/sprints-producto/:sprintId')
export class CierreController {
 constructor(private readonly service: CierreService) {}
 @Get('cierre') obtener(@Param('planId') p: string, @Param('sprintId') s: string) { return this.service.obtener(p, s) }
 @Put('cierre') guardar(@Param('planId') p: string, @Param('sprintId') s: string, @Body() b: unknown) { return this.service.guardar(p, s, b) }
 @Post('cerrar') @HttpCode(200) cerrar(@Param('planId') p: string, @Param('sprintId') s: string, @Body() b: unknown) { return this.service.cerrar(p, s, b) }
}
