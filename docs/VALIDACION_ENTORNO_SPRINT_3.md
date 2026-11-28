# Validación del entorno antes del Sprint 3

Rama de trabajo: `fix/sprint3-validacion-entorno`, desde `develop` en `56c7e4a`.
Fecha de comprobación: 1 de noviembre de 2026, Ecuador.

## Estado comprobado

| Elemento | Estado y evidencia |
| --- | --- |
| Esquema en Supabase | 15 tablas públicas, incluida la cola de limpieza; bucket `evidencias` privado. |
| Índices en Supabase | Consulta real al catálogo: ninguna clave foránea pública sin índice de apoyo. |
| Reproducción del esquema | Migración con ocho índices, ambos esquemas sincronizados y prueba PostgreSQL embebida repetible. |
| Pruebas locales | 33 del backend y 21 del frontend aprobadas; ambas compilaciones aprobadas. |
| Cuentas del equipo | Cero usuarios en Auth en la consulta inicial de esta revisión. Falta una lista de nombres y correos confirmada por el equipo. |
| Registro público | Sigue pendiente desactivarlo y verificarlo. El complemento no expone este ajuste; el acceso al panel mediante ChatGPT quedó bloqueado por la revisión automática del navegador. |
| Configuración privada | Este entorno no dispone de DATABASE_URL, clave secreta y credenciales de una cuenta de prueba del equipo. Los ejemplos no contienen secretos reales. |
| Ensayo HTTP real | No aprobado todavía. Se añadió un ejecutor que requiere esas credenciales y falla con estado pendiente cuando faltan. |
| Navegador | No ejecutado en esta revisión: la descarga de Chromium recibida por este entorno era inválida. GitHub Actions conserva los cuatro escenarios del navegador. |
| Publicación | La integración de GitHub rechazó crear la rama con HTTP 403 y el push por terminal falló por falta de credenciales. La rama todavía no está publicada; se entrega también un bundle para importar los commits. |

Este documento registra lo comprobado; las cuentas y el ensayo real siguen siendo condiciones para cerrar la preparación del entorno.

## 1. Crear las cuentas autorizadas

1. Confirmar la lista exacta `Nombre — correo` de las personas que accederán a la aplicación. Los autores de commits y los miembros del panel no sustituyen esta confirmación.
2. En Supabase, abrir **Authentication → Users** y crear las cuentas con el procedimiento administrativo del equipo. Cada persona debe recibir o establecer su contraseña por un canal privado; no incluir contraseñas en Git, informes, capturas ni conversaciones.
3. Confirmar los correos de las cuentas que estén autorizadas. La lista `AUTH_ALLOWED_EMAILS` debe contener los mismos correos; estar registrado en Auth no concede acceso al backend por sí solo.
4. En **Authentication → Sign In / Providers → User Signups**, desactivar la opción que permite nuevos registros públicos y guardar. Mantener habilitado el inicio de sesión por email.
5. Ejecutar la comprobación del punto 3. El verificador debe informar que todas las cuentas autorizadas existen y tienen el correo confirmado, y que `disable_signup=true`.

## 2. Configurar cada máquina

Desde la carpeta raíz del repositorio en PowerShell, crear los archivos privados solo si todavía no existen:

```powershell
if (!(Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }
if (!(Test-Path frontend/.env)) { Copy-Item frontend/.env.example frontend/.env }
```

Completar los valores en un editor local:

| Backend | Contenido |
| --- | --- |
| `DATABASE_URL` | URI PostgreSQL del pooler del proyecto, con usuario y contraseña correctos. |
| `DATABASE_SSL` | `true`; añadir `DATABASE_CA_CERT` si se necesita la CA oficial. |
| `SUPABASE_URL` | URL del proyecto. |
| `SUPABASE_PUBLISHABLE_KEY` | Clave pública del mismo proyecto; será la misma en el frontend. |
| `SUPABASE_SECRET_KEY` | Clave secreta del servidor; nunca una variable `VITE_`. |
| `SUPABASE_STORAGE_BUCKET` | `evidencias`. |
| `AUTH_ALLOWED_EMAILS` | Correos confirmados autorizados, separados por comas. |
| `FRONTEND_ORIGIN` | `http://localhost:5173` durante el desarrollo local. |
| `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD` | Solo para el ensayo real: cuenta autorizada y contraseña privada. |

Frontend: `VITE_API_BASE_URL=http://localhost:3000`, `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`. La URL del backend no lleva `/api` al final. El verificador también lee los archivos `.env.local` y de modo desarrollo con la prioridad de Vite.

## 3. Comprobar la configuración sin crear datos

```powershell
npm ci --prefix backend
npm ci --prefix frontend
npm run verify:environment
```

El comando comprueba configuración pública coincidente entre frontend y backend, TLS, RLS, índices, cuentas confirmadas, registro público desactivado y bucket privado con límite de 15 MiB. No imprime valores de claves ni contraseñas.

Salida: `OK` por cada comprobación aprobada y `PENDIENTE` por las no aprobadas. Un código de salida **2** significa configuración o verificación pendiente; **1** indica que no se pudo completar el proceso. La ausencia de errores de compilación no sustituye este paso.

## 4. Ejecutar el ensayo real

Con los valores privados completos y todas las comprobaciones anteriores aprobadas:

```powershell
npm run verify:live -- --apply
```

El comando utiliza la misma fábrica de aplicación que `main.ts`, sin sustituir Auth, PostgreSQL ni Storage. Levanta un backend temporal en un puerto local libre; no modifica el backend desplegado ni su configuración.

Comprueba:

1. Login real de Supabase; rechazo de llamadas sin token, con token inválido y con un usuario autenticado fuera de la lista autorizada del backend temporal.
2. Creación y recuperación de un plan, dos tareas, participante anónimo y sesión con consentimiento.
3. Subida real de texto; resultado aún pendiente; descarga firmada con igualdad SHA-256; rechazo de descarga pública del archivo privado.
4. Eliminación del archivo y retiro de su entrada en la cola.
5. Actualización de resultados sin duplicados, conservación de la evidencia y cierre de la sesión.
6. Rechazo de cambios en resultados y evidencias tras el cierre.
7. Limpieza de los archivos y registros del plan exacto creado en esa ejecución. No se eliminan registros anteriores. Las secuencias de identidad pueden avanzar aunque se retiren los datos temporales.

Sin `--apply`, solo explica el ensayo y termina con código 2. Con requisitos faltantes también termina con código 2 antes de hacer escrituras. Si un paso o la limpieza fallan, termina con código 1 y no declara el ensayo aprobado. El marcador `VERIFICACION-...` permite identificar los datos propios si la limpieza necesita revisión.

## 5. Validación visual y trabajo del equipo

```powershell
npm run dev:backend
```

En otra terminal de la misma raíz:

```powershell
npm run dev:frontend
```

Iniciar sesión desde React, abrir los datos guardados y realizar una subida/descarga desde otra máquina configurada para el mismo proyecto. Las pruebas HTTP y los tests de navegador con respuestas controladas no acreditan por sí solos esta comprobación entre máquinas.

## Migración de los índices

El archivo SQL se generó con `supabase migration new` y se incorporó a la carpeta de migraciones que ya utiliza este repositorio. Es repetible y se aplica después de las migraciones anteriores. El esquema inicial incluye los mismos índices.

El Supabase del equipo ya tenía esos ocho índices de la revisión del 31 de octubre; esta entrega los conserva en Git. El historial remoto anterior procede de migraciones aplicadas desde el complemento; no se ha reiniciado ni reescrito. No ejecutar `supabase db push` suponiendo que esta carpeta es un historial completo de Supabase CLI.
