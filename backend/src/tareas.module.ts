import { Module } from '@nestjs/common'
import { PlansModule } from './planes.module'
import { TasksController } from './tasks.controller'
import { DatabaseModule } from './database.module'
import { TasksService } from './tasks.service'

@Module({ imports: [DatabaseModule, PlansModule], controllers: [TasksController], providers: [TasksService] })
export class TasksModule {}
