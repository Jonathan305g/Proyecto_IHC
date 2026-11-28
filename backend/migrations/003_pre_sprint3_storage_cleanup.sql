BEGIN;
-- Cola de limpieza: se confirma junto con el borrado de metadatos.
CREATE TABLE IF NOT EXISTS public.storage_deletions (
  object_key TEXT PRIMARY KEY,
  creada_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.storage_deletions ENABLE ROW LEVEL SECURITY;
COMMIT;
