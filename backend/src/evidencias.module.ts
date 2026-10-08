import { Module } from '@nestjs/common'

// El repositorio no contiene el esquema ni el contrato de almacenamiento de
// evidencias. Registrar el módulo no habilita rutas ni inventa tablas.
@Module({})
export class EvidencesModule {}
