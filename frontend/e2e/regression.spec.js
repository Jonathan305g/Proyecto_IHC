import { test, expect } from '@playwright/test'

const user = { id: 'e53d7134-8f1d-4e98-8ad0-7d49856c6df9', aud: 'authenticated', role: 'authenticated', email: 'equipo@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.test-signature`
const session = { id: '2', plan_id: '1', plan_nombre: 'Prueba', participante_codigo: 'P-001', estado: 'en_curso', consentimiento_confirmado: true,
  tareas: [{ id: '4', titulo: 'Buscar menú', descripcion: 'Encuentra una opción', orden: 1 }], resultados: [] }
const complete = { id: '10', tarea_id: '4', resultado: 'sin_ayuda', tiempo_segundos: 30, errores: 0, observacion: null }

async function login(page) {
  await page.route('https://test.supabase.co/auth/v1/**', route => route.fulfill({ json: { access_token: token, refresh_token: 'refresh-test', token_type: 'bearer', expires_in: 3600, user } }))
  await page.goto('/sesiones/2/ejecutar')
  await page.getByLabel('Correo del equipo').fill(user.email)
  await page.getByLabel('Contraseña').fill('password-test-only')
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Cerrar mi sesión' })).toBeVisible()
}

async function api(page, results = [complete]) {
  await page.route('**/api/**', async route => {
    expect(route.request().headers().authorization).toBe(`Bearer ${token}`)
    const url = new URL(route.request().url())
    if (url.pathname === '/api/sesiones/2/resultados' && route.request().method() === 'GET') return route.fulfill({ json: results })
    if (url.pathname === '/api/sesiones/2') return route.fulfill({ json: session })
    if (url.pathname === '/api/sesiones') return route.fulfill({ json: [session] })
    return route.fulfill({ json: [] })
  })
}

test('evidencia sin evaluación no aumenta el progreso; error de evidencia permite reintento', async ({ page }) => {
  await api(page, [{ ...complete, resultado: null, tiempo_segundos: null }])
  let failure = true
  await page.route('**/api/sesiones/2/resultados/4/evidencias', route => failure
    ? route.fulfill({ status: 503, json: { message: 'Storage no disponible' } })
    : route.fulfill({ json: [] }))
  await login(page)
  await expect(page.getByText('0 de 1 tareas registradas')).toBeVisible()
  await expect(page.getByText('Storage no disponible')).toBeVisible()
  failure = false
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click()
  await expect(page.getByText('No hay evidencias adjuntas para esta tarea.')).toBeVisible()
  await page.getByRole('button', { name: 'Ver resumen', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Cerrar sesión', exact: true })).toBeDisabled()
})

test('cierre bloqueado con cambios locales y recuperación después de recargar', async ({ page }) => {
  await api(page)
  await login(page)
  await page.getByRole('textbox', { name: 'Observaciones', exact: true }).fill('Cambio todavía sin guardar')
  await page.getByRole('button', { name: 'Ver resumen', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Cerrar sesión', exact: true })).toBeDisabled()
  await expect(page.getByText('Hay cambios sin guardar.', { exact: false })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Observaciones', exact: true })).toHaveValue('Cambio todavía sin guardar')
  await page.route('**/api/sesiones/2/resultados/4', async route => route.fulfill({ json: { ...complete, ...route.request().postDataJSON() } }))
  await page.getByRole('button', { name: 'Guardar y revisar resumen', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Cerrar sesión', exact: true })).toBeEnabled()
  await page.route('**/api/sesiones/2', async route => {
    expect(route.request().postDataJSON().accion).toBe('cerrar')
    return route.fulfill({ json: { ...session, estado: 'cerrada' } })
  })
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click()
  await page.getByRole('button', { name: 'Sí, cerrar sesión', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Resumen de la sesión cerrada' })).toBeVisible()
})

test('Resultados muestra el fallo de consulta y no lo confunde con lista vacía', async ({ page }) => {
  await api(page)
  await login(page)
  await page.route('**/api/sesiones/2/resultados', route => route.fulfill({ status: 503, json: { message: 'Error temporal al consultar resultados' } }))
  await page.goto('/resultados')
  await expect(page.getByText('Error temporal al consultar resultados')).toBeVisible()
  await expect(page.getByText('Aún no se han guardado resultados para las tareas de esta sesión.')).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Reintentar', exact: true })).toBeVisible()
})

test('cambiar de sesión descarta respuestas antiguas', async ({ page }) => {
  await api(page)
  await login(page)
  await page.route('**/api/sesiones', route => route.fulfill({ json: [session, { ...session, id: '3', participante_codigo: 'P-002' }] }))
  let release
  const gate = new Promise(resolve => { release = resolve })
  await page.route('**/api/sesiones/2/resultados', async route => { await gate; await route.fulfill({ json: [{ ...complete, observaciones: 'Resultado antiguo' }] }) })
  await page.route('**/api/sesiones/3/resultados', route => route.fulfill({ json: [{ ...complete, observaciones: 'Resultado nuevo' }] }))
  await page.goto('/resultados')
  await page.getByLabel('Seleccionar sesión de prueba').selectOption('3')
  await expect(page.getByText('Resultado nuevo')).toBeVisible()
  const oldResponse = page.waitForResponse(response => response.url().endsWith('/api/sesiones/2/resultados'))
  release()
  await oldResponse
  await expect(page.getByText('Resultado antiguo')).not.toBeVisible()
  await expect(page.getByText('Resultado nuevo')).toBeVisible()
})
