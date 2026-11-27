import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common'
import { BacklogService } from './backlog.service'

@Controller('planes/:planId')
export class BacklogController {
  constructor(private readonly service:BacklogService) {}
  @Get('observaciones-ia') observaciones(@Param('planId') p:string) {return this.service.observaciones(p)}
  @Get('analisis-ia') analisis(@Param('planId') p:string) {return this.service.analisis(p)}
  @Post('analisis-ia/:analisisId/hallazgos') @HttpCode(200)
  importar(@Param('planId') p:string,@Param('analisisId') a:string,@Body() body:unknown) {return this.service.importar(p,a,body)}
  @Get('hallazgos') hallazgos(@Param('planId') p:string,@Query() q:unknown) {return this.service.hallazgos(p,q)}
  @Get('hallazgos/:hallazgoId') hallazgo(@Param('planId') p:string,@Param('hallazgoId') h:string) {return this.service.hallazgo(p,h)}
  @Put('hallazgos/:hallazgoId') guardar(@Param('planId') p:string,@Param('hallazgoId') h:string,@Body() b:unknown) {return this.service.guardar(p,h,b)}
  @Post('hallazgos/:hallazgoId/aprobar') @HttpCode(200)
  aprobar(@Param('planId') p:string,@Param('hallazgoId') h:string,@Body() b:unknown) {return this.service.aprobar(p,h,b)}
  @Post('hallazgos/:hallazgoId/descartar') @HttpCode(200)
  descartar(@Param('planId') p:string,@Param('hallazgoId') h:string,@Body() b:unknown) {return this.service.descartar(p,h,b)}
  @Get('historias') historias(@Param('planId') p:string,@Query() q:unknown) {return this.service.historias(p,q)}
  @Post('historias') crear(@Param('planId') p:string,@Body() b:unknown) {return this.service.crearHistoria(p,b)}
  @Put('historias/orden') ordenar(@Param('planId') p:string,@Body() b:unknown) {return this.service.ordenar(p,b)}
  @Get('historias/:historiaId') detalle(@Param('planId') p:string,@Param('historiaId') h:string) {return this.service.historia(p,h)}
  @Patch('historias/:historiaId') editar(@Param('planId') p:string,@Param('historiaId') h:string,@Body() b:unknown) {return this.service.editarHistoria(p,h,b)}
}
