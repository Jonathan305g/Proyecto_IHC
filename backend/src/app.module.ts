import { Module } from '@nestjs/common'
import { PlansModule } from './planes.module'
import { TasksModule } from './tareas.module'
import { SessionsModule } from './sesiones.module'
import { EvidencesModule } from './evidencias.module'
import { AuthGuard } from './auth.guard'
import { APP_FILTER, APP_GUARD } from '@nestjs/core'
import { ApiErrorFilter } from './api-error.filter'
import { AnalisisModule } from './analisis-ia/analisis.module'
import { BacklogModule } from './backlog/backlog.module'
import { ScrumModule } from './scrum/scrum.module'

@Module({
  imports: [PlansModule, TasksModule, SessionsModule, EvidencesModule, AnalisisModule, BacklogModule, ScrumModule],
  providers: [AuthGuard, { provide: APP_FILTER, useClass: ApiErrorFilter }, { provide: APP_GUARD, useExisting: AuthGuard }],
})
export class AppModule {}
