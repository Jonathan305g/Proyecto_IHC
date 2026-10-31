# Frontend React

Node.js >= 22.12. Desde `frontend`: `npm ci`, copiar `.env.example` a `.env` y completar URL API, URL Supabase y clave pública. `npm run dev` abre Vite normalmente en `http://localhost:5173`.

Requiere backend activo, migraciones y cuentas de aplicación autorizadas. Consulta [README principal](../README.md) y [activación](../docs/PREPARACION_SPRINT_3.md). Ninguna clave secreta ni contraseña PostgreSQL pertenece a variables `VITE_`.

## Flujo integrado

Login → planes y asistente → tareas → sesiones y consentimiento → ejecución y cronómetro → resultados y evidencias → resumen y cierre. La consulta de resultados reúne evaluaciones y evidencias de cada sesión. La API real ya implementa las rutas que utiliza esta interfaz.

Borradores en localStorage conservan campos y tiempo en el navegador. No sustituyen el guardado en el servidor ni se sincronizan entre máquinas. Los archivos y resultados guardados sí se comparten mediante backend/BD/Storage. Un fallo de consulta se muestra como error con reintento; una tarea con evidencia pero sin evaluación sigue pendiente. El cierre se bloquea si hay cambios locales sin guardar.

## Verificación

- `npm test`: lógica de cronómetro, validación, progreso, borradores pendientes y preparación de planes.
- `npm run build`: compilación.
- `npx playwright install chromium` y `npm run test:e2e`: regresiones de navegador con Auth y API controladas. Se usa puerto 4173; las pruebas no consumen el Supabase del equipo.

El servidor de publicación debe devolver `index.html` también al abrir rutas directas. El backend autoriza todas las operaciones; la clave pública del cliente no otorga acceso a sus tablas ni al bucket privado.
