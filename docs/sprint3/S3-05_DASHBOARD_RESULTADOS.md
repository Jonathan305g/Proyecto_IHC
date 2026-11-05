# S3-05 — Construir el dashboard de resultados (HU-05)

Responsable: Jonathan Gamboa. Alcance: **HU-05** (10 horas técnicas).
Rama: `feature/s3-05-dashboard-resultados-jonathan`; destino de revisión: `develop`.
Dependencias: Inicio en **S3-01** (definición y contrato de métricas); Cierre en **S3-04** (API de indicadores).

---

## 1. Alcance y objetivos

El objetivo de esta tarea es implementar el dashboard interactivo y accesible de resultados de pruebas de usabilidad, consumiendo los datos provistos por la API de indicadores (S3-04) sobre el contrato formal de métricas S3-01.

### Criterios de aceptación implementados

1. **Tarjetas de indicadores, tabla por tarea y gráficos previstos en el prototipo:**
   - **Tarjetas resumen:** Cobertura de evaluación (con desglose de esperados, evaluados y pendientes), Éxito sin ayuda (autónomo), Éxito con ayuda (asistido), y No completadas (abandono / fracaso).
   - **Gráficos accesibles:**
     - Barra de distribución global de resultados (porcentajes de éxito autónomo, asistido y no completado).
     - Gráfico comparativo por tarea (distribución de tasas de éxito por cada tarea del plan).
     - Gráfico comparativo de tiempos medios de resolución por tarea (segundos en resoluciones autónomas vs asistidas).
   - **Tabla detallada por tarea:** Filas por cada tarea del plan (`por_tarea`), con cobertura, cantidad, porcentaje, tiempo medio (`s`) y promedio de errores (`err.`) clasificados estrictamente por nivel de asistencia.

2. **Consumo de datos S3-04 y unidades explícitas:**
   - Consumo del endpoint unificado `GET /api/planes/:id/indicadores` a través del servicio `indicadoresService.getReport(planId)`.
   - Visualización de unidades explícitas: segundos (`s`), porcentajes (`%`), promedio de errores (`err.` o `por eval.`), evaluaciones y sesiones.
   - Distinción categórica entre éxito **sin ayuda** (verde) y **con ayuda** (ámbar). Un éxito con ayuda nunca contamina ni incrementa la tasa de éxito sin ayuda.
   - Manejo estricto de valores ausentes (`null`): se representan visualmente como `"Sin datos"`, mientras que un valor numérico real `0` se conserva como `0`, `0 s` o `0%`.

3. **Ciclo de vida de estados y descarte de respuestas previas:**
   - Al seleccionar un nuevo plan o reintentar una consulta, el estado del plan anterior se limpia de inmediato (`report: null`, `error: ''`, `loading: true`), impidiendo que se muestren cifras obsoletas mientras se cargan los nuevos datos.
   - Protección contra condiciones de carrera en peticiones asíncronas concurrentes (`active` flag en los efectos).
   - Estados de interfaz para **carga** (`LoadingState`), **error** (`ErrorState` con mensaje del servidor y botón de reintento), **plan sin sesiones cerradas** (notificación clara sin fallos de renderizado) y **plan sin tareas** (aviso de tabla vacía).

4. **Coherencia de datos y legibilidad:**
   - Tarjetas, gráficos y tabla consumen la misma instantánea (`IndicatorsReport`) de la API.
   - Cumplimiento de accesibilidad: tablas semánticas con `<caption>`, `<th scope="col">` y `<th scope="row">`; gráficos con `role="img"` y descripciones textuales para lectores de pantalla; contraste de colores y navegación responsiva.

---

## 2. Arquitectura de componentes y módulos

```
frontend/
├── src/
│   ├── domain/
│   │   └── indicadores.js          # Lógica pura de formateo, categorías, unidades y mock S3-01
│   ├── services/
│   │   ├── indicadores.js         # Cliente API para /api/planes/:id/indicadores
│   │   └── persistence.js         # Exporta servicio indicadores
│   ├── components/
│   │   └── dashboard/
│   │       ├── IndicatorsCards.jsx # Tarjetas de cobertura y categorías de resultado
│   │       ├── IndicatorsCharts.jsx# Gráficos de distribución y tiempos por tarea
│   │       ├── IndicatorsTable.jsx # Tabla detallada por tarea
│   │       └── PlanDashboard.jsx   # Contenedor principal con selector de plan y estados
│   ├── pages/
│   │   ├── ResultsPage.jsx        # Integración del Dashboard en /resultados
│   │   └── PlanDetailPage.jsx     # Enlace directo "Ver dashboard" desde el plan
│   └── dashboard.css              # Estilos modulares del dashboard
└── test/
    └── indicadores.test.js        # Pruebas unitarias de formateo, nulls y coherencia
```

---

## 3. Contrato de consumo (API S3-04)

El dashboard consume la respuesta `IndicatorsReport` de la ruta:

```http
GET /api/planes/:id/indicadores
Authorization: Bearer <supabase_token>
```

Ejemplo de estructura consumida:

```json
{
  "version": "1.0",
  "filtro_valido": true,
  "error_filtro": null,
  "sesiones_incluidas": 3,
  "tareas_seleccionadas": 3,
  "general": {
    "esperados": 9,
    "evaluados": 6,
    "pendientes": 3,
    "cobertura_porcentaje": 66.67,
    "por_resultado": {
      "sin_ayuda": {
        "cantidad": 3,
        "porcentaje": 50,
        "tiempo": { "n": 2, "total_segundos": 30, "promedio_segundos": 15 },
        "errores": { "n": 3, "total": 0, "promedio": 0 }
      },
      "con_ayuda": {
        "cantidad": 2,
        "porcentaje": 33.33,
        "tiempo": { "n": 2, "total_segundos": 110, "promedio_segundos": 55 },
        "errores": { "n": 2, "total": 3, "promedio": 1.5 }
      },
      "no_completado": {
        "cantidad": 1,
        "porcentaje": 16.67,
        "tiempo": { "n": 1, "total_segundos": 90, "promedio_segundos": 90 },
        "errores": { "n": 1, "total": 3, "promedio": 3 }
      }
    }
  },
  "por_tarea": [
    {
      "tarea_id": "1001",
      "codigo": "T1",
      "titulo": "Buscar producto en catálogo",
      "esperados": 3,
      "evaluados": 3,
      "pendientes": 0,
      "cobertura_porcentaje": 100,
      "por_resultado": { ... }
    }
  ]
}
```

---

## 4. Verificación y pruebas

Las funciones de dominio y el tratamiento de datos se verifican con `node:test`:

```bash
npm test --prefix frontend
```

Comprobaciones efectuadas:
- Formateo de porcentajes distinguiendo `null` (`"Sin datos"`) de `0` (`0%`).
- Formateo de duración con unidad `s`, distinguiendo `null` de `0 s`.
- Formateo de promedios de error y enteros con unidades.
- Coherencia del reporte de referencia oficial S3-01 (suma de evaluados, esperados y pendientes entre `general` y `por_tarea`).
- Manejo defensivo en planes sin sesiones (`sesiones_incluidas: 0`).
- Distinción estricta de métricas de éxito sin ayuda y con ayuda.
- Serialización de parámetros y query string.
