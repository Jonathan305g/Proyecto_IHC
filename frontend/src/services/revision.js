import { request } from './apiClient.js'
const route = (plan, suffix) => `/api/planes/${encodeURIComponent(plan)}/${suffix}`
const send = (plan, suffix, method, body) => request(route(plan, suffix), { method, body: JSON.stringify(body) })
export const revision = {
  observaciones: plan => request(route(plan, 'observaciones-ia')),
  analisis: plan => request(route(plan, 'analisis-ia')),
  preparar: (plan, body) => send(plan, 'analisis-ia', 'POST', body),
  consultar: (plan, analysis) => request(route(plan, `analisis-ia/${encodeURIComponent(analysis)}`)),
  privacidad: (plan, analysis, body) => send(plan, `analisis-ia/${encodeURIComponent(analysis)}/revision`, 'PUT', body),
  ejecutar: (plan, analysis, retry = false) => send(plan, `analisis-ia/${encodeURIComponent(analysis)}/${retry ? 'reintentar' : 'ejecutar'}`, 'POST', {}),
  importar: (plan, analysis) => send(plan, `analisis-ia/${encodeURIComponent(analysis)}/hallazgos`, 'POST', {}),
  hallazgos: plan => request(route(plan, 'hallazgos')),
  guardar: (plan, finding, body) => send(plan, `hallazgos/${encodeURIComponent(finding)}`, 'PUT', body),
  aprobar: (plan, finding, body) => send(plan, `hallazgos/${encodeURIComponent(finding)}/aprobar`, 'POST', body),
  descartar: (plan, finding, body) => send(plan, `hallazgos/${encodeURIComponent(finding)}/descartar`, 'POST', body),
  historia: (plan, story) => request(route(plan, `historias/${encodeURIComponent(story)}`)),
}
