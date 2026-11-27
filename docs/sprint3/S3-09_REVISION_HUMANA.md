# S3-09 — Revision humana de sugerencias

Responsable previsto: Jonathan Gamboa. HU-07. Dependencias: S3-02, S3-07 y S3-08.
La pantalla `/revision` y el detalle `/historias/:id?plan_id=...` consumen las rutas
autenticadas existentes; la clave Gemini nunca llega a React.

## Recorrido implementado

1. Elegir plan. Cargar fuentes elegibles, analisis recuperables y hallazgos del
   mismo plan; descartar respuestas tardias de otro plan.
2. Seleccionar 1..100 observaciones y preparar con un UUID idempotente S3-07.
3. Revisar privacidad de texto, titulo y criterio antes del envio a Gemini.
   Guardar la accion explicita; los cambios de privacidad sin guardar bloquean
   ejecutar. Una revision de privacidad no equivale a aprobar un hallazgo.
4. Ejecutar, consultar estado o reintentar solo los grupos fallidos. Ante error
   HTTP, consultar el diario; no reenviar automaticamente por un fallo de red.
5. Importar borradores validos sin volver a ejecutar el proveedor. Un analisis
   parcial conserva sus grupos validos y comunica los fallidos. La demo se
   distingue y no permite importar propuestas como si fueran reales.
6. Contrastar observacion original y propuesta inicial de IA con la edicion
   humana en dos paneles adaptables. La propuesta inicial permanece inmutable.
7. Editar resumen, categoria, severidad, mejora y criterio. Guardar borrador
   mantiene estado pendiente y no crea historia.
8. Aprobar exige criterio y titulo. La confirmacion guarda el contenido revisado
   y solicita la aprobacion atomica S3-08. Un fallo puede dejar el borrador
   guardado, pero nunca se anuncia aprobacion sin respuesta confirmada.
9. Descartar exige motivo y confirmacion. No crea historia. La decision permanece
   al recargar. Un hallazgo aprobado o descartado se presenta como solo lectura.
10. La historia aprobada se consulta por enlace con origen y observaciones.
    S3-10 agrega el listado editable y priorizable del backlog.

## Estados y accesibilidad

- Rutas directas y seleccion por URL: plan_id, analisis_id y hallazgo_id.
- Estados vacio, cargando, error y confirmacion mediante texto y regiones de aviso.
- Labels persistentes, fieldsets, botones nativos y foco visible.
- ConfirmModal conserva foco, admite Escape y requiere una decision explicita.
- No se interpreta HTML ni Markdown proveniente de IA; React muestra texto.
- Si se pierde la confirmacion de aprobar, Actualizar hallazgos recupera la
  historia ya creada. El servidor conserva la garantia de no duplicacion.

## Prueba manual del equipo

Aplicar las migraciones S3-07 y S3-08, iniciar backend y frontend con los .env
propios y entrar a Revision de IA. Con una sesion cerrada y observacion elegible,
completar el recorrido anterior. Tambien se puede seleccionar un analisis S3-07
ya ejecutado para importar sus grupos validos. Un analisis sin hallazgos se
muestra sin inventar propuestas. No se necesita recrear claves ni reemplazar .env.

Comandos reproducibles:

```powershell
npm test
npm run build
cd frontend
npx playwright install chromium
npm run test:e2e
cd ..
```

Las pruebas de navegador controlan Auth/API para comprobar el flujo de interfaz,
persistencia al recargar, fallo parcial, descarte y perdida de confirmacion.
La persistencia SQL y la idempotencia reales del servicio se comprueban por
separado en `backend/test/s3-08-backlog.test.cjs`, no con la API controlada del
navegador. El ensayo remoto con los recursos del equipo se realiza al instalar.

## Resultados ejecutados el 27/11/2026

- S3-08 ya supera 178 pruebas backend y 33 frontend en su rama.
- S3-09: 37 pruebas frontend aprobadas (33 previas y 4 nuevas), cero fallidas.
- Compilacion Vite correcta.
- Chromium: 9 pruebas de navegador aprobadas (4 previas y 5 nuevas), cero fallidas.
- Los cinco recorridos nuevos comprueban edicion/guardado/recarga/aprobacion,
  descarte confirmado, analisis parcial, confirmacion perdida sin duplicacion y
  revision de privacidad previa al envio.
- Entorno local: Node 24; Chromium 158 mediante ejecutable de pruebas. No se
  modificaron las versiones del proyecto ni se agregaron dependencias.
