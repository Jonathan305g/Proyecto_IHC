import { Module } from '@nestjs/common'
import { DatabaseModule } from './database.module'
import { PlansController } from './plans.controller'
import { PlansService } from './plans.service'
import { IndicatorsController } from './indicators.controller'
import { IndicatorsService } from './indicators.service'

@Module({ imports: [DatabaseModule], controllers: [PlansController, IndicatorsController], providers: [PlansService, IndicatorsService], exports: [PlansService] })
export class PlansModule {}
