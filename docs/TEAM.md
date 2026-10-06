# Equipo, roles y asignaciones

## 1. Roles

Los roles formales existen para la documentación Scrum y para repartir responsabilidades extra.
**Todos los integrantes programan**: cada uno implementa sus historias con su agente de código.

| Integrante | Rol formal | Responsabilidad extra (además de programar) |
|---|---|---|
| **Emilio Abril** | Developer | Arquitectura y estructura del monorepo (DI-04), esquema de BD, `packages/shared`, mantener `develop` en verde, resolver conflictos de integración. |
| **Jonathan Gamboa** | Developer | **Administrador del repositorio** (es el dueño en GitHub): ramas protegidas, colaboradores, GitHub Projects, etiquetas, releases y tags. Revisa cambios de contratos compartidos. |
| **William Martínez** | QA | Dueño de `TESTING.md` y de la calidad: CI, umbrales de cobertura, revisión de accesibilidad (axe + teclado + lector de pantalla), **visto bueno de QA** en cada rama `release/*`, triaje de bugs. Estructura de UI y design system (DI-05). |
| **Pablo Lozada** | Tester | Escribe los **casos de prueba de aceptación** de cada HU *antes* de que se programe; pruebas exploratorias; especificaciones E2E; conduce las pruebas de usabilidad con personas (antes y después). |
| **Manuel Cusme** | Tester + **Scrum Master** | Ceremonias (planning, review, retro), tablero del proyecto, actas en `docs/sprints/`, matriz de planificación de horas, diagramas e informe final; casos de prueba y reportes de bugs. |

## 2. Capacidad

Según la matriz de planificación del docente: 2 h/día × 4 días/semana = 8 h/semana por persona;
sprint de 2 semanas = **16 h por persona** → **80 h por sprint** para el equipo.

| Sprint | Fechas | SP comprometidos | Congelamiento (`release/*`) | Review + Retro |
|---|---|---|---|---|
| S2 | 7 – 20 oct 2026 | 26 + DI-04 + DI-05 | 18 oct | 20 oct |
| S3 | 21 oct – 3 nov 2026 | 28 | 1 nov | 3 nov |
| S4 | 4 – 17 nov 2026 | 21 + evaluación final | 15 nov | 17 nov |

Al inicio del S2 (7 oct) se hace también la **Review y Retro pendientes del Sprint 1**.

## 3. Dueños de módulo

El dueño revisa con prioridad los PR que tocan su módulo y decide sobre cambios de su contrato.

| Módulo (carpetas) | Dueño | Respaldo |
|---|---|---|
| Infraestructura, Docker, CI, `apps/api/prisma`, `packages/shared/src/domain` | Emilio | Jonathan |
| `plans` (api + web), `ai-review` (web), tablero Kanban de `improvements` (web) | Jonathan | Emilio |
| `sessions`, `ai` (api), `export` | Pablo | Emilio |
| `components/ui`, layout, accesibilidad, `results` (web), `apps/web/e2e`, SUS | William | Pablo |
| `evidence`, `findings`/backlog MX (api + web), `sprints` review/retro, `docs/` | Manuel | Jonathan |

## 4. Asignación por sprint

Una historia tiene **un responsable** (quien abre la rama y el PR). Las de 8 SP se trabajan en pareja.

### Sprint 2 — Núcleo de pruebas (7–20 oct)
| Ítem | SP | Responsable | Apoyo | Notas |
|---|---|---|---|---|
| DI-04 Configuración técnica | — | Emilio | Jonathan (GitHub) | **Días 1–2.** Bloquea todo lo demás. |
| DI-05 Estructura de UI y design system | — | William | — | **Días 2–3.** Bloquea las pantallas. |
| HU-01 Asistente del plan | 8 | Jonathan | Emilio | Incluye `equivalenceKey` (lo necesita HU-12). |
| HU-02 Ejecución de sesión y cronómetro | 8 | Pablo | Emilio | Ruta crítica. |
| HU-03 Consulta de planes/sesiones y evidencias | 5 | Manuel | Pablo | |
| HU-04 Formularios accesibles | 5 | William | todos | Transversal: revisión y correcciones de accesibilidad de HU-01..03. |
| Casos de prueba de aceptación S2 | — | Pablo, Manuel | William | Días 1–2, mientras se hace DI-04. |
| Test de usabilidad del **prototipo Figma** con 3–5 personas (medición "antes") | — | Pablo, Manuel | William | Tareas T1–T5 del Sprint 1, matriz + SUS. |

### Sprint 3 — Métricas e IA (21 oct – 3 nov)
| Ítem | SP | Responsable | Apoyo | Notas |
|---|---|---|---|---|
| HU-05 Dashboard de métricas | 8 | Emilio (dominio + API) | William (pantalla y gráficos) | |
| HU-06 Motor de IA | 8 | Pablo | Emilio | Primero `MockProvider`, después Gemini. |
| HU-07 Curaduría humana de propuestas | 5 | Jonathan | Manuel | Depende de HU-06 (contrato listo el día 3). |
| HU-08 Backlog de mejoras MX | 5 | Manuel | Jonathan | Depende de HU-07 (aprobación). |
| HU-13 Cuestionario SUS | 2 | William | Pablo | Pendiente de confirmación del PO ([ADR-0004](adr/0004-sus.md)). |

### Sprint 4 — Scrum de mejoras, comparativa, exportación (4–17 nov)
| Ítem | SP | Responsable | Apoyo | Notas |
|---|---|---|---|---|
| HU-09 Sprints de mejora y Kanban | 8 | Jonathan | Manuel | |
| HU-10 Review y retrospectiva | 3 | Manuel | Jonathan | Depende de HU-09. |
| HU-11 Exportación PDF/Markdown | 5 | Pablo | William | |
| HU-12 Comparador de evaluaciones | 5 | Emilio | William | |
| Suite E2E T1–T5 + auditoría de accesibilidad final | — | William | Pablo, Manuel | |
| Test de usabilidad del **sistema implementado** (medición "después") y comparación | — | Pablo, Manuel | William | Mismas tareas y participantes de perfil similar. |
| Informe final y presentación | — | Manuel | todos | Cada quien redacta la sección de sus HU. |

## 5. Revisión de PR (rotación)

Cada PR necesita 1 aprobación. Revisor por defecto (rotación circular):

| Autor del PR | Revisa |
|---|---|
| Emilio | Jonathan |
| Jonathan | Pablo |
| Pablo | William |
| William | Manuel |
| Manuel | Emilio |

Además: cambios en `packages/shared/src/schemas` o `prisma/schema.prisma` → también revisa Emilio;
cambios en pantallas → William revisa accesibilidad (puede ser segunda aprobación opcional).

## 6. Ceremonias

| Ceremonia | Cuándo | Duración | Registro |
|---|---|---|---|
| Sprint Planning | Primer día del sprint | 1 h | `docs/sprints/sprint-n/planning.md` + Issues en GitHub Projects |
| Daily (asíncrona) | Cada día de trabajo | 5 min | Mensaje: ayer / hoy / impedimentos (grupo de chat o comentario en el Issue) |
| Sprint Review | Último día | 45 min | `docs/sprints/sprint-n/review.md` (demo con el seed) |
| Retrospectiva | Último día, tras la review | 30 min | `docs/sprints/sprint-n/retro.md` |

La matriz de horas (plantilla xlsx del docente) se llena con las tareas de los Issues: estimado al
planificar, real al cerrar.
