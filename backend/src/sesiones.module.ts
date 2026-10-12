import { Module } from '@nestjs/common'
import { DatabaseModule } from './database.module'
import { SessionsController } from './sessions.controller'
import { SessionsService } from './sessions.service'
import { ResultsController } from './results.controller'
import { ResultsService } from './results.service'

@Module({ imports: [DatabaseModule], controllers: [SessionsController, ResultsController], providers: [SessionsService, ResultsService], exports: [SessionsService, ResultsService] })
export class SessionsModule {}
