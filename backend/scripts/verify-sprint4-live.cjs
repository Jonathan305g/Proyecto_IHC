require('reflect-metadata')
const { randomUUID } = require('node:crypto')
const { createClient } = require('@supabase/supabase-js')
const { allowedEmails, readiness } = require('./environment.cjs')
const { sprint4Flow } = require('./lib/sprint4-flow.cjs')
const { cleanupSprint4 } = require('./lib/sprint4-cleanup.cjs')
let etapa = 'requisitos'
async function main() {
 if (process.argv.length === 2) { console.log('Ensayo remoto S4: requiere migraciones, E2E_TEST_EMAIL/PASSWORD y Gemini real. Crea dos planes temporales, llama a Gemini una vez y retira solo sus propios registros. Ejecutar con --apply.'); return }
 if (process.argv.length !== 3 || process.argv[2] !== '--apply') throw Error()
 if (process.env.IA_MODE !== 'gemini' || !process.env.GEMINI_API_KEY || !process.env.E2E_TEST_PASSWORD || !allowedEmails(process.env).includes((process.env.E2E_TEST_EMAIL || '').toLowerCase())) throw Error()
 if ((await readiness()).some(c => !c.ok)) throw Error()
 const { createApplication } = require('../dist/application'), { DatabaseService } = require('../dist/database.service')
 const app = await createApplication(false), db = app.get(DatabaseService)
 const auth = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
 const marker = 'VERIFICACION-S4-' + randomUUID(); let token
 try {
  etapa = 'migraciones S4'
  const schema = await db.query("SELECT count(*)::int n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity AND c.relname=ANY($1::text[])", [['producto_responsables','producto_sprints','producto_sprint_historias','producto_sprint_tareas','producto_sprint_eventos','producto_cierres','producto_acuerdos']])
  if (schema.rows[0].n !== 7) throw Error()
  etapa = 'Supabase Auth'; const login = await auth.auth.signInWithPassword({ email: process.env.E2E_TEST_EMAIL, password: process.env.E2E_TEST_PASSWORD })
  if (login.error || !login.data.session) throw Error(); token = login.data.session.access_token
  await app.listen(0, '127.0.0.1'); const base = await app.getUrl()
  await sprint4Flow({ marker, onStep: step => console.log('OK | ' + step), request: async (method, route, body, status = 200) => {
   etapa = `${method} ${route.replace(/\/\d+/g, '/:id')}`
   const response = await fetch(base + '/api' + route, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(60000) })
   if (response.status !== status) throw Error()
   return response.headers.get('content-type')?.includes('application/json') ? response.json() : Buffer.from(await response.arrayBuffer())
  } })
 } finally {
  try {
   const anterior = etapa; etapa = 'limpieza de los planes exactos de esta ejecucion'
   await cleanupSprint4(db, marker)
   console.log('OK | Datos temporales propios retirados')
   etapa = anterior
  } finally { if (token) await auth.auth.signOut({ scope: 'local' }); await app.close() }
 }
 console.log('APROBADO | Recorrido S4 con BD, Auth y Gemini reales. No equivale a sesiones de usabilidad con participantes.')
}
main().catch(() => { console.error('PENDIENTE | Fallo en ' + etapa + '. No se imprimen credenciales ni respuestas privadas.'); process.exitCode = 1 })
