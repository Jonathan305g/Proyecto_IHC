import { Body, Controller, Get, Header, HttpCode, Module, Param, Post, StreamableFile } from '@nestjs/common'
import { DatabaseModule } from '../database.module'
import { PlansModule } from '../planes.module'
import { ComparisonModule } from '../comparison/comparison.module'
import { ReportsService } from './reports.service'
@Controller('informes')
class ReportsController {
 constructor(private readonly service: ReportsService) {}
 @Post('previsualizar') @HttpCode(200) @Header('Cache-Control', 'no-store') preparar(@Body() body: unknown) { return this.service.preparar(body) }
 @Get(':reporteId/:formato') @Header('Cache-Control', 'no-store') async descargar(@Param('reporteId') r: string, @Param('formato') f: string) {
  const file = await this.service.descargar(r, f)
  return new StreamableFile(file.bytes, { type: file.type, disposition: `attachment; filename="${file.filename}"`, length: file.bytes.length })
 }
}
@Module({ imports: [DatabaseModule, PlansModule, ComparisonModule], controllers: [ReportsController], providers: [ReportsService], exports: [ReportsService] })
export class ReportsModule {}
