import { test } from 'node:test'
import assert from 'node:assert/strict'
import { moveStory, storyBody, storyDraft, validateStory } from '../src/domain/backlog.js'
const complete = () => ({ ...storyDraft(), titulo: 'Mejorar guardado', descripcion: 'Hacer visible la confirmación', criterio_aceptacion: 'El mensaje permanece después de guardar.' })
test('S3-10: valida historia manual y no confunde puntos sin estimar con cero', () => {
 assert.deepEqual(storyDraft(null), storyDraft())
 const draft = complete(); assert.deepEqual(validateStory(draft), {})
 assert.equal(storyBody(draft, { solicitud_id: 'uuid' }).puntos, null)
 assert.ok(validateStory({ ...draft, puntos: '0' }).puntos)
 assert.ok(validateStory({ ...draft, puntos: '1.5' }).puntos)
 assert.ok(validateStory({ ...draft, puntos: '101' }).puntos)
 assert.equal(storyBody({ ...draft, puntos: '8' }, { version: 3 }).puntos, 8)
})
test('S3-10: exige campos, prioridad y estado válidos', () => {
 for (const patch of [{ titulo: ' ' }, { descripcion: '' }, { criterio_aceptacion: '' }, { prioridad: '6' }, { estado: 'aprobada' }]) assert.ok(Object.keys(validateStory({ ...complete(), ...patch })).length)
})
test('S3-10: movimiento conserva IDs exactos, conjunto y datos originales', () => {
 const rows = [{ id: '9007199254740993' }, { id: '2' }, { id: '3' }]
 assert.deepEqual(moveStory(rows, '2', -1), ['2', '9007199254740993', '3'])
 assert.deepEqual(rows.map(s => s.id), ['9007199254740993', '2', '3'])
 assert.deepEqual(moveStory(rows, '3', 1), rows.map(s => s.id))
 assert.deepEqual(moveStory(rows, '999', -1), rows.map(s => s.id))
})
test('S3-10: edición solo envía campos permitidos y conserva identidad/version', () => {
 const result = storyBody({ ...complete(), hallazgo_id: 'no enviar' }, { version: 8 })
 assert.equal(result.version, 8); assert.equal('hallazgo_id' in result, false)
 assert.equal('solicitud_id' in result, false)
 assert.equal(storyDraft({ puntos: 5, prioridad: 1, estado: 'terminada' }).puntos, '5')
})
