import { test, expect } from '@playwright/test'
import { setupProduct, loginProduct } from './support/sprint4-fixtures.js'
test('S4-03: activar y avanzar tarea por teclado; progreso y recarga', async ({ page }) => {
 await setupProduct(page, { seedSprint: true }); await loginProduct(page, '/sprints/1/tablero?plan_id=1')
 await page.getByRole('button', { name: 'Activar sprint', exact: true }).click(); await page.getByRole('alertdialog').getByRole('button', { name: 'Confirmar', exact: true }).click()
 const selector = () => page.getByLabel('Cambiar estado de tarea #1', { exact: true })
 await selector().focus(); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter')
 await expect(selector()).toHaveValue('en_progreso')
 await selector().selectOption('en_revision'); await expect(page.getByRole('region', { name: 'Columna En revisión', exact: true }).getByRole('article', { name: 'Tarea #1', exact: true })).toBeVisible()
 await selector().selectOption('terminada'); await expect(page.getByText('Puntos entregados: 3 de 8', { exact: false })).toBeVisible()
 await page.reload(); await expect(selector()).toHaveValue('terminada')
})
test('S4-03: editar tarea y conservar columna cuando el servidor rechaza cambio', async ({ page }) => {
 const s = await setupProduct(page, { seedSprint: true, active: true }); await loginProduct(page, '/sprints/1/tablero?plan_id=1')
 await page.getByRole('button', { name: 'Editar tarea #1', exact: true }).click(); await page.getByLabel('Título de tarea #1', { exact: true }).fill('Confirmar cambios al guardar')
 await page.getByRole('button', { name: 'Guardar tarea #1', exact: true }).click(); await expect(page.getByRole('heading', { name: '#1 · Confirmar cambios al guardar', exact: true })).toBeVisible()
 s.failMove = true; await page.getByLabel('Cambiar estado de tarea #1', { exact: true }).selectOption('en_progreso')
 await expect(page.getByRole('alert')).toContainText('último estado confirmado')
 await expect(page.getByLabel('Cambiar estado de tarea #1', { exact: true })).toHaveValue('pendiente')
 await page.getByRole('button', { name: 'Actualizar tablero', exact: true }).click(); await expect(page.getByLabel('Cambiar estado de tarea #1', { exact: true })).toHaveValue('pendiente')
})
