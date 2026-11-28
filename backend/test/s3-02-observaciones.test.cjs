const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const { PGlite } = require('@electric-sql/pglite')
const { comprobarSeleccion, prepararSolicitud } = require('../dist/analisis-ia/contrato')

test('S3-02: selección SQL sobre el esquema real y control de selección incompleta', async () => {
  const pg = new PGlite()
  try {
    await pg.exec(await fs.readFile(path.join(__dirname,'../../database/01_esquema.sql'),'utf8'))
    await pg.exec(`
      INSERT INTO public.planes(id,nombre,objetivo) OVERRIDING SYSTEM VALUE VALUES (101,'IA','Contrato'),(202,'Otro','Aislamiento');
      INSERT INTO public.tareas(id,plan_id,titulo,descripcion,orden) OVERRIDING SYSTEM VALUE VALUES
        (1001,101,'Guardar','Guardar cambios',1),(1002,101,'Volver','Volver al inicio',2),
        (1003,101,'Salir','Finalizar',3),(2001,202,'Otra','Otro plan',1);
      INSERT INTO public.participantes(id,codigo) OVERRIDING SYSTEM VALUE SELECT n,'S302-'||n FROM generate_series(1,5)n;
      INSERT INTO public.sesiones(id,plan_id,participante_id,estado,consentimiento_confirmado,iniciada_en,cerrada_en)
       OVERRIDING SYSTEM VALUE VALUES
        (10,101,1,'cerrada',true,'2026-10-20T09:00Z','2026-10-20T10:00Z'),
        (11,202,2,'cerrada',true,'2026-10-20T09:00Z','2026-10-20T10:00Z'),
        (12,101,3,'en_curso',true,'2026-10-20T09:00Z',null),
        (13,101,4,'cerrada',false,'2026-10-20T09:00Z','2026-10-20T10:00Z'),
        (14,101,5,'cerrada',true,null,null);
      INSERT INTO public.resultados(id,plan_id,sesion_id,tarea_id,completada,observaciones)
       OVERRIDING SYSTEM VALUE VALUES
        (1,101,10,1001,true,'No reconoció el mensaje de guardado.'),
        (2,202,11,2001,true,'Observación de otro plan.'),
        (3,101,12,1001,true,'Sesión en curso.'),
        (4,101,13,1001,true,'Sin consentimiento.'),
        (5,101,10,1002,true,'   '),
        (6,101,10,1003,null,'Resultado aún pendiente.'),
        (7,101,14,1001,true,'Fechas ausentes.');
    `)
    const sql = await fs.readFile(path.join(__dirname,'../contracts/s3-02/seleccionar_observaciones.sql'),'utf8')
    const rows = (await pg.query(sql,['101',['1','2','3','4','5','6','7','999']])).rows
    assert.deepEqual(rows.map(row=>row.resultado_id), ['1'])
    assert.equal(comprobarSeleccion(['1','999'],rows).error.code,'IA_ORIGEN_INVALIDO')
    assert.equal(comprobarSeleccion(['1','2'],rows).error.code,'IA_ORIGEN_INVALIDO')
    assert.equal(comprobarSeleccion(['1','1'],rows).error.code,'IA_ORIGEN_INVALIDO')
    assert.equal(comprobarSeleccion([],[]).error.code,'IA_SIN_OBSERVACIONES')
    assert.equal(comprobarSeleccion(['1'],rows).ok,true)
    assert.equal(rows[0].observacion_original,'No reconoció el mensaje de guardado.')
    assert.equal('participante_id' in rows[0],false)
    assert.equal(prepararSolicitud('101',rows).error.code,'IA_PRIVACIDAD_PENDIENTE')
    const prepared = prepararSolicitud('101',rows.map(row=>({ ...row,
      observacion_revisada: row.observacion_original, privacidad_revisada: true })))
    assert.equal(prepared.ok,true)
    assert.equal('observacion_original' in prepared.data.observaciones[0],false)
    assert.equal(prepared.data.observaciones[0].id,'resultado:1')
    assert.equal((await pg.query('SELECT count(*)::int AS n FROM public.resultados')).rows[0].n,7)
  } finally { await pg.close() }
})
