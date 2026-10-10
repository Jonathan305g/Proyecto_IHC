# Módulo de Base de Datos - Usability Test Dashboard con IA y Scrum

**Proyecto:** Usability Test Dashboard con IA y Scrum | Grupo 6  
**Responsable Base de Datos (S2-03):** Pablo Lozada  
**Plataforma / Motor:** PostgreSQL / Supabase  

---

## 📁 Estructura del Módulo

- `01_esquema.sql`: Script DDL ejecutable en Supabase / PostgreSQL para la creación de las 14 tablas, restricciones de integridad, índices y activación de Row Level Security (RLS).
- `02_datos_ejemplo.sql`: Script DML con datos iniciales ficticios de planes, tareas, participantes, sesiones, resultados y equipo para pruebas local/desarrollo.
- `README.md`: Guía de arquitectura de datos, contratos de entidad y manual de ejecución.

---

## 🗄️ Modelo de Datos (14 Tablas)

El esquema cubre la totalidad de requerimientos funcionalmente planificados para los Sprints 2, 3 y 4:

### 1. Núcleo de Usabilidad (Sprint 2)
- **`planes`**: Contiene la definición del plan de pruebas de usabilidad (nombre, objetivo, estado `borrador|activo|finalizado`).
- **`tareas`**: Consignas y criterios de éxito por plan. Incluye columna `codigo` para trazabilidad y comparación entre evaluaciones.
- **`participantes`**: Identificadores de usuarios anónimos (`codigo` único), asegurando la separación estricta de datos personales.
- **`sesiones`**: Estado de ejecución (`pendiente|en_curso|cerrada`), confirmación de consentimiento informado y tiempos globales.
- **`resultados`**: Métricas por tarea en una sesión (completada `boolean`, duración en segundos, cantidad de errores, observaciones).
- **`evidencias`**: Archivos o capturas vinculadas a un resultado (`imagen|video|audio|documento|enlace`, ruta en storage, descripción).

### 2. Análisis con IA y Backlog (Sprint 3)
- **`analisis_ia`**: Registro de llamadas/ejecuciones del motor de IA por plan (`pendiente|procesando|parcial|completado|fallido`).
- **`hallazgos`**: Sugerencias extraídas de las observaciones para revisión humana (`pendiente|aprobado|rechazado`).
- **`historias`**: Backlog de mejoras del producto. Pueden originarse de hallazgos aprobados o crearse manualmente.

### 3. Módulo Scrum y Cierre de Evaluación (Sprint 4)
- **`miembros`**: Desarrolladores e integrantes del equipo académico.
- **`sprints`**: Definición y ciclo de vida de los sprints del módulo Scrum (`planificado|activo|cerrado`).
- **`revisiones_sprint`**: Entregas, pendientes y observaciones del Sprint Review.
- **`retrospectivas`**: Aspectos positivos y dificultades identificadas.
- **`acuerdos_retrospectiva`**: Compromisos con responsable y fecha de cumplimiento.

---

## 🚀 Guía de Despliegue en Supabase

1. Acceder al **SQL Editor** del proyecto en Supabase.
2. Ejecutar secuencialmente el contenido del archivo [`01_esquema.sql`](file:///c:/Users/USER/Desktop/ProyectoIHC/Proyecto/database/01_esquema.sql).
3. (Opcional para desarrollo) Ejecutar el archivo [`02_datos_ejemplo.sql`](file:///c:/Users/USER/Desktop/ProyectoIHC/Proyecto/database/02_datos_ejemplo.sql) para poblar la base con información de prueba.

---

## 🔒 Seguridad (RLS)
Todas las tablas cuentan con **Row Level Security (RLS)** habilitado por defecto, permitiendo configurar políticas de lectura y escritura públicas o restringidas mediante JWT según evolucione la arquitectura en NestJS.
