// Migraciones repetibles de S3-07 y S3-08 sobre la BD configurada del equipo.
const fs=require('node:fs/promises')
const path=require('node:path')
const files=['20261118000000_s3_07_ejecuciones_ia.sql','20261127000000_s3_08_hallazgos_historias.sql']
async function main() {
 if(process.argv.length===2) {
  console.log('Preparado: '+files.join(', '))
  console.log('Para aplicar sobre la BD de backend/.env: node --env-file=backend/.env backend/scripts/migrate-review.cjs --apply')
  return
 }
 if(process.argv.length!==3 || process.argv[2]!=='--apply') throw Error('Argumento invalido')
 require('reflect-metadata')
 const {DatabaseService}=require('../dist/database.service')
 const db=new DatabaseService()
 try {
  for(const file of files) {
   await db.query(await fs.readFile(path.join(__dirname,'../migrations',file),'utf8'))
   console.log('OK | '+file)
  }
  console.log('APROBADO | Migraciones de revision y backlog aplicadas; se conservaron registros existentes.')
 } finally {await db.onModuleDestroy()}
}
main().catch(()=>{console.error('PENDIENTE | No se pudo aplicar la migracion. Revisa conexion, TLS y permisos sin publicar credenciales.');process.exitCode=1})
