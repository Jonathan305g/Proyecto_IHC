require('reflect-metadata')
const fs = require('node:fs/promises')
const path = require('node:path')
const { PGlite } = require('@electric-sql/pglite')
const { createApplication } = require('../../dist/application')
const { DatabaseService } = require('../../dist/database.service')
const { AuthGuard } = require('../../dist/auth.guard')

async function fixture() {
 const keys = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'AUTH_ALLOWED_EMAILS']
 const saved = keys.map(k => process.env[k])
 Object.assign(process.env, { DATABASE_URL: 'postgres://test:test@127.0.0.1:1/test', SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'test', AUTH_ALLOWED_EMAILS: 'equipo@example.com' })
 const pg = new PGlite(); let app
 const close = async () => { if (app) await app.close(); await pg.close(); keys.forEach((k, i) => saved[i] === undefined ? delete process.env[k] : process.env[k] = saved[i]) }
 try {
  await pg.exec(await fs.readFile(path.join(__dirname, '../../../database/01_esquema.sql'), 'utf8'))
  for (const file of (await fs.readdir(path.join(__dirname, '../../migrations'))).sort()) await pg.exec(await fs.readFile(path.join(__dirname, '../../migrations', file), 'utf8'))
  await pg.exec(`INSERT INTO public.planes(id,nombre,objetivo) OVERRIDING SYSTEM VALUE VALUES(101,'Producto A','Mejorar'),(202,'Producto B','Comparar');
   INSERT INTO public.historias(id,plan_id,titulo,descripcion,criterio_aceptacion,puntos,orden) OVERRIDING SYSTEM VALUE
   VALUES(1,101,'Confirmar','Confirmacion persistente','Se muestra al guardar',3,1),(2,101,'Volver','Volver al listado','Conserva filtros',5,2),
    (3,101,'Sin estimar','Estimar despues','Por definir',NULL,3),(4,202,'Otro plan','No mezclar','Aislar',2,1);`)
  app = await createApplication(false)
  let email = 'equipo@example.com'
  app.get(AuthGuard).client = { auth: { getUser: async token => token === 'valid' ? { data: { user: { email, email_confirmed_at: '2026-01-01' } } } : { data: {}, error: Error('expired') } } }
  const convert = result => ({ rows: result.rows.map(row => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, typeof v === 'bigint' ? String(v) : v]))), rowCount: result.affectedRows })
  const db = app.get(DatabaseService)
  db.query = async (sql, args = []) => convert(await pg.query(sql, args))
  db.transaction = op => pg.transaction(tx => op({ query: async (sql, args = []) => convert(await tx.query(sql, args)) }))
  await app.listen(0, '127.0.0.1'); const base = `${await app.getUrl()}/api`
  const api = async (route, method = 'GET', body, token = 'valid') => {
   const response = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
   const bytes = Buffer.from(await response.arrayBuffer()); let data
   try { data = JSON.parse(bytes.toString()) } catch { data = bytes }
   return { status: response.status, body: data, headers: response.headers }
  }
  const send = (route, method, body, token) => api('/planes/101/' + route, method, body, token)
  return { pg, db, app, api, send, setEmail: value => email = value, close }
 } catch (e) { await close(); throw e }
}
module.exports = { fixture }
