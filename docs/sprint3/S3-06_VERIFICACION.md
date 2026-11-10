# Comprobación S3-06

Fecha: 10/11/2026. Responsable: Emilio Abril.
Rama: `feature/s3-06-filtros-dashboard-emilio`.
Destino de revisión: `develop`.
Base al iniciar: `11deafc` (`Merge pull request #29 from Jonathan305g/feature/s3-05-dashboard-resultados-jonathan`).

---

## 1. Auditoría previa

Se realizó `git fetch` y se comprobó que `develop` contenía las integraciones de:
- S3-01 (William Martínez - Contrato y verificación SQL de métricas).
- S3-04 (Manuel Cusme - API de indicadores y filtros).
- S3-05 (Jonathan Gamboa - Dashboard base de resultados).

Las suites de pruebas previas ejecutaron:
- Backend: 104 pruebas aprobadas, 0 fallidas.
- Frontend: 29 pruebas aprobadas, 0 fallidas.

---

## 2. Requerimientos cubiertos

| Requerimiento | Estado | Detalle |
|---|:---:|---|
| **1. Filtro por tareas del plan (`tarea_ids`)** | Cumplido | Implementado en `IndicatorsFilters.jsx`. Checkboxes por tarea con botones rápidos "Todas" y "Ninguna". Valida en cliente que no se envíe una selección vacía (rechazada con 400 en el backend). Si se seleccionan todas, se envía `null`. |
| **2. Filtro de período (`desde` / `hasta`)** | Cumplido | Entradas tipo `date` con conversión a ISO 8601 con zona horaria de Ecuador continental (`-05:00`). `desde` aplica a las 00:00:00 y `hasta` extiende el límite exclusivo al inicio del día siguiente calendario (UTC Date), contemplando bisiestos y cambio de mes. |
| **3. Validación de consistencia temporal** | Cumplido | Bloquea períodos invertidos (`desde >= hasta`) y fechas imposibles de calendario con alertas accesibles (`role="alert"`). |
| **4. Restablecer filtros a `NULL`** | Cumplido | Botón para restablecer que envía `{ desde: null, hasta: null, tarea_ids: null }`, consultando todo el plan de inmediato. Se resetea automáticamente al cambiar de plan en el selector. |
| **5. Accesibilidad (WCAG 2.1 AA)** | Cumplido | Etiquetas semánticas (`<legend>`, `<fieldset>`, `<label htmlFor>`), alto contraste, regiones `aria-live`, y estados visuales cuando no hay sesiones coincidentes. |

---

## 3. Resultados observados

| Comando | Resultado | Notas |
|---|:---:|---|
| `npm test --prefix frontend` | 33 pasadas, 0 fallidas | 29 pruebas previas + 4 nuevas pruebas de filtrado (conversión ISO, reglas de tareas, coherencia temporal y descripción de estados). |
| `npm run build --prefix frontend` | Exitoso | Vite compila sin advertencias ni errores (100 módulos transformados, 595ms). |
| `npm test --prefix backend` | 104 pasadas, 0 fallidas | Sin regresiones en la suite del servidor. |

---

## 4. Archivos creados y modificados

### Archivos creados (3):
- `frontend/src/components/dashboard/IndicatorsFilters.jsx`: Componente de filtros interactivo y accesible.
- `docs/sprint3/S3-06_FILTROS_DASHBOARD.md`: Documentación técnica de la tarea.
- `docs/sprint3/S3-06_VERIFICACION.md`: Reporte de comprobación y verificación.

### Archivos modificados (4):
- `frontend/src/domain/indicadores.js`: Funciones puras de conversión ISO, validación de tareas y período, y descripción de filtros.
- `frontend/src/components/dashboard/PlanDashboard.jsx`: Integración del componente de filtros, sincronización de tareas y manejo de estados.
- `frontend/src/dashboard.css`: Estilos visuales accesibles y responsivos para el panel de filtros.
- `frontend/test/indicadores.test.js`: Pruebas unitarias de las funciones de filtrado.
