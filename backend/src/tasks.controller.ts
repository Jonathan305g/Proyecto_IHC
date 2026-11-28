import { Body, Controller, Param, Patch, Post } from '@nestjs/common'
import { TasksService } from './tasks.service'

@Controller('planes/:id/tareas')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Post()
  create(@Param('id') id: string, @Body() body: unknown) { return this.tasks.addTask(id, body) }

  @Patch(':taskId')
  update(@Param('id') id: string, @Param('taskId') taskId: string, @Body() body: unknown) {
    return this.tasks.updateTask(id, taskId, body)
  }
}
