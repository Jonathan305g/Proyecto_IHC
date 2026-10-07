# Frontend del panel de pruebas de usabilidad

Estructura inicial del Sprint 2, tarea S2-01. Contiene las rutas y pantallas base de Planes, Sesiones y Resultados, además de componentes para estados vacíos, de carga y de error. Las pantallas de creación son puntos de integración para las tareas S2-05 y S2-07; todavía no guardan datos.

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

La estructura inicial funciona sin backend. La variable `VITE_API_BASE_URL` queda preparada para el servicio de NestJS; nunca coloques claves secretas en variables `VITE_`, ya que se incluyen en el código del navegador.

## Comprobación de navegación

1. Abre `/` y verifica que redirige a `/planes`.
2. Usa el menú lateral para pasar por Planes, Sesiones y Resultados.
3. Abre directamente `/planes`, `/sesiones` y `/resultados` en la barra de direcciones; tras recargar, cada página conserva su ruta.
4. Pulsa «Nuevo plan» y «Nueva sesión» para comprobar los puntos de integración y el regreso.
5. Abre una ruta inexistente para comprobar el mensaje y el enlace de retorno.
6. Usa Tab y Enter para recorrer el menú, los botones y el enlace «Saltar al contenido principal».

## Integración posterior

- `src/pages/PlansPage.jsx` y `/planes/nuevo`: creación y consulta de planes (S2-05).
- `src/pages/SessionsPage.jsx` y `/sesiones/nueva`: ejecución y cierre (S2-07).
- `src/pages/ResultsPage.jsx`: consulta de resultados y evidencias.
- `src/services/apiClient.js`: conexión HTTP configurable; los componentes actuales no llaman a una API inexistente.
- `src/components/UiState.jsx`: estados compartidos para páginas que consulten datos.

El servidor que publique la compilación deberá devolver `index.html` también para las rutas directas de la aplicación.

Para verificar la compilación antes de integrar cambios: `npm run build`.
