require('reflect-metadata')
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { validateUploadedFile, parseLinkEvidence, detectFileType, MAX_FILE_SIZE } = require('../dist/dto/evidencia.dto')
const { EvidencesService } = require('../dist/evidencias.service')

const file = () => {
  const buffer = Buffer.from('89504e470d0a1a0a00000000', 'hex')
  return { originalname: 'captura.png', mimetype: 'image/png', size: buffer.length, buffer }
}

test('rechaza MIME incompatible, extensión engañosa, tamaño y contenido falsos', () => {
  assert.equal(detectFileType('captura.png', 'image/png'), 'imagen')
  assert.throws(() => detectFileType('programa.exe', 'image/png'), /Tipo de archivo/)
  assert.throws(() => detectFileType('captura.png', 'text/html'), /Tipo de archivo/)
  assert.throws(() => validateUploadedFile(null), /No se recibió/)
  assert.throws(() => validateUploadedFile({ ...file(), size: 0 }), /vacío/)
  assert.throws(() => validateUploadedFile({ ...file(), size: MAX_FILE_SIZE + 1 }), /15 MB/)
  assert.throws(() => validateUploadedFile({ ...file(), size: 50 }), /tamaño/)
  assert.throws(() => validateUploadedFile({ ...file(), buffer: Buffer.alloc(file().size) }), /contenido/)
  assert.equal(validateUploadedFile(file()).tipo, 'imagen')
})

test('valida las firmas de todos los formatos admitidos y texto UTF-8', () => {
  const samples = [
    ['a.jpg', 'image/jpeg', Buffer.from('ffd8ffe000', 'hex')],
    ['a.gif', 'image/gif', Buffer.from('GIF89a')],
    ['a.webp', 'image/webp', Buffer.from('RIFF0000WEBP')],
    ['a.wav', 'audio/wav', Buffer.from('RIFF0000WAVE')],
    ['a.mp3', 'audio/mpeg', Buffer.from('ID3test')],
    ['a.ogg', 'audio/ogg', Buffer.from('OggStest')],
    ['a.webm', 'video/webm', Buffer.from('1a45dfa300', 'hex')],
    ['a.mp4', 'video/mp4', Buffer.from('0000ftypisom')],
    ['a.mov', 'video/quicktime', Buffer.from('0000ftypqt  ')],
    ['a.m4a', 'audio/mp4', Buffer.from('0000ftypM4A ')],
    ['a.pdf', 'application/pdf', Buffer.from('%PDF-1.7')],
    ['a.txt', 'text/plain', Buffer.from('Observación de usabilidad')],
  ]
  for (const [originalname, mimetype, buffer] of samples) assert.ok(validateUploadedFile({ originalname, mimetype, buffer, size: buffer.length }))
})

test('valida URLs completas y rechaza protocolos y credenciales', () => {
  assert.equal(parseLinkEvidence({ tipo: 'enlace', ruta: 'https://example.com' }).tipo, 'enlace')
  for (const ruta of ['ftp://example.com', 'https://', 'https://usuario:clave@example.com']) {
    assert.throws(() => parseLinkEvidence({ tipo: 'enlace', ruta }))
  }
})

function fixture() {
  const rows = new Map(), objects = new Map(), queue = new Set()
  let state = 'en_curso', consent = true, failInsert = false, failStorage = false
  let placeholder = false
  const db = {
    transaction: async op => op(db),
    query: async (sql, args = []) => {
      if (sql.includes('FROM public.sesiones')) return { rows: [{ id: '2', plan_id: '1', estado: state, consentimiento_confirmado: consent }] }
      if (sql.includes('FROM public.planes') || sql.includes('FROM public.tareas')) return { rows: [{ id: '1' }] }
      if (sql.includes('FROM public.resultados')) return { rows: placeholder ? [] : [{ id: '10' }] }
      if (sql.includes('INSERT INTO public.resultados')) { assert.ok(sql.includes('NULL, FALSE, NULL')); return { rows: [{ id: '10' }] } }
      if (sql.includes('INSERT INTO public.evidencias')) {
        if (failInsert) throw new Error('DB failure')
        const item = { id: String(rows.size + 1), resultado_id: args[0], tipo: args[1], ruta: args[2], sesion_id: '2' }
        rows.set(item.id, item); return { rows: [item] }
      }
      if (sql.includes('INSERT INTO public.storage_deletions')) { queue.add(args[0]); return { rows: [] } }
      if (sql.includes('DELETE FROM public.storage_deletions')) { queue.delete(args[0]); return { rows: [] } }
      if (sql.includes('DELETE FROM public.evidencias')) { rows.delete(args[0]); return { rowCount: 1 } }
      if (sql.includes('FROM public.evidencias')) return { rows: args.length === 1 ? [rows.get(args[0])].filter(Boolean) : [...rows.values()] }
      throw new Error(sql)
    },
  }
  const storage = {
    upload: async (key, bytes) => objects.set(key, bytes),
    remove: async key => { if (failStorage) throw new Error('Storage offline'); objects.delete(key) },
    sign: async key => `https://example.com/signed/${key}`,
  }
  return { service: new EvidencesService(db, storage), rows, objects, queue,
    state: next => { state = next }, consent: next => { consent = next },
    failInsert: () => { failInsert = true }, failStorage: () => { failStorage = true }, placeholder: () => { placeholder = true } }
}

test('archivos compartidos: subida, URL firmada y eliminación', async () => {
  const f = fixture()
  const saved = await f.service.createFromFile('2', '4', file())
  assert.ok(saved.ruta.startsWith('supabase://2/4/'))
  assert.equal(f.objects.size, 1)
  assert.match((await f.service.getFile(saved.id)).url, /^https:/)
  await f.service.delete(saved.id)
  assert.equal(f.rows.size, 0); assert.equal(f.objects.size, 0); assert.equal(f.queue.size, 0)
})

test('no crea ni elimina evidencias en sesión pendiente/cerrada o sin consentimiento', async () => {
  const f = fixture()
  const saved = await f.service.createFromLink('2', '4', { tipo: 'enlace', ruta: 'https://example.com' })
  for (const state of ['pendiente', 'cerrada']) {
    f.state(state)
    await assert.rejects(f.service.createFromFile('2', '4', file()), /sesión en curso/)
    await assert.rejects(f.service.createFromLink('2', '4', { tipo: 'enlace', ruta: 'https://example.com' }), /sesión en curso/)
    await assert.rejects(f.service.delete(saved.id), /sesión en curso/)
    assert.equal(f.objects.size, 0)
  }
  f.state('en_curso'); f.consent(false)
  await assert.rejects(f.service.delete(saved.id), /consentimiento/)
})

test('compensa subida si falla la BD y conserva reintento si Storage no responde', async () => {
  const f = fixture(); f.failInsert()
  await assert.rejects(f.service.createFromFile('2', '4', file()), /DB failure/)
  assert.equal(f.objects.size, 0)
  f.failStorage()
  await assert.rejects(f.service.createFromFile('2', '4', file()), /DB failure/)
  assert.equal(f.queue.size, 1)
})

test('el borrado confirma metadatos y conserva limpieza pendiente ante fallo de Storage', async () => {
  const f = fixture()
  const saved = await f.service.createFromFile('2', '4', file())
  f.failStorage(); await f.service.delete(saved.id)
  assert.equal(f.rows.size, 0); assert.equal(f.queue.size, 1)
})

test('evidencia sin evaluación crea un resultado incompleto', async () => {
  const f = fixture(); f.placeholder()
  await f.service.createFromLink('2', '4', { tipo: 'enlace', ruta: 'https://example.com' })
})
