export const ESTADOS_HISTORIA = { pendiente: 'Pendiente', en_progreso: 'En progreso', terminada: 'Terminada' }
export function storyDraft(story = {}) {
  story = story || {}
  return { titulo: story.titulo || '', descripcion: story.descripcion || '', criterio_aceptacion: story.criterio_aceptacion || '',
    prioridad: String(story.prioridad ?? 3), puntos: story.puntos == null ? '' : String(story.puntos), estado: story.estado || 'pendiente' }
}
export function validateStory(draft) {
  const errors = {}
  for (const [key, max] of [['titulo', 180], ['descripcion', 4000], ['criterio_aceptacion', 3000]]) {
    if (!draft[key]?.trim() || draft[key].trim().length > max) errors[key] = `Escribe entre 1 y ${max} caracteres.`
  }
  if (!/^[1-5]$/.test(draft.prioridad)) errors.prioridad = 'Selecciona una prioridad entre 1 y 5.'
  if (draft.puntos !== '' && (!/^\d+$/.test(draft.puntos) || Number(draft.puntos) < 1 || Number(draft.puntos) > 100)) errors.puntos = 'Usa un entero entre 1 y 100 o deja sin estimar.'
  if (!ESTADOS_HISTORIA[draft.estado]) errors.estado = 'Selecciona un estado válido.'
  return errors
}
export function storyBody(draft, identity) {
  return { ...identity, titulo: draft.titulo.trim(), descripcion: draft.descripcion.trim(), criterio_aceptacion: draft.criterio_aceptacion.trim(),
    prioridad: Number(draft.prioridad), puntos: draft.puntos === '' ? null : Number(draft.puntos), estado: draft.estado }
}
export function moveStory(stories, id, direction) {
  const ids = stories.map(s => String(s.id)), i = ids.indexOf(String(id)), j = i + direction
  if (![-1, 1].includes(direction) || i < 0 || j < 0 || j >= ids.length) return ids
  ;[ids[i], ids[j]] = [ids[j], ids[i]]
  return ids
}
