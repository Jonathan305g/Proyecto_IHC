const baseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? ''

/** Punto único de conexión para los módulos que consuman el backend en próximos trabajos. */
export async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => null)
    const message = Array.isArray(error?.message) ? error.message.join(' ') : error?.message
    throw new Error(message || `La solicitud no se completó (${response.status}).`)
  }

  if (response.status === 204) return null
  return response.json()
}
