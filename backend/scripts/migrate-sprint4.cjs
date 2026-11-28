const fs = require('node:fs/promises')
const path = require('node:path')
require('reflect-metadata')
let etapa = 'configuracion'
async function main() {
 const directory = path.join(__dirname, '../migrations')
 const files = (await fs.readdir(directory)).filter(n => /^\d+_s4_.*\.sql$/.test(n)).sort()
 if (process.argv.length === 2) {
  console.log('Preparado: ' + files.join(', '))
  console.log('Aplicar: node --env-file=backend/.env backend/scripts/migrate-sprint4.cjs --apply')
  return
 }
 if (process.argv.length !== 3 || !['--apply', '--check'].includes(process.argv[2])) throw Error('Argumento invalido')
 const { DatabaseService } = require('../dist/database.service')
 const db = new DatabaseService()
 try {
  etapa = 'conexion y requisito S3-08'
  const { rows: [r] } = await db.query("SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='historias' AND column_name='solicitud_huella') AS ok")
  if (!r.ok) throw Object.assign(Error(), { code: 'REQUISITO_S308' })
  if (process.argv[2] === '--check') {
   const { rows } = await db.query("SELECT c.relname,c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname LIKE 'producto_%' AND c.relkind='r' ORDER BY c.relname")
   rows.forEach(r => console.log(`${r.relrowsecurity ? 'OK' : 'PENDIENTE'} | ${r.relname} | RLS=${r.relrowsecurity}`))
   if (rows.length < 5 || rows.some(r => !r.relrowsecurity)) throw Object.assign(Error(), { code: 'ESQUEMA_INCOMPLETO' })
   console.log('APROBADO | Esquema Scrum instalado y protegido.')
  } else {
   for (const file of files) { etapa = file; await db.query(await fs.readFile(path.join(directory, file), 'utf8')); console.log('OK | ' + file) }
   console.log('APROBADO | Migraciones Sprint 4 aplicadas; datos anteriores conservados.')
  }
 } finally { await db.onModuleDestroy() }
}
main().catch(e => { const code = typeof e?.code === 'string' && /^[A-Z\d_]{2,40}$/.test(e.code) ? e.code : 'SIN_CODIGO'; console.error(`PENDIENTE | etapa=${etapa} | codigo=${code}. Revisa disponibilidad, TLS y requisitos de instalacion.`); process.exitCode = 1 })
