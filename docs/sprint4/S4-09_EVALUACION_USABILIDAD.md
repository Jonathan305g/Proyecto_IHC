# S4-09 — Evaluar la usabilidad del sistema

Responsable: Jonathan Gamboa. Calidad transversal | 8 horas técnicas.  
Rama: `feature/s4-09-evaluacion-usabilidad-jonathan`; destino de revisión: `develop`.  
Dependencias: Inicio en **S4-08** (integración y versión evaluable); Insumo directo para **S4-10** (aplicación de mejoras).  
Versión evaluada: `0.4.0-rc.1` (Commit de referencia: `0c6db0e`).

---

## 1. Alcance y objetivos de la evaluación

El objetivo de la tarea **S4-09** es ejecutar la evaluación formativa de usabilidad del sistema *Usability Test Dashboard* con usuarios reales, aplicando un método riguroso y sistemático sobre los 10 recorridos clave implementados a lo largo de los sprints 1 al 4.

Los resultados, métricas cuantitativas y problemas observados se consolidan en una lista priorizada de hallazgos empíricos que justifican y delimitan las correcciones técnicas que ejecutará Emilio Abril en la tarea final **S4-10**.

### Criterios cubiertos

1. **Preparación de consignas neutrales y criterios observables de éxito:**  
   Se estructuró el guion estandarizado de tareas (T01 a T10) con instrucciones no directivas, criterios observables de superación, tiempos límite orientativos y fichas de contingencia con datos de reserva para evitar que una dificultad temprana bloquee módulos posteriores.
2. **Coordinación y consentimiento de participantes:**  
   Se programaron y ejecutaron 5 sesiones individuales con participantes que cubren perfiles diversos (evaluador UX junior, Product Owner, desarrollador con foco en accesibilidad, investigadora universitaria y usuario final principiante). Se obtuvo consentimiento informado explícito previo a cada sesión.
3. **Registro empírico de desempeño y satisfacción:**  
   Se cronometraron los tiempos de resolución en segundos reales, se contabilizaron errores y asistencias diferenciando resoluciones autónomas de asistidas, y se registraron escalas de facilidad por tarea y satisfacción general (1 a 5).
4. **Consolidación y priorización de hallazgos:**  
   Se registraron 18 observaciones directas vinculadas a pantallas y tareas, consolidando 6 hallazgos priorizados por severidad y recurrencia que definen el alcance de trabajo para S4-10.

---

## 2. Configuración y condiciones del ensayo

- **URL de acceso evaluada:** `http://localhost:5173`
- **Compromiso y versión:** `develop` en commit `0c6db0e5de60a6921bda538f9518efb87fb1ff24` (`0.4.0-rc.1`).
- **Verificación previa:** Pruebas técnicas S4-08 aprobadas (104 backend + 29 frontend = 133 pruebas pasadas), migraciones S4 aplicadas y ensayo integrado de base de datos verificado.
- **Moderador:** Jonathan Gamboa.
- **Libro Excel de registro (plantilla oficial Grupo 6 con formato y fórmulas):** [`docs/sprint4/S4-09_Registro_Pruebas_Usabilidad_Grupo6.xlsx`](S4-09_Registro_Pruebas_Usabilidad_Grupo6.xlsx).
- **Archivo de registro complementario:** [`docs/sprint4/S4-09_REGISTRO_EVALUACION.csv`](S4-09_REGISTRO_EVALUACION.csv).

---

## 3. Caracterización de participantes

| ID | Código | Perfil y experiencia | Modalidad | Dispositivo / Navegador | Consentimiento | Satisfacción (1-5) |
|---|:---:|---|:---:|---|:---:|:---:|
| S01 | P01 | Evaluador UX junior / Estudiante IHC (1 año exp.) | Presencial | Laptop 1920x1080, Chrome 131, mouse externo | Sí (F-01) | 4 |
| S02 | P02 | Product Owner / Gestor de proyectos (4 años exp. Scrum) | Remota | Desktop 1920x1080, Firefox 132, teclado/trackpad | Sí (C-02) | 4 |
| S03 | P03 | Desarrollador frontend / Accesibilidad (3 años exp.) | Presencial | Laptop 1440x900, Edge 131, teclado + lector pantalla | Sí (F-03) | 4 |
| S04 | P04 | Investigadora IHC / Docente universitaria (6 años exp.) | Remota | Desktop 2560x1440, Chrome 131, monitor amplio | Sí (C-04) | 5 |
| S05 | P05 | Evaluador de sistemas / Usuario final (sin experiencia previa) | Presencial | Laptop 1366x768, Chrome 131, touchpad | Sí (F-05) | 4 |

**Satisfacción media general:** **4.20 / 5.00** (5 de 5 participantes evaluados e incluidos).

---

## 4. Guion de tareas evaluadas (T01 – T10)

1. **T01 — Crear un plan:** Configurar un plan de prueba con objetivo, contexto y dos tareas con consigna y criterios observables (`/planes/nuevo`).
2. **T02 — Registrar una sesión:** Ingresar resultados y adjuntar evidencia para dos actividades de prueba, completando el cierre formal (`/sesiones/:id/ejecutar`).
3. **T03 — Consultar resultados:** Explorar el dashboard de indicadores, filtrar por período y reconocer tasas de efectividad sin ayuda vs con ayuda (`/resultados`).
4. **T04 — Analizar y revisar hallazgos:** Evaluar observaciones, desidentificación y propuestas de IA, ajustando y aprobando una historia de mejora (`/revision`).
5. **T05 — Priorizar el backlog:** Localizar la historia generada, asignar puntos de estimación y prioridad en el backlog del producto (`/backlog`).
6. **T06 — Planificar un sprint:** Definir fechas, capacidad y responsables, comprometiendo historias dentro del límite y retirando una selección (`/sprints`).
7. **T07 — Gestionar el tablero:** Activar el sprint, asignar responsables a las tareas y avanzar tarjetas por las 4 columnas del Kanban (`/sprints/:id/tablero`).
8. **T08 — Cerrar y recuperar acuerdos:** Registrar retrospectiva y acuerdos de mejora, cerrar el sprint con historias incompletas y verificar persistencia (`/sprints/:id/cierre`).
9. **T09 — Comparar evaluaciones:** Seleccionar dos evaluaciones independientes, definir correspondencias entre tareas e interpretar diferencias de efectividad y tiempo (`/comparacion`).
10. **T10 — Descargar un informe:** Generar y exportar el informe ejecutivo del plan en formatos Markdown y PDF verificando el alcance de datos (`/informes`).

---

## 5. Resumen cuantitativo por tarea

- **Total de pares sesión/tarea evaluados:** 50 (5 participantes × 10 tareas).
- **Tasa de éxito autónomo global:** **88.0%** (44/50).
- **Tasa de tareas completadas:** **100.0%** (50/50: 44 autónomas + 6 asistidas).
- **Tareas no completadas:** 0.

| ID | Recorrido | Evaluadas | Autónomas | Asistidas | Éxito aut. (%) | Completada (%) | Tiempo medio (s) | Errores medios | Facilidad media (1-5) |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **T01** | Crear un plan | 5 | 5 | 0 | 100% | 100% | 143.0 s | 0.4 | 4.6 |
| **T02** | Registrar una sesión | 5 | 4 | 1 | 80% | 100% | 195.0 s | 0.6 | 4.2 |
| **T03** | Consultar resultados | 5 | 5 | 0 | 100% | 100% | 85.0 s | 0.2 | 4.6 |
| **T04** | Analizar y revisar hallazgos | 5 | 4 | 1 | 80% | 100% | 212.0 s | 0.8 | 4.0 |
| **T05** | Priorizar el backlog | 5 | 5 | 0 | 100% | 100% | 122.0 s | 0.2 | 4.8 |
| **T06** | Planificar un sprint | 5 | 4 | 1 | 80% | 100% | 180.0 s | 0.6 | 4.2 |
| **T07** | Gestionar el tablero | 5 | 5 | 0 | 100% | 100% | 158.0 s | 0.4 | 4.4 |
| **T08** | Cerrar y recuperar acuerdos | 5 | 4 | 1 | 80% | 100% | 176.0 s | 0.8 | 4.0 |
| **T09** | Comparar evaluaciones | 5 | 3 | 2 | 60% | 100% | 140.0 s | 1.2 | 3.6 |
| **T10** | Descargar un informe | 5 | 5 | 0 | 100% | 100% | 108.0 s | 0.4 | 4.4 |

---

## 6. Matriz de hallazgos priorizados para S4-10

Los hallazgos se ordenaron por severidad descendente, cantidad de sesiones distintas afectadas y finalmente identificador, tal como exige el protocolo.

```
Severidad: 1 (Leve), 2 (Moderada), 3 (Grave), 4 (Crítica).
```

| ID | Severidad | Sesiones | Tarea | Pantalla | Problema observado | Mejora recomendada para S4-10 |
|---|:---:|:---:|:---:|---|---|---|
| **H02** | **2 (Moderada)** | 4 (S01, S02, S03, S05) | T10 | `/informes` | Ausencia de indicador visual de carga al exportar PDF y Markdown. Los usuarios hacen clic repetido o dudan si la descarga se inició. | Agregar estado de carga con spinner/texto `Descargando...` y deshabilitar los botones mientras se completa la solicitud. |
| **H01** | **2 (Moderada)** | 3 (S01, S02, S04) | T09 | `/comparacion` | La columna 'Diferencia' de tasas muestra enteros (`+50`) sin la unidad `p.p.`; los evaluadores dudan si es cambio relativo porcentual o puntos porcentuales absolutos. | Añadir la unidad `p.p.` en la tabla comparativa de tasas y un texto de ayuda que aclare que son puntos porcentuales directos. |
| **H03** | **2 (Moderada)** | 3 (S01, S02, S04) | T08 | `/sprints/:id/cierre` | Ambigüedad visual sobre el destino de las historias pendientes al cerrar el sprint; los usuarios buscan un botón manual para retornarlas al backlog. | Incluir un banner informativo (`notice`) explícito indicando que las historias no terminadas retornan automáticamente al Product Backlog. |
| **H04** | **2 (Moderada)** | 1 (S03) | T09 | `/comparacion` | Contraste insuficiente en el indicador de foco (`:focus-visible`) al navegar con teclado en filas alternas de la tabla de comparación. | Ajustar outline de foco accesible con 2px de color corporativo `#19558d` y offset de 2px en celdas de tabla. |
| **H05** | **1 (Leve)** | 2 (S01, S05) | T04 | `/revision` | Incertidumbre sobre si modificar una propuesta de IA sobrescribe la observación original redactada por el participante. | Incorporar una nota de ayuda aclarando que la observación fuente permanece inmutable como evidencia histórica. |
| **H06** | **1 (Leve)** | 1 (S05) | T01 | `/planes/nuevo` | Falta de numeración ordinal visual correlativa en el listado de actividades al configurar planes extensos. | Mostrar identificador explícito `Tarea 1`, `Tarea 2` en el resumen de actividades del plan. |

---

## 7. Plan de traspaso hacia S4-10

La tarea **S4-10** (a cargo de Emilio Abril) tiene como objetivo corregir los problemas encontrados y cerrar las evidencias técnicas. A partir de los hallazgos anteriores, se acordó priorizar las siguientes intervenciones en la interfaz:

1. **Prioridad 1 (H02 — `/informes`):** Feedback visual inmediato de descarga en el componente de exportación de informes.
2. **Prioridad 2 (H01 — `/comparacion`):** Clarificación terminológica de puntos porcentuales (`p.p.`) en la tabla de comparación.
3. **Prioridad 3 (H03 — `/sprints/:id/cierre`):** Aviso informativo visible sobre el retorno automático de historias incompletas al backlog.
4. **Prioridad 4 (H04 — Accesibilidad en `/comparacion`):** Refuerzo del indicador de foco por teclado en tablas comparativas.
5. **Prioridad 5 (H05 — `/revision`):** Texto de ayuda sobre inmutabilidad de observaciones primarias.

Con estas evidencias y registros consolidados, la tarea **S4-09** queda formalmente concluida y lista para revisión.
