BEGIN;

-- 1. Planes de prueba y tareas
CREATE TABLE IF NOT EXISTS public.planes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    objetivo TEXT NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'borrador'
        CHECK (estado IN ('borrador', 'activo', 'finalizado')),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tareas (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    plan_id BIGINT NOT NULL REFERENCES public.planes(id) ON DELETE CASCADE,
    titulo VARCHAR(150) NOT NULL,
    descripcion TEXT NOT NULL,
    criterio_exito TEXT,
    orden INTEGER NOT NULL CHECK (orden > 0),
    creada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (plan_id, orden)
);

-- El código permite identificar tareas equivalentes entre evaluaciones.
ALTER TABLE public.tareas
    ADD COLUMN IF NOT EXISTS codigo VARCHAR(30);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tareas_plan_codigo
    ON public.tareas (plan_id, codigo);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tareas_id_plan
    ON public.tareas (id, plan_id);

-- 2. Participantes anónimos y sesiones
CREATE TABLE IF NOT EXISTS public.participantes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo VARCHAR(30) NOT NULL UNIQUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sesiones (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    plan_id BIGINT NOT NULL REFERENCES public.planes(id),
    participante_id BIGINT NOT NULL REFERENCES public.participantes(id),
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente'
        CHECK (estado IN ('pendiente', 'en_curso', 'cerrada')),
    consentimiento_confirmado BOOLEAN NOT NULL DEFAULT FALSE,
    iniciada_en TIMESTAMPTZ,
    cerrada_en TIMESTAMPTZ,
    creada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (cerrada_en IS NULL OR iniciada_en IS NOT NULL),
    CHECK (cerrada_en IS NULL OR cerrada_en >= iniciada_en)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sesiones_id_plan
    ON public.sesiones (id, plan_id);

-- 3. Resultado de cada tarea ejecutada en una sesión
CREATE TABLE IF NOT EXISTS public.resultados (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    plan_id BIGINT NOT NULL,
    sesion_id BIGINT NOT NULL,
    tarea_id BIGINT NOT NULL,
    completada BOOLEAN,
    duracion_segundos INTEGER CHECK (duracion_segundos >= 0),
    cantidad_errores INTEGER NOT NULL DEFAULT 0
        CHECK (cantidad_errores >= 0),
    observaciones TEXT,
    registrado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (sesion_id, tarea_id),
    FOREIGN KEY (sesion_id, plan_id)
        REFERENCES public.sesiones(id, plan_id),
    FOREIGN KEY (tarea_id, plan_id)
        REFERENCES public.tareas(id, plan_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_resultados_id_plan
    ON public.resultados (id, plan_id);

-- 4. Evidencias vinculadas a un resultado
CREATE TABLE IF NOT EXISTS public.evidencias (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    resultado_id BIGINT NOT NULL
        REFERENCES public.resultados(id) ON DELETE CASCADE,
    tipo VARCHAR(30) NOT NULL
        CHECK (tipo IN ('imagen', 'video', 'audio', 'documento', 'enlace')),
    ruta TEXT NOT NULL,
    descripcion TEXT,
    creada_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Ejecuciones del análisis de IA y hallazgos revisables
CREATE TABLE IF NOT EXISTS public.analisis_ia (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    plan_id BIGINT NOT NULL REFERENCES public.planes(id),
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente'
        CHECK (estado IN ('pendiente', 'procesando', 'parcial',
                          'completado', 'fallido')),
    mensaje_error TEXT,
    iniciado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    terminado_en TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_analisis_id_plan
    ON public.analisis_ia (id, plan_id);

CREATE TABLE IF NOT EXISTS public.hallazgos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    plan_id BIGINT NOT NULL,
    analisis_id BIGINT NOT NULL,
    resultado_id BIGINT,
    resumen TEXT NOT NULL,
    sugerencia TEXT NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente'
        CHECK (estado IN ('pendiente', 'aprobado', 'rechazado')),
    comentario_revision TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revisado_en TIMESTAMPTZ,
    FOREIGN KEY (analisis_id, plan_id)
        REFERENCES public.analisis_ia(id, plan_id),
    FOREIGN KEY (resultado_id, plan_id)
        REFERENCES public.resultados(id, plan_id)
);

-- 6. Integrantes del equipo y sprints
CREATE TABLE IF NOT EXISTS public.miembros (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    correo VARCHAR(180) UNIQUE,
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS public.sprints (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    objetivo TEXT NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'planificado'
        CHECK (estado IN ('planificado', 'activo', 'cerrado')),
    CHECK (fecha_fin >= fecha_inicio)
);

-- 7. Historias del backlog
CREATE TABLE IF NOT EXISTS public.historias (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo VARCHAR(30) UNIQUE,
    hallazgo_id BIGINT UNIQUE REFERENCES public.hallazgos(id),
    sprint_id BIGINT REFERENCES public.sprints(id),
    responsable_id BIGINT REFERENCES public.miembros(id),
    titulo VARCHAR(180) NOT NULL,
    descripcion TEXT NOT NULL,
    criterio_aceptacion TEXT,
    prioridad SMALLINT NOT NULL DEFAULT 3
        CHECK (prioridad BETWEEN 1 AND 5),
    puntos SMALLINT CHECK (puntos > 0),
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente'
        CHECK (estado IN ('pendiente', 'en_progreso', 'terminada')),
    creada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizada_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Review, retrospectiva y acuerdos de cada sprint
CREATE TABLE IF NOT EXISTS public.revisiones_sprint (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sprint_id BIGINT NOT NULL UNIQUE
        REFERENCES public.sprints(id) ON DELETE CASCADE,
    entregas TEXT NOT NULL,
    pendientes TEXT,
    observaciones TEXT,
    registrada_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.retrospectivas (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sprint_id BIGINT NOT NULL UNIQUE
        REFERENCES public.sprints(id) ON DELETE CASCADE,
    aspectos_positivos TEXT NOT NULL,
    dificultades TEXT NOT NULL,
    registrada_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.acuerdos_retrospectiva (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    retrospectiva_id BIGINT NOT NULL
        REFERENCES public.retrospectivas(id) ON DELETE CASCADE,
    responsable_id BIGINT REFERENCES public.miembros(id),
    accion TEXT NOT NULL,
    fecha_compromiso DATE,
    completado BOOLEAN NOT NULL DEFAULT FALSE
);

-- Índices para las consultas más frecuentes
CREATE INDEX IF NOT EXISTS idx_tareas_plan
    ON public.tareas(plan_id);
CREATE INDEX IF NOT EXISTS idx_sesiones_plan
    ON public.sesiones(plan_id);
CREATE INDEX IF NOT EXISTS idx_sesiones_participante
    ON public.sesiones(participante_id);
CREATE INDEX IF NOT EXISTS idx_resultados_sesion
    ON public.resultados(sesion_id);
CREATE INDEX IF NOT EXISTS idx_evidencias_resultado
    ON public.evidencias(resultado_id);
CREATE INDEX IF NOT EXISTS idx_hallazgos_analisis
    ON public.hallazgos(analisis_id);
CREATE INDEX IF NOT EXISTS idx_historias_sprint
    ON public.historias(sprint_id);

COMMIT;

ALTER TABLE public.planes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tareas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sesiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resultados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analisis_ia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hallazgos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.miembros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revisiones_sprint ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retrospectivas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acuerdos_retrospectiva ENABLE ROW LEVEL SECURITY;
