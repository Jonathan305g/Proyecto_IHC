const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const { PGlite } = require('@electric-sql/pglite')
const root = path.join(__dirname, '../../database')

test('S3-01: SQL real contra cálculos manuales, filtros y datos incompletos', async t => {
  const pg = new PGlite()
  try {
    await pg.exec(await fs.readFile(path.join(root, '01_esquema.sql'), 'utf8'))
    const fixtures = await fs.readFile(path.join(root, 'sprint3/s3-01/datos_verificacion.sql'), 'utf8')
    await assert.rejects(pg.exec(fixtures), /BD desechable/)
    await pg.exec("SET ihc.s301_fixture = 'true'; SET TIME ZONE 'UTC';")
    await pg.exec(fixtures)
    const query = await fs.readFile(path.join(root, 'sprint3/s3-01/metricas.sql'), 'utf8')
    const cases = JSON.parse(await fs.readFile(path.join(root, 'sprint3/s3-01/resultados_esperados.json'), 'utf8'))
    const read = async params => (await pg.query(query, params)).rows[0].reporte
    for (const example of cases.casos) await t.test(example.nombre, async () => {
      const report = await read(example.parametros)
      for (const [key, expected] of Object.entries(example.esperado)) assert.deepEqual(report[key], expected, key)
    })
    await t.test('período semiabierto y zona -05 equivalen al mismo instante UTC', async () => {
      const utc = await read(['101','2026-10-20T00:00:00Z','2026-10-21T00:00:00Z',null])
      const local = await read(['101','2026-10-19T19:00:00-05:00','2026-10-20T19:00:00-05:00',null])
      assert.deepEqual(utc, local)
      assert.equal(utc.sesiones_incluidas, 2)
      assert.equal(utc.general.evaluados, 4)
      assert.equal(utc.general.pendientes, 2)
      assert.equal(utc.general.por_resultado.sin_ayuda.tiempo.promedio_segundos, 30)
    })
    await t.test('límites unilaterales y sin período', async () => {
      assert.equal((await read(['101',null,null,null])).sesiones_incluidas, 4)
      assert.equal((await read(['101','2026-11-01T00:00:00Z',null,null])).general.evaluados, 1)
      assert.equal((await read(['101',null,'2026-10-21T00:00:00Z',null])).sesiones_incluidas, 2)
    })
    await t.test('conteos generales ponderados por evaluaciones y no por promedios de tareas', async () => {
      const report = await read(cases.casos[0].parametros)
      for (const name of ['sin_ayuda','con_ayuda','no_completado']) {
        assert.equal(report.general.por_resultado[name].cantidad,
          report.por_tarea.reduce((total, task) => total + task.por_resultado[name].cantidad, 0))
      }
      assert.equal(report.general.por_resultado.sin_ayuda.porcentaje, 50)
      assert.equal(report.general.por_resultado.sin_ayuda.tiempo.n, 2)
    })
    await t.test('muchas evidencias no cambian los indicadores y la consulta es de lectura', async () => {
      const before = await read(cases.casos[0].parametros)
      await pg.query("INSERT INTO public.evidencias (resultado_id,tipo,ruta) VALUES (1,'enlace','https://example.org/otra')")
      assert.deepEqual(await read(cases.casos[0].parametros), before)
      assert.equal((await pg.query('SELECT count(*)::int AS n FROM public.resultados')).rows[0].n, 12)
    })
  } finally { await pg.close() }
})
