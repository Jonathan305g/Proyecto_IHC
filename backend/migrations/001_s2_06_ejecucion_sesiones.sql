-- Migración idempotente: se puede repetir antes de desplegar S2-06.
-- No modifica credenciales.
BEGIN;
ALTER TABLE public.planes ADD COLUMN IF NOT EXISTS cupo INTEGER;
-- NULL conserva los planes existentes sin un límite inventado.
ALTER TABLE public.resultados ADD COLUMN IF NOT EXISTS con_ayuda BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.planes'::regclass AND conname = 'planes_cupo_check'
  ) THEN
    ALTER TABLE public.planes ADD CONSTRAINT planes_cupo_check CHECK (cupo > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.resultados'::regclass AND conname = 'resultados_ayuda_completada'
  ) THEN
    ALTER TABLE public.resultados ADD CONSTRAINT resultados_ayuda_completada
      CHECK (NOT con_ayuda OR completada IS TRUE);
  END IF;
END;
$$;
COMMIT;
