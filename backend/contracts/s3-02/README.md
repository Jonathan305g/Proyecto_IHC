# Contrato IA 1.0

Definición S3-02 de William Martínez. [Guía completa y entrega al equipo](../../../docs/sprint3/S3-02_CONTRATO_ANALISIS_IA.md).

- `solicitud.schema.json`: entrada mínima y seudónima.
- `respuesta.schema.json`: propuestas exclusivamente en borrador.
- `instruccion.md`: prompt del sistema.
- `seleccionar_observaciones.sql`: fuentes elegibles para revisión autorizada.
- `ejemplos/casos.json`: resultados esperados de respuestas válidas e inválidas.
- Validador reutilizable: `backend/src/analisis-ia/contrato.ts`.

Desde la raíz: `npm ci --prefix backend` y `npm test --prefix backend`.
La integración de proveedor corresponde a S3-03 y los endpoints a S3-07.
