// Ejecutar desde backend/. Las claves solo se leen del entorno.
const fs = require('node:fs/promises')
const path = require('node:path')
const { randomUUID } = require('node:crypto')
const { DatabaseService } = require('../dist/database.service')
const { StorageService } = require('../dist/storage.service')
const { validateUploadedFile } = require('../dist/dto/evidencia.dto')

async function main() {
  const db = new DatabaseService(), storage = new StorageService()
  try {
    if (process.argv.includes('--cleanup')) {
      const { rows } = await db.query('SELECT object_key FROM public.storage_deletions ORDER BY creada_en')
      let failures = 0
      for (const row of rows) {
        try {
          await storage.remove(row.object_key)
          await db.query('DELETE FROM public.storage_deletions WHERE object_key = $1', [row.object_key])
        } catch { failures++; console.error('No se pudo limpiar un objeto; se conserva en la cola.') }
      }
      console.log(`Limpieza: ${rows.length - failures} objetos; ${failures} pendientes.`)
      if (failures) process.exitCode = 1
      return
    }
    // Falla sin escribir salvo que el operador indique --apply.
    const apply = process.argv.includes('--apply')
    const root = await fs.realpath(path.resolve(process.env.LEGACY_EVIDENCE_ROOT || '.'))
    const { rows } = await db.query("SELECT id, ruta, nombre_archivo, mime_type FROM public.evidencias WHERE tipo <> 'enlace' AND ruta NOT LIKE 'supabase://%'")
    let failures = 0
    for (const row of rows) {
      try {
        const candidate = path.resolve(root, row.ruta)
        const real = await fs.realpath(candidate)
        const relative = path.relative(root, real)
        if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Ruta fuera de la carpeta indicada')
        const buffer = await fs.readFile(real)
        const originalname = row.nombre_archivo || path.basename(real)
        const mime = row.mime_type || ({ '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.pdf': 'application/pdf', '.txt': 'text/plain', '.gif': 'image/gif', '.webp': 'image/webp', '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4' })[path.extname(originalname).toLowerCase()]
        const meta = validateUploadedFile({ originalname, mimetype: mime, size: buffer.length, buffer })
        if (!apply) { console.log(`Evidencia ${row.id}: disponible para migración.`); continue }
        const key = `legacy/${row.id}/${randomUUID()}`
        await storage.upload(key, buffer, meta.mime_type)
        try {
          const result = await db.query('UPDATE public.evidencias SET ruta = $1, nombre_archivo = $2, mime_type = $3, tamano_bytes = $4 WHERE id = $5 AND ruta = $6',
            [`supabase://${key}`, originalname, meta.mime_type, buffer.length, row.id, row.ruta])
          if (!result.rowCount) throw new Error('El registro cambió; vuelve a consultar')
        } catch (error) {
          await storage.remove(key).catch(() => db.query('INSERT INTO public.storage_deletions (object_key) VALUES ($1) ON CONFLICT DO NOTHING', [key]))
          throw error
        }
        // Conserva el archivo original como respaldo; nunca se borra desde este script.
        console.log(`Evidencia ${row.id}: migrada.`)
      } catch { failures++; console.error(`Evidencia ${row.id}: no se pudo validar/migrar. Revisa el archivo original y sus metadatos.`) }
    }
    console.log(`Modo ${apply ? 'aplicación' : 'comprobación'}: ${rows.length} registros, ${failures} pendientes.`)
    if (failures) process.exitCode = 1
  } finally { await db.onModuleDestroy() }
}
main().catch(() => { console.error('Falló el mantenimiento. Comprueba conexión, configuración y migraciones.'); process.exitCode = 1 })
