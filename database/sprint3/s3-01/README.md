# Referencia de métricas 1.0

Definición S3-01 de William Martínez. [Diccionario, cálculo manual y entrega al equipo](../../../docs/sprint3/S3-01_METRICAS_Y_VERIFICACION.md).

- `metricas.sql`: consulta parametrizada de lectura sobre el esquema actual.
- `datos_verificacion.sql`: datos de referencia para BD vacía y desechable.
- `resultados_esperados.json`: 15 casos con resultados fijados manualmente.

Desde la raíz: `npm ci --prefix backend` y `node --test backend/test/s3-01-metricas.test.cjs`.
El test prepara una BD PGlite aislada. El fixture exige una guarda explícita.
Manuel implementa la API S3-04 usando estas reglas y respuestas de referencia.
