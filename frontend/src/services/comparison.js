import { request } from './apiClient.js'
export const compareEvaluations = body => request('/api/comparaciones', { method: 'POST', body: JSON.stringify(body) })
