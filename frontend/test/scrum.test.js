import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planningDraft, planningPayload, selectedPoints } from '../src/domain/scrum.js'
test('S4-01: planificacion vacia no inventa seleccion ni capacidad', () => { assert.deepEqual(planningDraft(null).historias, []); assert.equal(planningDraft(null).capacidad, '0') })
test('S4-01: suma puntos exactos y distingue historias sin estimar', () => {
 assert.deepEqual(selectedPoints([{ id: '9007199254740993', puntos: 5 }, { id: '2', puntos: null }], [{ historia_id: '9007199254740993' }, { historia_id: '2' }]), { total: 5, sinEstimar: 1 })
})
test('S4-01: payload conserva IDs exactos y seleccion sin responsable', () => {
 const b = planningPayload({ ...planningDraft(null), capacidad: '8', historias: [{ historia_id: '9007199254740993', responsable_id: '' }] }, { solicitud_id: 'uuid' })
 assert.equal(b.capacidad, 8); assert.equal(b.historias[0].historia_id, '9007199254740993'); assert.equal(b.historias[0].responsable_id, null)
})
