# S2-08: Adjuntar y consultar evidencias (HU-03)

**Responsable:** Jonathan Gamboa  
**Alcance:** HU-03 — 8 horas técnicas  
**Rama:** `feature/s2-08-adjuntar-consultar-evidencias-jonathan`

---

## 1. Acuerdo técnico de tipos y tamaño máximo

Se aplican exactamente las mismas reglas y validaciones en la interfaz (React) y en el servidor (NestJS):

| Categoría | Formatos / Extensiones admitidos | Tipos MIME | Límite de tamaño |
|---|---|---|---|
| **Imagen** | `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif` | `image/png`, `image/jpeg`, `image/webp`, `image/gif` | 15 MB |
| **Video** | `.mp4`, `.webm`, `.mov` | `video/mp4`, `video/webm`, `video/quicktime` | 15 MB |
| **Audio** | `.mp3`, `.wav`, `.ogg`, `.m4a` | `audio/mpeg`, `audio/wav`, `audio/ogg`, `audio/mp4`, `audio/x-m4a` | 15 MB |
| **Documento** | `.pdf`, `.txt` | `application/pdf`, `text/plain` | 15 MB |
| **Enlace** | URL externa iniciando con `http://` o `https://` | — | Hasta 2048 caracteres |

### Reglas de validación
1. **Archivo no vacío:** Se rechaza cualquier archivo con 0 bytes de tamaño (`El archivo está vacío.`).
2. **Tamaño máximo:** No se permite superar 15 MB (`El archivo excede el tamaño máximo permitido de 15 MB.`).
3. **Tipo no admitido:** Archivos con extensiones o MIME no autorizados (ej. `.exe`, `.zip`, `.bat`, etc.) son rechazados con error 400 (`Tipo de archivo no admitido.`).
4. **Carga opcional:** Las tareas de una sesión no exigen obligatoriamente una evidencia para ser completadas ni registradas.
5. **Prevención de huérfanos:** Si la transacción en base de datos falla durante la carga, el archivo en disco es eliminado de inmediato evitando archivos huérfanos.

---

## 2. Contratos de API implementados

| Método | Endpoint | Descripción | Respuesta |
|---|---|---|---|
| `POST` | `/api/sesiones/:id/resultados/:tareaId/evidencias` | Carga archivo multipart o JSON de enlace | `201 Created` |
| `GET` | `/api/sesiones/:id/resultados/:tareaId/evidencias` | Lista evidencias de una tarea | `200 OK` |
| `GET` | `/api/sesiones/:id/evidencias` | Lista todas las evidencias de la sesión | `200 OK` |
| `GET` | `/api/evidencias/:id` | Metadatos de la evidencia | `200 OK` |
| `GET` | `/api/evidencias/:id/archivo` | Streaming con `Content-Type` e `inline` | `200 OK` o `302 Redirect` |
| `DELETE` | `/api/evidencias/:id` | Elimina evidencia y borra archivo de disco | `200 OK` |

---

## 3. Comprobación y casos de prueba

| Caso de prueba | Entrada | Resultado esperado | Estado |
|---|---|---|---|
| **Archivo válido** | Imagen PNG o PDF de 2 KB | Almacenado en disco y BD; asociado al resultado correcto | Aprobado |
| **Archivo vacío** | Archivo de 0 bytes | Rechazado tanto en cliente como en servidor | Aprobado |
| **Tipo no admitido** | Archivo `.exe` o `.zip` | Rechazado con mensaje descriptivo | Aprobado |
| **Tamaño excedido** | Archivo > 15 MB | Rechazado antes de persistir | Aprobado |
| **Fallo de transferencia** | Error en BD simulado | Archivo físico eliminado sin dejar huérfanos | Aprobado |
| **Enlace válido** | `https://figma.com/file/...` | Registrado con tipo `enlace` sin almacenamiento en disco | Aprobado |
| **Apertura de evidencia** | Clic en «Abrir evidencia» | Abre en pestaña nueva con visor nativo del navegador | Aprobado |
| **Eliminación confirmada** | Clic en «Eliminar» con modal | Confirma aviso, borra de BD y elimina del disco | Aprobado |
