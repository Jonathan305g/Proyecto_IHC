import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database.module'
import { AnalisisController } from './analisis.controller'
import { AnalisisService } from './analisis.service'
import { ProveedorIaModule } from './proveedor.module'

@Module({ imports: [DatabaseModule, ProveedorIaModule], controllers: [AnalisisController], providers: [AnalisisService] })
export class AnalisisModule {}
