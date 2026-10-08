import { Module } from '@nestjs/common'
import { PlansModule } from './planes.module'
import { TasksModule } from './tareas.module'
import { SessionsModule } from './sesiones.module'
import { EvidencesModule } from './evidencias.module'

@Module({
  imports: [PlansModule, TasksModule, SessionsModule, EvidencesModule],
})
export class AppModule {}
