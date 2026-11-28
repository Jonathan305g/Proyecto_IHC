import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database.module'
import { ScrumController } from './scrum.controller'
import { ScrumService } from './scrum.service'

@Module({ imports: [DatabaseModule], controllers: [ScrumController], providers: [ScrumService], exports: [ScrumService] })
export class ScrumModule {}
