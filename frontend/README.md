# Frontend del panel de pruebas de usabilidad

Base React de S2-01 ampliada con la persistencia de S2-04. Las pantallas de Planes y Sesiones consultan NestJS para crear, editar y volver a abrir registros. Resultados conserva su pantalla base para las próximas tareas.

## Requisitos

- Node.js 20.19 o superior, o Node.js 22.12 o superior.
- npm disponible con Node.js.

## Ejecución

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

En Windows PowerShell, usa `Copy-Item .env.example .env` en lugar de `cp`. Abre la dirección que muestre Vite, normalmente `http://localhost:5173`.

Las pantallas de planes y sesiones de S2-04 consultan el backend NestJS en `../backend`. Configura `VITE_API_BASE_URL=http://localhost:3000` en `.env`. Nunca coloques claves secretas en variables `VITE_`, ya que se incluyen en el código del navegador. Consulta `../backend/README.md` para el contrato de rutas y la conexión a Supabase.

## Comprobación de persistencia

1. Crea un plan con dos tareas, guarda y copia la URL del detalle.
2. Recarga esa URL: deben aparecer el nombre, el estado y las dos tareas.
3. Modifica el objetivo y una tarea; vuelve a recargar para comprobarlos.
4. Crea una sesión con un código anónimo, copia su URL y recarga.
5. Confirma consentimiento, inicia la sesión, recarga y después ciérrala.
6. Reinicia React y NestJS; vuelve a abrir ambas URL y comprueba que persisten.

## Integración posterior

- `src/pages/PlansPage.jsx` y `/planes/nuevo`: creación y consulta básicas de S2-04; S2-05 puede ampliar el asistente.
- `src/pages/SessionsPage.jsx` y `/sesiones/nueva`: alta y estado de S2-04; S2-07 puede ampliar la ejecución de tareas.
- `src/pages/ResultsPage.jsx`: consulta de resultados y evidencias.
- `src/services/apiClient.js`: conexión HTTP configurable y mensajes de error de la API.
- `src/components/UiState.jsx`: estados compartidos para páginas que consulten datos.

El servidor que publique la compilación deberá devolver `index.html` también para las rutas directas de la aplicación.

Para verificar la compilación antes de integrar cambios: `npm run build`.
