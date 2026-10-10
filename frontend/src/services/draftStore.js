// Copia local del avance de una sesión: permite recargar o perder conexión sin perder lo escrito.
// El almacenamiento puede no estar disponible (modo privado, datos bloqueados): todo se envuelve en try/catch.
const keyFor = (sessionId) => `ihc.sesion.${sessionId}.borradores`

export function loadDrafts(sessionId) {
  try {
    const raw = window.localStorage.getItem(keyFor(sessionId))
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function saveDrafts(sessionId, drafts) {
  try {
    window.localStorage.setItem(keyFor(sessionId), JSON.stringify(drafts))
    return true
  } catch {
    return false
  }
}

export function clearDrafts(sessionId) {
  try {
    window.localStorage.removeItem(keyFor(sessionId))
  } catch {
    // Sin almacenamiento no hay nada que limpiar.
  }
}
