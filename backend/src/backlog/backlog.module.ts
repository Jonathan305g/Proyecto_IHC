import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database.module'
import { BacklogController } from './backlog.controller'
import { BacklogService } from './backlog.service'
@Module({imports:[DatabaseModule],controllers:[BacklogController],providers:[BacklogService]})
export class BacklogModule {}
