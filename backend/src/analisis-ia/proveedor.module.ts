import { Module } from '@nestjs/common'
import { ProveedorIA } from './proveedor'

/** S3-07 puede importar este modulo e inyectar el adaptador sin duplicar configuracion. */
@Module({ providers: [{ provide: ProveedorIA, useFactory: () => new ProveedorIA() }], exports: [ProveedorIA] })
export class ProveedorIaModule {}
