import { apiUrl, request } from './apiClient.js'

export const MAX_FILE_SIZE = 15 * 1024 * 1024 // 15 MB
export const ALLOWED_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.mp4',
  '.webm',
  '.mov',
  '.mp3',
  '.wav',
  '.ogg',
  '.m4a',
  '.pdf',
  '.txt',
]

export const ACCEPT_FILE_TYPES =
  'image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime,audio/mpeg,audio/wav,audio/ogg,audio/mp4,application/pdf,text/plain,.png,.jpg,.jpeg,.webp,.gif,.mp4,.webm,.mov,.mp3,.wav,.ogg,.m4a,.pdf,.txt'

export function validateClientFile(file) {
  if (!file) {
    return 'Selecciona un archivo para adjuntar.'
  }
  if (file.size === 0) {
    return 'El archivo está vacío.'
  }
  if (file.size > MAX_FILE_SIZE) {
    return 'El archivo excede el tamaño máximo permitido de 15 MB.'
  }
  const ext = file.name ? file.name.substring(file.name.lastIndexOf('.')).toLowerCase() : ''
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return 'Tipo de archivo no admitido. Formatos permitidos: imágenes, videos, audios o documentos PDF/TXT.'
  }
  return null
}

export function validateClientUrl(url) {
  if (!url || !url.trim()) {
    return 'Ingresa la URL del enlace.'
  }
  if (!/^https?:\/\//i.test(url.trim())) {
    return 'La URL debe comenzar con http:// o https://.'
  }
  return null
}

export function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export const evidencias = {
  listByTask: (sessionId, taskId) =>
    request(`/api/sesiones/${sessionId}/resultados/${taskId}/evidencias`),
  listBySession: (sessionId) =>
    request(`/api/sesiones/${sessionId}/evidencias`),
  getDetail: (id) =>
    request(`/api/evidencias/${id}`),
  addLink: (sessionId, taskId, data) =>
    request(`/api/sesiones/${sessionId}/resultados/${taskId}/evidencias`, {
      method: 'POST',
      body: JSON.stringify({
        tipo: 'enlace',
        ruta: data.url,
        descripcion: data.descripcion || null,
      }),
    }),
  uploadFile: (sessionId, taskId, file, descripcion, onProgress) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', apiUrl(`/api/sesiones/${sessionId}/resultados/${taskId}/evidencias`))

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100)
            onProgress({ loaded: event.loaded, total: event.total, percent })
          }
        }
      }

      xhr.onload = () => {
        let resData = null
        try {
          resData = JSON.parse(xhr.responseText)
        } catch (_) {}
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(resData)
        } else {
          const message = Array.isArray(resData?.message)
            ? resData.message.join(' ')
            : resData?.message || `Error en la carga (${xhr.status}).`
          reject(new Error(message))
        }
      }

      xhr.onerror = () => {
        reject(new Error('Fallo de transferencia de red al subir la evidencia.'))
      }

      const formData = new FormData()
      formData.append('archivo', file)
      if (descripcion) {
        formData.append('descripcion', descripcion)
      }
      xhr.send(formData)
    })
  },
  delete: (id) => request(`/api/evidencias/${id}`, { method: 'DELETE' }),
  getFileUrl: (id) => apiUrl(`/api/evidencias/${id}/archivo`),
}
