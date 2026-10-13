-- Migración idempotente para S2-08: metadatos de evidencias
-- Agrega columnas auxiliares opcionales conservando el esquema oficial intacto.
BEGIN;

ALTER TABLE public.evidencias
  ADD COLUMN IF NOT EXISTS nombre_archivo VARCHAR(255),
  ADD COLUMN IF NOT EXISTS tamano_bytes INTEGER,
  ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100);

COMMIT;
