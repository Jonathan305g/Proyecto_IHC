# Prompts para los agentes de código

Copia el prompt que te corresponde y pégalo al iniciar una sesión con tu agente (Claude Code, Gemini
CLI, Copilot Chat en modo agente, Codex, Cursor…) **abierto en la raíz del repositorio**. Cambia solo
lo que está entre `<…>`. El agente obtiene todo lo demás de `AGENTS.md` y `docs/`.

## 0. Prompt corto (modo sprint) — el más simple

```text
Soy <NOMBRE> del Grupo 6 y estamos en el Sprint <n>. Lee AGENTS.md y haz lo que me corresponde en este
sprint siguiendo su "modo sprint" (§3.1). Empieza mostrándome el plan.
```

El agente busca tus ítems en `docs/TEAM.md`, revisa qué ya existe en `develop`, propone el orden y
trabaja historia por historia (una rama y un PR por historia), pidiéndote aprobación en cada plan. Usa
los prompts de abajo cuando quieras dirigirlo a una sola historia o darle indicaciones específicas.

## 1. Prompt base (cualquier historia)

```text
Soy <NOMBRE>, integrante del Grupo 6 (rol: <Developer|QA|Tester>). Vamos a trabajar <HU-xx / DI-xx>
del Sprint <n>.

1. Lee AGENTS.md completo y sigue su orden de lectura de docs/.
2. En docs/TEAM.md confirma que <HU-xx> me corresponde y quién me apoya.
3. En docs/BACKLOG.md lee la historia completa; en docs/BUSINESS_RULES.md las reglas que cita.
4. Revisa las dependencias: si alguna HU necesaria no está fusionada en develop, dímelo antes de seguir.
5. Antes de escribir código, preséntame:
   - un resumen de lo que entendiste (en 5 líneas),
   - el nombre de la rama,
   - el plan de tareas pequeñas (cada una = un commit atómico, con su mensaje propuesto),
   - las pruebas que escribirás para cada criterio de aceptación y cada regla RN,
   - los riesgos de docs/RISKS.md que aplican y cómo los evitas.
6. Espera mi aprobación. Luego trabaja con TDD, un commit por tarea, y muéstrame la salida de
   `pnpm lint && pnpm typecheck && pnpm test` (y `pnpm test:e2e` si aplica) antes de decir que terminaste.
7. Al final redacta la descripción del PR con la plantilla de .github/PULL_REQUEST_TEMPLATE.md.

No implementes nada fuera de esta historia. Si encuentras una contradicción en los documentos, detente
y pregúntame.
```

## 2. Sprint 2 — prompts listos

Donde aparece `[prompt base, pasos 1 a 7]`, pega el prompt base de §1 (con tus datos) y agrega debajo
las líneas específicas.

**Emilio — DI-04 (primero de todo):**
```text
Soy Emilio Abril (Developer). Vamos a hacer DI-04 "Configuración técnica" del Sprint 2.
Lee AGENTS.md y luego docs/BACKLOG.md (DI-04 y la sección Seed), docs/ARCHITECTURE.md completo,
docs/DATA_MODEL.md completo, docs/TESTING.md §6 y docs/RISKS.md §4.
Crea la estructura exacta de ARCHITECTURE.md §3, el esquema Prisma de DATA_MODEL.md (Prisma 7 con
prisma.config.ts y @prisma/adapter-pg), el seed idempotente, Docker Compose, CI y los scripts de AGENTS.md §6.
Usa TypeScript 6.0.x (no 7). Antes de instalar, consulta las versiones actuales y fíjalas exactas.
Preséntame primero el plan de commits (rama chore/DI-04-configuracion) y espera mi aprobación.
Al final demuéstrame, ejecutando los comandos, que un clon limpio funciona.
```

**William — DI-05 y luego HU-04:**
```text
Soy William Martínez (QA). Vamos a hacer DI-05 "Estructura de UI y design system" y después HU-04.
Lee AGENTS.md, docs/BACKLOG.md (DI-05 y HU-04), docs/HCI_DESIGN.md completo, docs/ARCHITECTURE.md §5
y docs/TESTING.md §5. Toma los tokens visuales del Figma del Sprint 1 (te pasaré capturas o valores) y
verifica el contraste AA de cada combinación de color con un cálculo, mostrando los resultados.
Preséntame el plan de commits (rama chore/DI-05-ui-base) y espera mi aprobación.
```

**Jonathan — HU-01 (después de DI-04):**
```text
Soy Jonathan Gamboa (Developer). Vamos a trabajar HU-01 "Configurar plan de prueba" del Sprint 2.
[prompt base, pasos 1 a 7]
Presta atención especial a: RN-01, RN-02, RN-04, RN-16 y a la clave de equivalencia (equivalenceKey),
que necesita HU-12 en el Sprint 4. Divide el trabajo en 2 o 3 PR: (1) shared + API, (2) asistente web.
```

**Pablo — HU-02 (después de DI-04):**
```text
Soy Pablo Lozada (Tester). Vamos a trabajar HU-02 "Ejecutar sesión" del Sprint 2. Es la ruta crítica.
[prompt base, pasos 1 a 7]
Presta atención especial a RN-08 (cronómetro con reloj del servidor), RN-21 (versiones y cola de
autoguardado), RN-03 y RN-05, y a los riesgos D1–D4 de docs/RISKS.md. Revisa el diagrama
docs/diagrams/04-secuencias.md §1. Divide en 3 PR: (1) dominio del cronómetro + API, (2) pantalla de
ejecución, (3) revisión y cierre.
```

**Manuel — HU-03:**
```text
Soy Manuel Cusme (Tester y Scrum Master). Vamos a trabajar HU-03 "Consultar planes y sesiones; adjuntar
evidencias" del Sprint 2.
[prompt base, pasos 1 a 7]
Presta atención especial a RN-15 (archivos: tipo real por bytes, tamaño, nombre UUID) y RN-16 (cerrar
plan), y a los riesgos F1–F3 de docs/RISKS.md.
```

## 3. Sprints 3 y 4

Usa el prompt base con la historia que te asigna `TEAM.md` §4. Añade según el caso:
- **HU-05 / HU-12 (Emilio):** "Las fórmulas están en BUSINESS_RULES.md RN-06 y RN-12; implementa primero
  `shared/domain/metrics.ts` y `comparison.ts` con TDD y valores calculados a mano sobre el seed."
- **HU-06 (Pablo):** "Lee docs/AI_MODULE.md completo. Empieza por el MockProvider y las pruebas de cada
  fila de §6; el GeminiProvider va al final. Confirma en la documentación oficial de Structured outputs
  el nombre de los campos de configuración del SDK instalado."
- **HU-07 (Jonathan) y HU-08 (Manuel):** "Lee RN-09, RN-10, RN-19 y docs/diagrams/04-secuencias.md §3. La
  aprobación es una transacción idempotente."
- **HU-09 / HU-10:** "Lee RN-11, RN-14, RN-19 y docs/diagrams/03-estados.md. El tablero debe operarse sin
  arrastrar (menú 'Mover a…')."
- **HU-11 (Pablo):** "Lee RN-13. El modelo del informe se arma en el servidor; el Markdown en shared; el
  PDF en la web con fuente incrustada."
- **HU-13 (William):** "Lee RN-20 y ADR-0004."

## 4. Prompts de apoyo

**Testers — casos de aceptación antes de programar:**
```text
Lee AGENTS.md, docs/BACKLOG.md (<HU-xx>), docs/BUSINESS_RULES.md y docs/TESTING.md §3.
Escribe los escenarios Gherkin en español para cada criterio de aceptación y cada regla RN de <HU-xx>,
incluyendo casos borde y de error (con el código de error esperado). No escribas código.
Entrégalos en Markdown para pegarlos en el Issue de la historia.
```

**Revisor de PR (cualquier integrante):**
```text
Lee AGENTS.md. Revisa el PR de la rama <rama> contra develop:
1. ¿Cumple cada criterio de aceptación de <HU-xx> (docs/BACKLOG.md)? Señala los que falten.
2. ¿Respeta las reglas RN que aplican y los riesgos de docs/RISKS.md?
3. ¿Hay pruebas para cada regla y pasan? Ejecuta `pnpm lint && pnpm typecheck && pnpm test`.
4. ¿Commits atómicos y con formato correcto? ¿Toca archivos fuera de su módulo?
5. Accesibilidad: ¿labels, foco, teclado, contraste, estados con texto?
Devuelve una lista de hallazgos ordenada por gravedad, con archivo y línea. No cambies código.
```

**QA — auditoría de accesibilidad de una pantalla:**
```text
Lee docs/TESTING.md §5 y docs/HCI_DESIGN.md §6. Audita la pantalla <ruta> ejecutando axe con Playwright
y revisando el código de sus componentes. Entrega una tabla: problema, criterio WCAG 2.2, severidad 0–4,
archivo y corrección propuesta. Después agrega el resultado a docs/testing/a11y-checklist.md.
```

**Scrum Master — actas:**
```text
Lee docs/TEAM.md y docs/sprints/README.md. Con estas notas <pega tus notas>, redacta
docs/sprints/sprint-<n>/<planning|review|retro>.md usando la plantilla. No inventes datos: si falta
algo, déjalo marcado como pendiente.
```
