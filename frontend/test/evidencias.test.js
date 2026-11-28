import test from 'node:test'
import assert from 'node:assert/strict'
import {
  formatFileSize,
  MAX_FILE_SIZE,
  validateClientFile,
  validateClientUrl,
  evidencias,
} from '../src/services/evidencias.js'

test('validateClientFile valida tamaños, archivos vacíos y tipos admitidos en cliente', () => {
  assert.equal(validateClientFile(null), 'Selecciona un archivo para adjuntar.')
  assert.equal(validateClientFile({ name: 'test.png', size: 0 }), 'El archivo está vacío.')
  assert.equal(
    validateClientFile({ name: 'test.png', size: MAX_FILE_SIZE + 1 }),
    'El archivo excede el tamaño máximo permitido de 15 MB.',
  )
  assert.match(
    validateClientFile({ name: 'invalido.exe', size: 1024 }),
    /Tipo de archivo no admitido/,
  )
  assert.match(
    validateClientFile({ name: 'archivo.zip', size: 1024 }),
    /Tipo de archivo no admitido/,
  )

  // Formatos válidos admitidos
  for (const name of [
    'pantalla.png',
    'foto.jpg',
    'clip.mp4',
    'grabacion.webm',
    'audio.mp3',
    'reporte.pdf',
    'notas.txt',
  ]) {
    assert.equal(validateClientFile({ name, size: 5000 }), null)
  }
})

test('validateClientUrl valida enlaces HTTP y HTTPS', () => {
  assert.equal(validateClientUrl(''), 'Ingresa la URL del enlace.')
  assert.equal(validateClientUrl('   '), 'Ingresa la URL del enlace.')
  assert.equal(validateClientUrl('ftp://servidor.com'), 'La URL debe comenzar con http:// o https://.')
  assert.equal(validateClientUrl('www.google.com'), 'La URL debe comenzar con http:// o https://.')

  assert.equal(validateClientUrl('https://figma.com/file/xyz'), null)
  assert.equal(validateClientUrl('http://localhost:3000/demo'), null)
})

test('formatFileSize formatea bytes a unidades legibles', () => {
  assert.equal(formatFileSize(0), '0 B')
  assert.equal(formatFileSize(null), '0 B')
  assert.equal(formatFileSize(1024), '1 KB')
  assert.equal(formatFileSize(2048), '2 KB')
  assert.equal(formatFileSize(1572864), '1.5 MB')
})

test('evidencias.getFileUrl genera la ruta canónica de streaming', () => {
  const url = evidencias.getFileUrl('42')
  assert.ok(url.includes('/api/evidencias/42/archivo'))
})
