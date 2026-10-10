-- Ejecutar una sola vez antes de desplegar S2-06. No modifica credenciales.
BEGIN;
ALTER TABLE public.planes ADD COLUMN cupo INTEGER CHECK (cupo > 0);
-- NULL conserva los planes existentes sin un límite inventado.
ALTER TABLE public.resultados ADD COLUMN con_ayuda BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.resultados ADD CONSTRAINT resultados_ayuda_completada
  CHECK (NOT con_ayuda OR completada IS TRUE);
COMMIT;
