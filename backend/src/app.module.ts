import { Module } from '@nestjs/common'
import { PlansModule } from './planes.module'
import { TasksModule } from './tareas.module'
import { SessionsModule } from './sesiones.module'
import { EvidencesModule } from './evidencias.module'
import { APP_FILTER } from '@nestjs/core'
import { ApiErrorFilter } from './api-error.filter'

@Module({
  imports: [PlansModule, TasksModule, SessionsModule, EvidencesModule],
  providers: [{ provide: APP_FILTER, useClass: ApiErrorFilter }],
})
export class AppModule {}
