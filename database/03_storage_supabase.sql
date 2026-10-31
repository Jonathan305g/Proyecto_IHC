-- Solo Supabase. Ejecutar en SQL Editor después de crear/actualizar el esquema público.
-- Privado: NestJS autoriza al usuario y emite enlaces de descarga de 60 segundos.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('evidencias', 'evidencias', false, 15728640)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit;
-- No conceder acceso público a storage.objects. El backend usa su clave secreta.
