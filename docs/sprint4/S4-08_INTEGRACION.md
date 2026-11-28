# S4-08 - Integracion y version evaluable

Responsable: Manuel Cusme. Calidad transversal. Base develop 922a934.

## Instalacion desde el repositorio integrado

Node >=22.12, npm, proyecto Supabase existente y cuentas autorizadas.
Conservar backend/.env y frontend/.env privados; usar sus .env.example solo
como referencia, nunca sobrescribir la configuracion que ya funciona.

```powershell
npm ci --prefix backend
npm ci --prefix frontend
npm run build
node --env-file=backend/.env backend/scripts/migrate-sprint4.cjs --apply
node --env-file=backend/.env backend/scripts/migrate-sprint4.cjs --check
Push-Location frontend
npx playwright install chromium
Pop-Location
npm run verify:sprint4
```

Para instalar Chromium puede usarse tambien `cd frontend`, `npx playwright
install chromium` y volver a la raiz. No se requiere CLI Supabase para instalar
las migraciones entregadas. No se eliminan datos ni se cargan fixtures reales.

En terminales separadas: npm run dev:backend y npm run dev:frontend. Abrir
http://localhost:5173 e iniciar sesion. Rutas nuevas: /sprints, /comparacion,
/informes y /sprints/:id/tablero o /cierre con plan_id.

## Puertas de comprobacion

1. `verify:sprint4` ejecuta todas las pruebas, compilacion y navegador. Guarda
   fecha, Node, commit, arbol y resultados en verification-results/sprint4.
2. Para el entorno del equipo: npm run verify:environment y el ensayo existente
   `node --env-file=backend/.env backend/scripts/verify-live.cjs --apply`, que
   comprueba Auth/Storage reales y retira solo sus datos.
3. Para el recorrido nuevo con Gemini real:
   `node --env-file=backend/.env backend/scripts/verify-sprint4-live.cjs --apply`.
   Requiere IA_MODE=gemini, clave privada y E2E_TEST_EMAIL/PASSWORD autorizados.
   Crea dos planes temporales exactos, una solicitud Gemini, evidencia de enlace,
   analisis/revision/aprobacion, sprint y cierre; compara y descarga. Retira solo
   los registros de esos dos nombres aleatorios, incluso ante fallos. No se
   ejecuta remotamente al instalar o al hacer npm test. Si Gemini no devuelve
   propuestas validas se informa pendiente, sin fabricar hallazgos.
4. Comprobacion visual por el equipo sobre la version identificada. Esta entrega
   termina en S4-08: S4-09/S4-10 quedan para una entrega posterior con datos reales.
5. Tras incorporar los hallazgos reales y correcciones S4-10, repetir 1-4 en la
   misma version integrada. No publicar main automaticamente desde este ZIP.

## Evidencia tecnica

S4-08_integracion.test.cjs ejecuta controladores HTTP, servicios, SQL y generacion
PDF reales con PGlite. Solo Auth remoto y transporte Gemini estan controlados.
El flujo compartido con el ensayo remoto comprueba plan, consentimiento, sesiones,
evidencia, resultados, IA, privacidad, origen, aprobacion repetida, backlog,
capacidad, tareas, estados, review, acuerdos, cierre, comparacion y dos formatos.
La llamada al proveedor ocurre una sola vez. La BD del equipo y sus secretos
no se usan en tests. La prueba tecnica no se atribuye a participantes de S4-09.

## Identificacion y dependencia circular del plan

VERSION_EVALUABLE.json identifica la candidata 0.4.0-rc.1 y el comando registra
su revision Git exacta. S4-08 entrega una candidata comprobada para evaluar.
La evaluacion y los ajustes posteriores se trabajan en S4-09/S4-10, fuera del
alcance solicitado para este ZIP. No se atribuyen sesiones ni resultados de usuarios.

## Correcciones de integracion

Se restaura el foco al control de estado despues de mover una tarjeta. Se
protegen los borradores de planificacion y review con confirmacion al navegar,
incluido Atras, y aviso nativo ante recarga. Se usa RouterProvider de la version
React Router ya instalada; no se cambia su dependencia. Se repite toda la regresion.
El informe y su comparacion comparten la misma transaccion de lectura para
evitar que una sesion cerrada concurrentemente produzca dos alcances distintos.
El chequeo de migraciones exige las tablas concretas y RLS de las migraciones
presentes, incluidas las de cierre. Ver REGISTRO_DEFECTOS.md y la evidencia tecnica.
