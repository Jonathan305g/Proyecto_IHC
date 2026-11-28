import { Body, Controller, HttpCode, Module, Post } from '@nestjs/common'
import { DatabaseModule } from '../database.module'
import { PlansModule } from '../planes.module'
import { ComparisonService } from './comparison.service'
@Controller('comparaciones')
class ComparisonController {
 constructor(private readonly service: ComparisonService) {}
 @Post() @HttpCode(200) comparar(@Body() b: unknown) { return this.service.comparar(b) }
}
@Module({ imports: [DatabaseModule, PlansModule], controllers: [ComparisonController], providers: [ComparisonService], exports: [ComparisonService] })
export class ComparisonModule {}
