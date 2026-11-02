const fs = require('node:fs')
const path = require('node:path')
const { parseEnv } = require('node:util')

const required = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY', 'AUTH_ALLOWED_EMAILS', 'FRONTEND_ORIGIN']
const placeholder = /REEMPLAZAR|PROJECT_REF|TU_PASSWORD|POOLER_HOST|example\.com/i
const emailPattern = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/
const allowedEmails = env => [...new Set((env.AUTH_ALLOWED_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean))]

function frontendEnvironment(directory = path.join(__dirname, '../../frontend'), inherited = process.env) {
  let values = {}
  // Mismo orden de prioridad de Vite para desarrollo; el proceso prevalece.
  for (const name of ['.env', '.env.local', '.env.development', '.env.development.local']) {
    const file = path.join(directory, name)
    if (fs.existsSync(file)) values = { ...values, ...parseEnv(fs.readFileSync(file, 'utf8')) }
  }
  for (const [key, value] of Object.entries(inherited)) if (key.startsWith('VITE_')) values[key] = value
  return values
}

function configurationIssues(env, frontend) {
  const issues = []
  const add = (field, message) => {
    if (!issues.some(issue => issue.field === field)) issues.push({ field, message })
  }
  for (const field of required) if (!env[field] || placeholder.test(env[field])) add(field, 'Falta un valor real en backend/.env.')
  try {
    const db = new URL(env.DATABASE_URL)
    if (!['postgres:', 'postgresql:'].includes(db.protocol) || !db.username || !db.password) throw Error()
  } catch { add('DATABASE_URL', 'Se requiere una URI PostgreSQL con usuario y contraseña.') }
  if (env.DATABASE_SSL !== 'true') add('DATABASE_SSL', 'Debe ser true para verificar TLS con Supabase.')
  for (const field of ['SUPABASE_URL', 'FRONTEND_ORIGIN']) {
    try {
      const url = new URL(env[field])
      const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
          (field === 'SUPABASE_URL' ? url.protocol !== 'https:' : url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) throw Error()
    } catch { add(field, 'Se requiere un origen válido; HTTPS fuera del equipo local.') }
  }
  const emails = allowedEmails(env)
  if (!emails.length || emails.some(s => !emailPattern.test(s) || placeholder.test(s))) add('AUTH_ALLOWED_EMAILS', 'Indica correos reales separados por comas.')
  if (env.SUPABASE_SECRET_KEY && env.SUPABASE_SECRET_KEY === env.SUPABASE_PUBLISHABLE_KEY) add('SUPABASE_SECRET_KEY', 'La clave del servidor debe ser distinta de la clave pública.')
  if (frontend) {
    for (const [front, back] of [['VITE_SUPABASE_URL', 'SUPABASE_URL'], ['VITE_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_PUBLISHABLE_KEY']]) {
      if (!frontend[front] || frontend[front] !== env[back]) add(front, 'Debe coincidir con la configuración pública del backend.')
    }
    try {
      const url = new URL(frontend.VITE_API_BASE_URL)
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw Error()
    } catch { add('VITE_API_BASE_URL', 'Usa el origen del backend, sin /api al final.') }
    for (const [field, value] of Object.entries(frontend)) {
      if (!field.startsWith('VITE_')) continue
      let serverJWT = false
      try { serverJWT = JSON.parse(Buffer.from(String(value).split('.')[1] || '', 'base64url')).role === 'service_role' } catch {}
      if (/secret|service_role|password|database_url/i.test(field) || String(value).startsWith('sb_secret_') || serverJWT) add(field, 'Una variable VITE_ no debe contener credenciales del servidor.')
    }
  }
  return issues
}

async function readiness({ env = process.env, frontend = frontendEnvironment(), db, admin, fetcher = fetch } = {}) {
  const checks = configurationIssues(env, frontend).map(({ field, message }) => ({ name: field, ok: false, detail: message }))
  if (checks.length) return checks
  const ownDb = !db
  db ||= new (require('../dist/database.service').DatabaseService)()
  admin ||= require('@supabase/supabase-js').createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const check = async (name, action) => {
    try { const detail = await action(); checks.push({ name, ok: true, detail }) }
    catch { checks.push({ name, ok: false, detail: 'No aprobado. Revisa configuración, permisos o conectividad; no se muestran credenciales.' }) }
  }
  try {
    await check('Esquema y RLS', async () => {
      const { rows: [r] } = await db.query(`SELECT count(*)::int AS tablas, count(*) FILTER (WHERE relrowsecurity)::int AS protegidas
        FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'
        AND c.relname=ANY($1::text[])`, [['planes','tareas','participantes','sesiones','resultados','evidencias','analisis_ia','hallazgos','miembros','sprints','historias','revisiones_sprint','retrospectivas','acuerdos_retrospectiva','storage_deletions']])
      if (r.tablas !== 15 || r.protegidas !== 15) throw Error()
      return '15 tablas presentes y con RLS.'
    })
    await check('Índices de claves foráneas', async () => {
      const { rows } = await db.query(`SELECT c.conname FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace
        WHERE c.contype='f' AND n.nspname='public' AND NOT EXISTS (
          SELECT 1 FROM pg_index i WHERE i.indrelid=c.conrelid AND i.indisvalid AND i.indpred IS NULL
          AND ARRAY(SELECT unnest(i.indkey) LIMIT cardinality(c.conkey)) @> c.conkey)`)
      if (rows.length) throw Error()
      return 'Todas las claves foráneas públicas tienen cobertura.'
    })
    await check('Cuentas autorizadas', async () => {
      const emails = allowedEmails(env)
      const { rows } = await db.query('SELECT lower(email) AS email, email_confirmed_at FROM auth.users WHERE lower(email)=ANY($1::text[])', [emails])
      if (emails.some(email => !rows.some(row => row.email === email && row.email_confirmed_at))) throw Error()
      return `${emails.length} cuentas presentes y confirmadas.`
    })
    await check('Registro público desactivado', async () => {
      const response = await fetcher(`${env.SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY }, signal: AbortSignal.timeout(10000) })
      if (!response.ok || (await response.json()).disable_signup !== true) throw Error()
      return 'Nuevos registros públicos deshabilitados.'
    })
    await check('Bucket privado', async () => {
      const { data, error } = await admin.storage.getBucket(env.SUPABASE_STORAGE_BUCKET || 'evidencias')
      if (error || !data || data.public || Number(data.file_size_limit) !== 15 * 1024 * 1024) throw Error()
      return 'Bucket privado, límite de 15 MiB y clave del servidor válida.'
    })
  } finally { if (ownDb) await db.onModuleDestroy() }
  return checks
}

module.exports = { allowedEmails, configurationIssues, frontendEnvironment, readiness }
