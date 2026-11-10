# S3-06 — Filtros del dashboard de resultados (HU-05)

Responsable: Emilio Abril. Alcance: **HU-05**.
Rama: `feature/s3-06-filtros-dashboard-emilio`; destino de revisión: `develop`.
Dependencias: Inicio en **S3-01** (contrato y reglas de filtrado SQL), **S3-04** (API de indicadores y filtros) y **S3-05** (Dashboard base de resultados).

---

## 1. Alcance y objetivos

El objetivo de esta tarea es implementar el panel interactivo y accesible de filtros para el dashboard de métricas de usabilidad en el frontend, permitiendo segmentar los indicadores por tareas específicas y por rangos de fechas (período de sesiones cerradas), respetando estrictamente el contrato formal definido en S3-01 y consumiendo los endpoints privados de S3-04.

### Criterios de aceptación implementados

1. **Filtro por tareas (`tarea_ids`):**
   - Selección múltiple de tareas del plan mediante checkboxes identificados por su código (`T1`, `T2`...) y título.
   - Acciones rápidas "Todas" y "Ninguna" para facilitar la selección.
   - **Regla estricta del contrato S3-01 / S3-04:** Una selección vacía de tareas (`tarea_ids=` o `[]`) es inválida. El cliente bloquea el envío si se desmarcan todas las tareas y muestra un mensaje accesible de error: *"La selección de tareas no puede estar vacía. Selecciona al menos una tarea del plan."*.
   - Si todas las tareas del plan están marcadas, se envía `tarea_ids: null` (omisión del parámetro en la query) para consultar el plan completo de forma limpia según el contrato.

2. **Filtro de período (`desde` y `hasta`):**
   - Inputs de fecha accesibles (`type="date"`) con etiquetas explícitas y textos de ayuda.
   - **Conversión de zona horaria oficial:** Se utiliza la zona horaria continental de Ecuador (`America/Guayaquil` / `UTC-05:00`).
   - `desde`: Límite inferior inclusivo a las `00:00:00-05:00` del día seleccionado.
   - `hasta`: Límite superior exclusivo en SQL. Se convierte calculando el inicio del día calendario siguiente (`+1 día` a las `00:00:00-05:00`), abarcando por completo las sesiones cerradas en la fecha seleccionada por el usuario.
   - Soporte para transiciones de fin de mes, años bisiestos y fin de año mediante aritmética UTC.
   - Si el usuario ingresa fechas invertidas (`desde >= hasta`), la validación de cliente bloquea el formulario con el mensaje: *"El período es inválido: la fecha de inicio ("Desde") debe ser anterior a la fecha de fin ("Hasta")."*.

3. **Restablecimiento de filtros (`NULL`):**
   - Botón *"Restablecer filtros"* que limpia las fechas, marca todas las tareas y envía `{ desde: null, hasta: null, tarea_ids: null }`.
   - Recupera el universo completo del plan sin recargar la página.
   - Al cambiar de plan en el selector del dashboard, los filtros se reinician automáticamente para no filtrar con IDs del plan anterior.

4. **Accesibilidad y estados de interfaz (WCAG 2.1 AA):**
   - Región con `role="region"` y `aria-label="Filtros de indicadores del plan"`.
   - Agrupación semántica con `<fieldset>` y `<legend>`.
   - Etiquetas `<label htmlFor="...">` asociadas a todos los campos e inputs de fecha.
   - Indicadores visuales y textuales de estado: badge *"Filtros activos"* / *"Reporte completo"*.
   - Banner de resumen de filtros aplicados (`aria-live="polite"`) con botón rápido para quitar filtros.
   - Notificación clara y adaptada cuando un filtro aplicado no devuelve sesiones cerradas (`sesiones_incluidas: 0`), permitiendo restablecer los filtros en un clic sin quedar bloqueado.
   - Alerta accesible de error (`role="alert"` y `aria-live="assertive"`) vinculada con `aria-invalid` y `aria-describedby`.

---

## 2. Arquitectura de componentes y archivos

```
frontend/
├── src/
│   ├── domain/
│   │   └── indicadores.js             # Funciones puras: formatDateToIsoLimit, validateIndicatorFilters, hasActiveFilters, describeActiveFilters
│   ├── components/
│   │   └── dashboard/
│   │       ├── IndicatorsFilters.jsx  # Componente interactivo de filtros (S3-06)
│   │       └── PlanDashboard.jsx      # Integración de filtros, estado activo y carga de tareas
│   └── dashboard.css                  # Estilos responsivos y accesibles del panel de filtros
└── test/
    └── indicadores.test.js            # Pruebas unitarias de conversión ISO, validación de tareas y período
```

---

## 3. Contrato de parámetros y consumo de API

El servicio `indicadores.getReport(planId, filters)` serializa los filtros mediante `buildQueryString`:

```http
GET /api/planes/:id/indicadores?desde=2026-10-20T00%3A00%3A00-05%3A00&hasta=2026-10-23T00%3A00%3A00-05%3A00&tarea_ids=1001%2C1002
Authorization: Bearer <supabase_token>
```

Respuesta compatible S3-01 / S3-04:

```json
{
  "version": "1.0",
  "filtro_valido": true,
  "error_filtro": null,
  "filtros": {
    "plan_id": "101",
    "desde": "2026-10-20T00:00:00-05:00",
    "hasta": "2026-10-23T00:00:00-05:00",
    "tarea_ids": ["1001", "1002"]
  },
  "sesiones_incluidas": 2,
  "tareas_seleccionadas": 2,
  "general": { ... },
  "por_tarea": [ ... ]
}
```

---

## 4. Verificación y pruebas

Ejecutar la suite unitaria de frontend:

```powershell
npm test --prefix frontend
```

Compilación para producción:

```powershell
npm run build --prefix frontend
```
