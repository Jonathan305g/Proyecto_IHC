# Cronograma y dependencias

## Cronograma (Sprints 2–4)

```mermaid
gantt
  title Usability Test Dashboard — Sprints 2 a 4 (2026)
  dateFormat YYYY-MM-DD
  axisFormat %d %b

  section Sprint 2
  Review y retro del Sprint 1            :milestone, s1r, 2026-10-07, 0d
  DI-04 Configuración técnica (Emilio)   :di04, 2026-10-07, 2d
  DI-05 UI y design system (William)     :di05, after di04, 2d
  Casos de aceptación S2 (testers)       :ca2, 2026-10-07, 2d
  Test prototipo "antes" (testers)       :ant, 2026-10-09, 4d
  HU-01 Plan (Jonathan)                  :hu01, after di04, 7d
  HU-02 Sesión (Pablo)                   :hu02, after di04, 9d
  HU-03 Consultas y evidencias (Manuel)  :hu03, 2026-10-12, 6d
  HU-04 Accesibilidad (William)          :hu04, after di05, 7d
  Congelamiento release/sprint-2         :milestone, f2, 2026-10-18, 0d
  Review y retro S2                      :milestone, r2, 2026-10-20, 0d

  section Sprint 3
  HU-05 Métricas (Emilio y William)      :hu05, 2026-10-21, 9d
  HU-06 Motor IA (Pablo)                 :hu06, 2026-10-21, 8d
  HU-07 Curaduría (Jonathan)             :hu07, 2026-10-24, 7d
  HU-08 Backlog MX (Manuel)              :hu08, 2026-10-26, 6d
  HU-13 SUS (William)                    :hu13, 2026-10-21, 3d
  Congelamiento release/sprint-3         :milestone, f3, 2026-11-01, 0d
  Review y retro S3                      :milestone, r3, 2026-11-03, 0d

  section Sprint 4
  HU-09 Sprints y Kanban (Jonathan)      :hu09, 2026-11-04, 7d
  HU-10 Review y retro (Manuel)          :hu10, after hu09, 3d
  HU-11 Exportación (Pablo)              :hu11, 2026-11-04, 8d
  HU-12 Comparador (Emilio)              :hu12, 2026-11-04, 7d
  Suite E2E y auditoría a11y (William)   :e2e, 2026-11-06, 8d
  Test sistema "después" (testers)       :des, 2026-11-11, 4d
  Congelamiento release/sprint-4         :milestone, f4, 2026-11-15, 0d
  Review final y presentación            :milestone, r4, 2026-11-17, 0d
```

## Dependencias entre historias

```mermaid
flowchart LR
  DI04[DI-04 Configuración] --> DI05[DI-05 UI base]
  DI04 --> HU01[HU-01 Plan]
  DI05 --> HU01
  HU01 --> HU02[HU-02 Sesión]
  HU01 --> HU03[HU-03 Consultas y evidencias]
  HU02 --> HU03
  DI05 --> HU04[HU-04 Accesibilidad]
  HU02 --> HU05[HU-05 Métricas]
  HU02 --> HU06[HU-06 Motor IA]
  HU02 --> HU13[HU-13 SUS]
  HU06 --> HU07[HU-07 Curaduría]
  HU07 --> HU08[HU-08 Backlog MX]
  HU08 --> HU09[HU-09 Sprints y Kanban]
  HU09 --> HU10[HU-10 Review y retro]
  HU05 --> HU11[HU-11 Exportación]
  HU07 --> HU11
  HU08 --> HU11
  HU01 --> HU12[HU-12 Comparador]
  HU05 --> HU12

  classDef critica fill:#fde2e1,stroke:#b42318,color:#1f1f1f;
  class DI04,HU01,HU02,HU06,HU07,HU08,HU09,HU10 critica;
```

En rojo: ruta crítica. El seed de DI-04 incluye sesiones cerradas y observaciones para que HU-05 y
HU-06 puedan empezar el 21 de octubre aunque HU-02 tenga ajustes pendientes.
