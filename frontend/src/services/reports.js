import { apiUrl, request } from './apiClient.js'
import { authHeaders } from './auth.js'
export const prepareReport = body => request('/api/informes/previsualizar', { method: 'POST', body: JSON.stringify(body) })
export async function downloadReport(id, format) {
 const response = await fetch(apiUrl(`/api/informes/${encodeURIComponent(id)}/${format}`), { headers: await authHeaders() })
 if (!response.ok) { const error = await response.json().catch(() => null); throw new Error(error?.message || `No se pudo descargar (${response.status}).`) }
 const name = response.headers.get('Content-Disposition')?.match(/filename="([a-zA-Z0-9_.-]+)"/)?.[1] || `informe.${format === 'pdf' ? 'pdf' : 'md'}`
 const url = URL.createObjectURL(await response.blob()), a = document.createElement('a')
 a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000)
 return name
}
