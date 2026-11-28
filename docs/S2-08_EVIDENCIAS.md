# S2-08 · Evidencias — contrato actualizado

Implementación original: Jonathan Gamboa. Corrección de integración previa al Sprint 3: almacenamiento compartido, autorización, estados y validación.

Consulta el [contrato de API](../backend/README.md) y el [procedimiento de activación](PREPARACION_SPRINT_3.md).

- Archivos nuevos: bucket privado de Supabase Storage; metadatos en PostgreSQL y ruta `supabase://<objeto>`.
- Formatos: PNG/JPEG/WebP/GIF; MP4/WebM/MOV; MP3/WAV/OGG/M4A; PDF/TXT. Límite 15 MB aplicado durante recepción multipart y validado contra el tamaño real. Coherencia de extensión, MIME y firma; no es un antivirus.
- Enlaces HTTP(S) completos de hasta 2048 caracteres, sin credenciales en la URL.
- Adjuntar es opcional y no completa por sí solo una evaluación.
- Crear/eliminar exige sesión en curso con consentimiento; consultar y abrir también funciona en sesiones cerradas.
- Todas las rutas exigen token de una cuenta confirmada y autorizada. La interfaz solicita acceso y abre un enlace firmado de 60 segundos; no expone la clave de Storage.
- Los errores de consulta muestran reintento. Los borrados con fallo de Storage se reintentan con la cola de limpieza.
- Archivos locales anteriores: inspección y migración explícita mediante `storage:migrate`; originales conservados.

Las pruebas automáticas verifican validaciones, HTTP, estados y compensación con servicios externos controlados. La guía incluye un ensayo real desde dos máquinas para verificar el bucket del equipo.
