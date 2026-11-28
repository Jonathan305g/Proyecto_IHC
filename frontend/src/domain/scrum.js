export const ESTADOS_TAREA = { pendiente: 'Pendiente', en_progreso: 'En progreso', en_revision: 'En revisión', terminada: 'Terminado' }
export function planningDraft(s) {
 return { nombre: s?.nombre || '', objetivo: s?.objetivo || '', fecha_inicio: s?.fecha_inicio || '', fecha_fin: s?.fecha_fin || '', capacidad: String(s?.capacidad ?? 0),
  historias: (s?.historias || []).map(h => ({ historia_id: String(h.id), responsable_id: h.responsable_id ? String(h.responsable_id) : null })) }
}
export function selectedPoints(historias, seleccion) {
 let total = 0, sinEstimar = 0
 for (const h of seleccion) { const story = historias.find(s => String(s.id) === h.historia_id); if (!Number.isInteger(story?.puntos) || story.puntos < 1) sinEstimar++; else total += story.puntos }
 return { total, sinEstimar }
}
export function planningPayload(draft, identity) {
 return { ...draft, capacidad: Number(draft.capacidad), historias: draft.historias.map(h => ({ historia_id: h.historia_id, responsable_id: h.responsable_id || null })), ...identity }
}
