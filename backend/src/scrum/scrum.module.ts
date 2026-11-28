import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database.module'
import { ScrumController } from './scrum.controller'
import { ScrumService } from './scrum.service'
import { CierreService } from './cierre.service'
import { CierreController } from './cierre.controller'

@Module({ imports: [DatabaseModule], controllers: [ScrumController, CierreController], providers: [ScrumService, CierreService], exports: [ScrumService, CierreService] })
export class ScrumModule {}
