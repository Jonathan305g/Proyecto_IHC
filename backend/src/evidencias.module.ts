import { StorageService } from './storage.service'
import { Module } from '@nestjs/common'
import { DatabaseModule } from './database.module'
import { EvidencesController } from './evidencias.controller'
import { EvidencesService } from './evidencias.service'

@Module({
  imports: [DatabaseModule],
  controllers: [EvidencesController],
  providers: [EvidencesService, StorageService],
  exports: [EvidencesService],
})
export class EvidencesModule {}
