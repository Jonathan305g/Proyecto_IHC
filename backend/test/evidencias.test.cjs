require('reflect-metadata')
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const {
  validateUploadedFile,
  parseLinkEvidence,
  detectFileType,
  MAX_FILE_SIZE,
} = require('../dist/dto/evidencia.dto')
const { EvidencesService } = require('../dist/evidencias.service')

test('detectFileType clasifica correctamente extensiones y tipos MIME', () => {
  assert.equal(detectFileType('captura.png', 'image/png'), 'imagen')
  assert.equal(detectFileType('foto.jpg', 'image/jpeg'), 'imagen')
  assert.equal(detectFileType('animacion.gif', 'image/gif'), 'imagen')
  assert.equal(detectFileType('grabacion.mp4', 'video/mp4'), 'video')
  assert.equal(detectFileType('audio_test.mp3', 'audio/mpeg'), 'audio')
  assert.equal(detectFileType('voz.wav', 'audio/wav'), 'audio')
  assert.equal(detectFileType('informe.pdf', 'application/pdf'), 'documento')
  assert.equal(detectFileType('notas.txt', 'text/plain'), 'documento')

  for (const invalid of [
    { name: 'malware.exe', mime: 'application/x-msdownload' },
    { name: 'script.bat', mime: 'application/x-bat' },
    { name: 'archivo.zip', mime: 'application/zip' },
  ]) {
    assert.throws(() => detectFileType(invalid.name, invalid.mime), /Tipo de archivo no admitido/)
  }
})

test('validateUploadedFile rechaza archivos vacíos, excedidos o inválidos', () => {
  assert.throws(() => validateUploadedFile(null), /No se recibió ningún archivo/)
  assert.throws(() => validateUploadedFile({ originalname: 'test.png', size: 0, mimetype: 'image/png' }), /El archivo está vacío/)
  assert.throws(
    () => validateUploadedFile({ originalname: 'test.png', size: MAX_FILE_SIZE + 1, mimetype: 'image/png' }),
    /El archivo excede el tamaño máximo permitido de 15 MB/,
  )
  assert.throws(
    () => validateUploadedFile({ originalname: 'test.rar', size: 1024, mimetype: 'application/x-rar' }),
    /Tipo de archivo no admitido/,
  )

  const valid = validateUploadedFile({
    originalname: 'captura_error.png',
    size: 2048,
    mimetype: 'image/png',
  })
  assert.equal(valid.tipo, 'imagen')
  assert.equal(valid.nombre_archivo, 'captura_error.png')
  assert.equal(valid.tamano_bytes, 2048)
})

test('parseLinkEvidence valida enlaces HTTP y HTTPS y rechaza tipos incompatibles', () => {
  const link = parseLinkEvidence({ tipo: 'enlace', ruta: 'https://figma.com/file/123', descripcion: 'Prototipo evaluado' })
  assert.equal(link.tipo, 'enlace')
  assert.equal(link.ruta, 'https://figma.com/file/123')
  assert.equal(link.descripcion, 'Prototipo evaluado')

  assert.throws(() => parseLinkEvidence({ tipo: 'enlace', ruta: 'ftp://invalido' }), /La URL debe comenzar con http/)
  assert.throws(() => parseLinkEvidence({ tipo: 'enlace', ruta: '' }), /URL del enlace debe contener/)
  assert.throws(() => parseLinkEvidence({ tipo: 'imagen', ruta: 'https://img.com' }), /El tipo debe ser enlace/)
})

function evidenceDbFixture() {
  const savedEvidences = new Map()
  let nextId = 1
  let sessionExists = true
  let taskExists = true
  let failInsert = false

  const db = {
    transaction: async (op) => op(db),
    query: async (sql, values = []) => {
      if (sql.includes('FROM public.sesiones')) {
        return sessionExists ? { rows: [{ id: values[0], plan_id: '1', estado: 'en_curso' }] } : { rows: [] }
      }
      if (sql.includes('FROM public.tareas')) {
        return taskExists ? { rows: [{ id: values[0] }] } : { rows: [] }
      }
      if (sql.includes('FROM public.resultados WHERE sesion_id = $1 AND tarea_id = $2')) {
        return { rows: [{ id: '10' }] }
      }
      if (sql.includes('INSERT INTO public.evidencias')) {
        if (failInsert) throw new Error('Simulated DB failure')
        const idStr = String(nextId++)
        const record = {
          id: idStr,
          resultado_id: values[0],
          tipo: values[1],
          ruta: values[2],
          descripcion: values[3],
          nombre_archivo: values[4],
          tamano_bytes: values[5],
          mime_type: values[6],
          creada_en: new Date().toISOString(),
        }
        savedEvidences.set(idStr, record)
        return { rows: [record] }
      }
      if (sql.includes('FROM public.evidencias e') && sql.includes('WHERE e.id = $1')) {
        const item = savedEvidences.get(String(values[0]))
        return item ? { rows: [{ ...item, sesion_id: '2', tarea_id: '4', tarea_titulo: 'Buscar curso' }] } : { rows: [] }
      }
      if (sql.includes('FROM public.evidencias e') && sql.includes('WHERE r.sesion_id = $1')) {
        return { rows: [...savedEvidences.values()] }
      }
      if (sql.startsWith('DELETE FROM public.evidencias')) {
        savedEvidences.delete(String(values[0]))
        return { rowCount: 1 }
      }
      return { rows: [] }
    },
  }

  const service = new EvidencesService(db)
  return {
    db,
    service,
    savedEvidences,
    setSessionExists: (v) => { sessionExists = v },
    setTaskExists: (v) => { taskExists = v },
    setFailInsert: (v) => { failInsert = v },
  }
}

test('EvidencesService crea y consulta evidencia física y elimina archivos en fallo (evita huérfanos)', async () => {
  const { service, savedEvidences, setFailInsert } = evidenceDbFixture()

  const fakeFile = {
    originalname: 'captura.png',
    mimetype: 'image/png',
    size: 100,
    buffer: Buffer.from('fake image content'),
  }

  const created = await service.createFromFile('2', '4', fakeFile, 'Error en el checkout')
  assert.equal(created.tipo, 'imagen')
  assert.equal(created.nombre_archivo, 'captura.png')
  assert.equal(created.descripcion, 'Error en el checkout')
  assert.equal(savedEvidences.size, 1)

  // Verificar que el archivo físico fue creado
  const absolutePath = path.resolve(process.cwd(), created.ruta)
  assert.ok(fs.existsSync(absolutePath), 'El archivo físico debe existir en disco')

  // Obtener archivo
  const fileInfo = await service.getFile(created.id)
  assert.equal(fileInfo.isLink, false)
  assert.equal(fileInfo.filename, 'captura.png')
  assert.equal(fileInfo.mimeType, 'image/png')

  // Simular fallo de base de datos para verificar que el archivo en disco es eliminado (sin huérfanos)
  setFailInsert(true)
  let failedPath = ''
  try {
    await service.createFromFile('2', '4', {
      originalname: 'huerfano.png',
      mimetype: 'image/png',
      size: 50,
      buffer: Buffer.from('orphan content'),
    })
    assert.fail('Debió fallar')
  } catch (err) {
    assert.equal(err.message, 'Simulated DB failure')
  }

  // Eliminar la evidencia creada inicialmente
  await service.delete(created.id)
  assert.equal(savedEvidences.size, 0)
  assert.ok(!fs.existsSync(absolutePath), 'El archivo físico debe ser eliminado del disco al borrar la evidencia')
})

test('EvidencesService permite registrar y consultar evidencias de enlace', async () => {
  const { service, savedEvidences } = evidenceDbFixture()

  const created = await service.createFromLink('2', '4', {
    tipo: 'enlace',
    ruta: 'https://mi-prueba.com/video',
    descripcion: 'Grabación de pantalla externa',
  })

  assert.equal(created.tipo, 'enlace')
  assert.equal(created.ruta, 'https://mi-prueba.com/video')
  assert.equal(savedEvidences.size, 1)

  const info = await service.getFile(created.id)
  assert.equal(info.isLink, true)
  assert.equal(info.url, 'https://mi-prueba.com/video')
})
