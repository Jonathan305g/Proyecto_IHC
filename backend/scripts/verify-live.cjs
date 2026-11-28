require('reflect-metadata')
const assert = require('node:assert/strict')
const { randomUUID, createHash } = require('node:crypto')
const { readiness, allowedEmails } = require('./environment.cjs')
const { createClient } = require('@supabase/supabase-js')

async function main() {
  if (!process.argv.includes('--apply')) {
    console.log('Ensayo real: crea un plan temporal y archivos, comprueba el flujo HTTP y limpia solo sus propios datos.')
    console.log('Configura E2E_TEST_EMAIL y E2E_TEST_PASSWORD en backend/.env. Ejecuta verify:live -- --apply para realizarlo.')
    process.exitCode = 2
    return
  }
  const checks = await readiness()
  for (const c of checks) console.log(`${c.ok ? 'OK' : 'PENDIENTE'} | ${c.name}: ${c.detail}`)
  if (checks.some(c => !c.ok)) { process.exitCode = 2; return }
  if (!process.env.E2E_TEST_PASSWORD || !allowedEmails(process.env).includes((process.env.E2E_TEST_EMAIL || '').toLowerCase())) {
    console.error('PENDIENTE | Configura una cuenta autorizada en E2E_TEST_EMAIL y E2E_TEST_PASSWORD. No se hicieron escrituras.')
    process.exitCode = 2
    return
  }
  const { createApplication } = require('../dist/application')
  const { DatabaseService } = require('../dist/database.service')
  const app = await createApplication(false)
  const db = app.get(DatabaseService)
  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const auth = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const marker = `VERIFICACION-${randomUUID()}`
  console.log(`Ejecución temporal: ${marker}`)
  const uploadedKeys = new Set()
  const participantCode = `V-${randomUUID().replaceAll('-', '').slice(0, 25)}`
  const bucket = admin.storage.from(process.env.SUPABASE_STORAGE_BUCKET || 'evidencias')
  let planId, token
  const ok = name => console.log(`OK | ${name}`)
  try {
    const login = await auth.auth.signInWithPassword({ email: process.env.E2E_TEST_EMAIL, password: process.env.E2E_TEST_PASSWORD })
    assert.ok(!login.error && login.data.session, 'No se pudo iniciar sesión con la cuenta de prueba.')
    token = login.data.session.access_token
    ok('Inicio de sesión real en Supabase Auth')
    await app.listen(0, '127.0.0.1')
    const base = await app.getUrl()
    async function request(method, path, body, status = 200, credential = token) {
      const multipart = body instanceof FormData
      const response = await fetch(`${base}/api${path}`, {
        method, headers: { ...(credential ? { Authorization: `Bearer ${credential}` } : {}), ...(multipart ? {} : { 'Content-Type': 'application/json' }) },
        ...(body === undefined ? {} : { body: multipart ? body : JSON.stringify(body) }), signal: AbortSignal.timeout(20000),
      })
      assert.equal(response.status, status, `Estado inesperado: ${method} ${path}`)
      return response.json()
    }
    await request('GET', '/planes', undefined, 401, '')
    await request('GET', '/planes', undefined, 401, 'token-invalido')
    ok('Peticiones sin token y con token inválido rechazadas')
    // El mismo usuario real, con una lista temporal que no lo autoriza: debe recibir 403.
    const previousAllowed = process.env.AUTH_ALLOWED_EMAILS
    try {
      process.env.AUTH_ALLOWED_EMAILS = 'no-autorizado@invalid.test'
      await request('GET', '/planes', undefined, 403)
    } finally { process.env.AUTH_ALLOWED_EMAILS = previousAllowed }
    ok('Una cuenta autenticada fuera de la lista autorizada recibe 403')
    const plan = await request('POST', '/planes', { nombre: marker, objetivo: 'Ensayo real previo al Sprint 3', cupo: 1,
      tareas: [1, 2].map(orden => ({ titulo: `Tarea ${orden}`, descripcion: 'Comprobar persistencia', orden })) }, 201)
    planId = String(plan.id)
    const [task1, task2] = plan.tareas.map(t => String(t.id))
    assert.equal((await request('GET', `/planes/${planId}`)).tareas.length, 2)
    await request('PATCH', `/planes/${planId}`, { estado: 'activo' })
    const session = await request('POST', '/sesiones', { plan_id: planId, codigo_participante: participantCode }, 201)
    const sessionId = String(session.id)
    await request('PATCH', `/sesiones/${sessionId}`, { accion: 'iniciar', consentimiento_confirmado: true })
    ok('Plan, tareas, sesión y consentimiento guardados y recuperados')
    const content = Buffer.from(`${marker}\nEvidencia de verificación real.\n`, 'utf8')
    async function upload() {
      const form = new FormData()
      form.set('archivo', new Blob([content], { type: 'text/plain' }), 'verificacion.txt')
      const evidence = await request('POST', `/sesiones/${sessionId}/resultados/${task1}/evidencias`, form, 201)
      assert.ok(String(evidence.ruta).startsWith(`supabase://${sessionId}/${task1}/`))
      uploadedKeys.add(String(evidence.ruta).slice(11))
      return evidence
    }
    const first = await upload()
    assert.equal((await request('GET', `/sesiones/${sessionId}`)).progreso.registradas, 0)
    const key = String(first.ruta).slice('supabase://'.length)
    assert.ok(String(first.ruta).startsWith(`supabase://${sessionId}/${task1}/`))
    const access = await request('GET', `/evidencias/${first.id}/acceso`)
    assert.equal(new URL(access.url).origin, new URL(process.env.SUPABASE_URL).origin, 'La descarga debe proceder de este Supabase.')
    const download = await fetch(access.url, { signal: AbortSignal.timeout(20000) })
    assert.equal(download.status, 200)
    const hash = value => createHash('sha256').update(value).digest('hex')
    assert.equal(hash(Buffer.from(await download.arrayBuffer())), hash(content))
    const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(process.env.SUPABASE_STORAGE_BUCKET || 'evidencias')}/${key.split('/').map(encodeURIComponent).join('/')}`
    assert.notEqual((await fetch(publicUrl, { signal: AbortSignal.timeout(10000) })).status, 200)
    ok('Archivo real en bucket privado, descarga firmada íntegra y evaluación aún pendiente')
    await request('DELETE', `/evidencias/${first.id}`)
    assert.ok((await bucket.download(key)).error, 'El archivo eliminado no debe seguir disponible en Storage.')
    assert.equal((await db.query('SELECT count(*)::int AS total FROM public.storage_deletions WHERE object_key=$1', [key])).rows[0].total, 0)
    ok('Eliminación física del archivo y limpieza de su cola')
    const retained = await upload()
    for (const task of [task1, task2]) {
      await request('PUT', `/sesiones/${sessionId}/resultados/${task}`, { resultado: 'sin_ayuda', tiempo_segundos: 15, errores: 0 })
    }
    await request('PUT', `/sesiones/${sessionId}/resultados/${task1}`, { resultado: 'con_ayuda', tiempo_segundos: 45, errores: 1 })
    const recovered = await request('GET', `/sesiones/${sessionId}`)
    assert.equal(recovered.progreso.registradas, 2)
    assert.equal((await request('GET', `/sesiones/${sessionId}/resultados`)).length, 2)
    assert.equal((await request('GET', `/evidencias/${retained.id}`)).id, retained.id)
    await request('PATCH', `/sesiones/${sessionId}`, { accion: 'cerrar' })
    assert.equal((await request('GET', `/sesiones/${sessionId}`)).estado, 'cerrada')
    await request('PUT', `/sesiones/${sessionId}/resultados/${task1}`, { resultado: 'sin_ayuda', tiempo_segundos: 1, errores: 0 }, 409)
    await request('DELETE', `/evidencias/${retained.id}`, undefined, 409)
    ok('Resultados sin duplicados, evidencia conservada, cierre y bloqueo de modificaciones')
  } finally {
    // Nunca se purgan datos por prefijo global: solo el plan exacto de esta ejecución.
    try {
      const { rows: plans } = await db.query('SELECT id FROM public.planes WHERE nombre=$1', [marker])
      for (const p of plans) {
        const { rows } = await db.query(`SELECT e.ruta FROM public.evidencias e JOIN public.resultados r ON r.id=e.resultado_id WHERE r.plan_id=$1`, [p.id])
        const keys = [...new Set([...uploadedKeys, ...rows.filter(r => r.ruta.startsWith('supabase://')).map(r => r.ruta.slice(11))])]
        if (keys.length) { const { error } = await bucket.remove(keys); assert.ok(!error, 'No se pudo limpiar el archivo de prueba; se conservaron sus metadatos.') }
        await db.transaction(async client => {
          const locked = await client.query('SELECT id FROM public.planes WHERE id=$1 AND nombre=$2 FOR UPDATE', [p.id, marker])
          assert.equal(locked.rowCount, 1)
          await client.query('DELETE FROM public.resultados WHERE plan_id=$1', [p.id])
          await client.query('DELETE FROM public.sesiones WHERE plan_id=$1', [p.id])
          await client.query('DELETE FROM public.participantes WHERE codigo=$1 AND NOT EXISTS (SELECT 1 FROM public.sesiones WHERE participante_id=public.participantes.id)', [participantCode])
          await client.query('DELETE FROM public.planes WHERE id=$1 AND nombre=$2', [p.id, marker])
          if (keys.length) await client.query('DELETE FROM public.storage_deletions WHERE object_key=ANY($1::text[])', [keys])
        })
      }
      assert.equal((await db.query('SELECT count(*)::int AS total FROM public.planes WHERE nombre=$1', [marker])).rows[0].total, 0)
      ok('Datos temporales propios retirados; registros anteriores conservados')
    } finally {
      if (token) await auth.auth.signOut({ scope: 'local' })
      await app.close()
    }
  }
  console.log('APROBADO | Ensayo HTTP con PostgreSQL, Supabase Auth y Storage reales. La prueba visual desde otra máquina sigue siendo independiente.')
}

main().catch(() => {
  console.error('FALLIDO | El ensayo no está aprobado. Revisa el último paso mostrado; no se imprimen claves, contraseñas ni enlaces firmados.')
  process.exitCode = 1
})
