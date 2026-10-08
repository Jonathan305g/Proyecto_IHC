import { Module } from '@nestjs/common'
import { DatabaseService } from './database.service'
import { PlansController } from './plans.controller'
import { PlansService } from './plans.service'
import { SessionsController } from './sessions.controller'
import { SessionsService } from './sessions.service'

@Module({
  controllers: [PlansController, SessionsController],
  providers: [DatabaseService, PlansService, SessionsService],
})
export class AppModule {}
