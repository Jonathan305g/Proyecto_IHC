import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canApprove, draftFromFinding, privacyFromAnalysis, analysisNotice } from '../src/domain/revision.js'
const finding = { resumen: 'No se ve el guardado', categoria: 'retroalimentacion', severidad: 'media', mejora_sugerida: 'Mostrar confirmación', criterio_aceptacion: null }
test('S3-09: un borrador sin criterio no se puede aprobar', () => {
 const draft = draftFromFinding(finding)
 assert.equal(canApprove(draft, 'Confirmar guardado'), false)
 assert.equal(canApprove({ ...draft, criterio_aceptacion: 'El mensaje permanece visible.' }, 'Confirmar guardado'), true)
 assert.equal(finding.criterio_aceptacion, null)
})
test('S3-09: rechaza clasificación, textos vacíos y longitudes inválidas antes de aprobar', () => {
 const draft = { ...draftFromFinding(finding), criterio_aceptacion: 'Visible' }
 for (const patch of [{ categoria: 'inventada' }, { severidad: 'urgente' }, { resumen: ' ' }, { mejora_sugerida: '' }, { criterio_aceptacion: 'x'.repeat(3001) }]) assert.equal(canApprove({ ...draft, ...patch }, 'Guardar'), false)
 assert.equal(canApprove(draft, ''), false)
})
test('S3-09: revisión de privacidad conserva IDs BIGINT y solo campos permitidos', () => {
 const data = privacyFromAnalysis({ grupos: [{ solicitud: { observaciones: [{ id: 'resultado:9007199254740993', texto: 'Revisado', tarea: { id: '5', titulo: 'Guardar', criterio_exito: null }, resultado: 'con_ayuda', secreto: 'omitir' }] } }] })
 assert.deepEqual(data, [{ resultado_id: '9007199254740993', texto: 'Revisado', titulo_tarea: 'Guardar', criterio_exito: null }])
})
test('S3-09: distingue parcial, fallido, procesando y demostración', () => {
 assert.match(analysisNotice({ estado: 'parcial', grupos: [] }), /solo los grupos fallidos/)
 assert.match(analysisNotice({ estado: 'fallido', grupos: [] }), /falló/)
 assert.match(analysisNotice({ estado: 'procesando', grupos: [] }), /no vuelvas a enviarlo/)
 assert.match(analysisNotice({ estado: 'completado', grupos: [{ meta: { modo: 'demo' } }] }), /no acredita/)
})
