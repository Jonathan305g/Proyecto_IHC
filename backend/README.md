# S2-04: persistencia de planes y sesiones

Esta implementación usa las tablas `public.planes`, `tareas`, `participantes` y `sesiones` del esquema de Supabase creado por el equipo. React llama a NestJS; solo NestJS utiliza la credencial PostgreSQL. No uses `anon`, `service_role` ni la contraseña de la BD en variables `VITE_`.

## Ejecución

1. Copia `.env.example` a `.env` y escribe la cadena de conexión **solo en tu máquina**. Si tu red no admite IPv6, usa el *session pooler* indicado por Supabase. Ajusta `DATABASE_SSL` según tu conexión.
2. Ejecuta `npm install` y `npm run dev` en `backend/`.
3. En `frontend/`, copia `.env.example` a `.env`, ejecuta `npm install` y `npm run dev`.
4. Abre el frontend; la API usa `http://localhost:3000/api`.

No vuelvas a ejecutar el SQL de creación sobre una base que ya está en uso. El archivo `.env` está excluido de Git.

## Contrato temporal para S2-02 (Manuel)

| Método | Ruta | Datos principales | Respuesta |
| --- | --- | --- | --- |
| GET | `/api/planes` | — | Lista de planes |
| POST | `/api/planes` | `nombre`, `objetivo`, `tareas[]` | Plan con tareas |
| GET | `/api/planes/:id` | — | Plan con tareas |
| PATCH | `/api/planes/:id` | `nombre`, `objetivo` o `estado` | Plan actualizado |
| POST | `/api/planes/:id/tareas` | `titulo`, `descripcion`, `orden`; `codigo` y `criterio_exito` opcionales | Plan actualizado |
| PATCH | `/api/planes/:id/tareas/:taskId` | Campos editables de tarea | Plan actualizado |
| GET | `/api/sesiones` | — | Lista de sesiones |
| POST | `/api/sesiones` | `plan_id`, `codigo_participante` | Sesión pendiente |
| GET | `/api/sesiones/:id` | — | Sesión, plan y tareas |
| PATCH | `/api/sesiones/:id` | `accion: iniciar` con `consentimiento_confirmado: true`, o `accion: cerrar` | Sesión actualizada |

Ejemplo de creación de plan:

```json
{
  "nombre": "Prueba de navegación",
  "objetivo": "Encontrar información de un curso",
  "tareas": [
    { "titulo": "Buscar curso", "descripcion": "Localiza un curso", "orden": 1, "codigo": "T-01", "criterio_exito": "Abrir la ficha" }
  ]
}
```

IDs PostgreSQL `BIGINT` se entregan como **cadenas** por `pg`. `estado` de plan: `borrador`, `activo`, `finalizado`. `estado` de sesión: `pendiente`, `en_curso`, `cerrada`. Errores: NestJS devuelve 400 para datos inválidos, 404 para registro inexistente y 409 para conflicto. La creación del plan y sus tareas es transaccional. La sesión puede reabrirse con `GET /api/sesiones/:id` tras recargar.

## Integración pendiente con S2-02 y S2-03

La rama disponible `feature/HU-03-bd` contiene otra migración Prisma (`test_plans`, UUID y estados ingleses), incompatible con las 14 tablas `public.*` de Supabase. Manuel debe decidir con el equipo cuál esquema es el contrato oficial, adaptar su arranque NestJS y evitar conservar dos modelos de datos distintos. Si se adopta Supabase, debe conservar estas rutas y tipos o coordinar los cambios con William antes de modificar el frontend. Pablo debe publicar el SQL reproducible con RLS. No ejecutes esa migración Prisma sobre la base Supabase existente.
