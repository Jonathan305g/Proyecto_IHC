const { test } = require('node:test')
const assert = require('node:assert/strict')
const { fixture } = require('./helpers/sprint4.cjs')
const { ProveedorIA } = require('../dist/analisis-ia/proveedor')
const { sprint4Flow } = require('../scripts/lib/sprint4-flow.cjs')
const { cleanupSprint4 } = require('../scripts/lib/sprint4-cleanup.cjs')
const { randomUUID } = require('node:crypto')
test('S4-08: recorrido HTTP integrado de plan a IA, backlog, sprint, cierre y exportacion', async () => {
 const f = await fixture(); let calls = 0
 try {
  const provider = new ProveedorIA({ IA_MODE: 'gemini', GEMINI_API_KEY: 'test-only', IA_MODEL: 'gemini-test' }, async (_, options) => {
   calls++; const input = JSON.parse(JSON.parse(options.body).contents[0].parts[0].text)
   return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ version: '1.0', estado: 'borrador', hallazgos: [{ observacion_ids: input.observaciones.map(o => o.id), resumen: 'Confirmacion y retorno poco claros', categoria: 'retroalimentacion', severidad: 'alta', mejora_sugerida: 'Confirmar y conservar el contexto' }], observaciones_sin_hallazgo: [] }) }] } }] }))
  })
  f.app.get(ProveedorIA).analizar = input => provider.analizar(input)
  const marker = 'VERIFICACION-S4-' + randomUUID(), steps = [], result = await sprint4Flow({ marker, onStep: s => steps.push(s), request: async (method, route, body, status = 200) => {
   const r = await f.api(route, method, body); assert.equal(r.status, status, JSON.stringify({ route, body: r.body })); return r.body
  } })
  assert.equal(calls, 1, 'La aprobacion y el backlog no llaman otra vez al proveedor')
  assert.equal(steps.length, 4)
  const persisted = await f.send('sprints-producto/' + result.sprint_id + '/cierre')
  assert.equal(persisted.status, 404, 'Un sprint de otro plan no se expone en el plan inicial del fixture')
  const actual = await f.api(`/planes/${result.planes[0]}/sprints-producto/${result.sprint_id}/cierre`)
  assert.equal(actual.body.estado, 'cerrado'); assert.equal(actual.body.cierre_snapshot.avance.puntos_entregados, 3)
  await assert.rejects(cleanupSprint4(f.db, 'VERIFICACION-S4-'), /invalido/)
  await cleanupSprint4(f.db, marker)
  assert.equal((await f.pg.query('SELECT count(*)::int n FROM public.planes WHERE id=ANY($1::bigint[])', [result.planes])).rows[0].n, 0)
  assert.equal((await f.pg.query('SELECT count(*)::int n FROM public.planes WHERE id IN(101,202)')).rows[0].n, 2)
  assert.equal((await f.pg.query('SELECT count(*)::int n FROM public.historias WHERE plan_id IN(101,202)')).rows[0].n, 4)
 } finally { await f.close() }
})
