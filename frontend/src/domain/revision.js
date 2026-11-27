export const CATEGORIAS = { navegacion: 'Navegación', comprension: 'Comprensión', accesibilidad: 'Accesibilidad', retroalimentacion: 'Retroalimentación', eficiencia: 'Eficiencia', prevencion_errores: 'Prevención de errores', contenido: 'Contenido', otro: 'Otro' }
export const SEVERIDADES = { baja: 'Baja', media: 'Media', alta: 'Alta', critica: 'Crítica' }
export const ESTADOS_HALLAZGO = { pendiente: 'Borrador pendiente', aprobado: 'Aprobado', rechazado: 'Descartado' }
export function draftFromFinding(finding) {
  return { resumen: finding.resumen, categoria: finding.categoria, severidad: finding.severidad,
    mejora_sugerida: finding.mejora_sugerida, criterio_aceptacion: finding.criterio_aceptacion || '' }
}
export function canApprove(draft, title) {
  return Boolean(draft.resumen.trim() && draft.resumen.trim().length <= 1000 && CATEGORIAS[draft.categoria]
    && SEVERIDADES[draft.severidad] && draft.mejora_sugerida.trim() && draft.mejora_sugerida.trim().length <= 1500
    && draft.criterio_aceptacion.trim() && draft.criterio_aceptacion.trim().length <= 3000 && title.trim() && title.trim().length <= 180)
}
export function privacyFromAnalysis(analysis) {
  return analysis.grupos.flatMap(group => group.solicitud.observaciones.map(o => ({ resultado_id: o.id.slice(10),
    texto: o.texto, titulo_tarea: o.tarea.titulo, criterio_exito: o.tarea.criterio_exito })))
}
export function analysisNotice(analysis) {
  if (!analysis) return ''
  if (analysis.grupos.some(g => g.meta?.modo === 'demo')) return 'Demostración: no acredita un análisis real ni permite incorporar hallazgos al backlog.'
  if (analysis.estado === 'parcial') return 'Análisis parcial: conserva los grupos válidos. Puedes importar sus borradores y reintentar solo los grupos fallidos.'
  if (analysis.estado === 'fallido') return 'El análisis falló. Consulta los errores de cada grupo antes de reintentar.'
  if (analysis.estado === 'procesando') return 'Análisis en curso. Consulta el estado; no vuelvas a enviarlo.'
  return 'Las propuestas son borradores. Una persona debe revisarlas antes de incorporarlas al backlog.'
}
