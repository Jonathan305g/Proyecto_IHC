import { test, expect } from '@playwright/test'
import { setupProduct, loginProduct } from './support/sprint4-fixtures.js'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
async function capture(page, name) {
 if (!process.env.S4_EVIDENCE_DIR) return
 await mkdir(process.env.S4_EVIDENCE_DIR, { recursive: true }); await page.screenshot({ path: path.join(process.env.S4_EVIDENCE_DIR, name + '.png'), fullPage: true })
}
test('S4-08: conservar foco al mover tarjeta por teclado', async ({ page }) => {
 await setupProduct(page, { seedSprint: true, active: true }); await loginProduct(page, '/sprints/1/tablero?plan_id=1')
 const selector = () => page.getByLabel('Cambiar estado de tarea #1', { exact: true })
 await selector().focus(); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter')
 await expect(selector()).toHaveValue('en_progreso')
 await capture(page, 'QA-01-foco-tablero')
 await expect(selector()).toBeFocused()
})
test('S4-08: proteger borrador de review al navegar y cancelar salida', async ({ page }) => {
 await setupProduct(page, { seedSprint: true, active: true }); await loginProduct(page, '/sprints/1/cierre?plan_id=1')
 await page.getByLabel('Comentarios de revisión', { exact: true }).fill('Comentario sin guardar')
 await page.getByRole('link', { name: 'Volver al tablero', exact: true }).click()
 await capture(page, 'QA-02-salida-review')
 await expect(page.getByRole('alertdialog')).toContainText('sin guardar')
 await page.getByRole('alertdialog').getByRole('button', { name: 'Seguir editando', exact: true }).click()
 await expect(page.getByLabel('Comentarios de revisión', { exact: true })).toHaveValue('Comentario sin guardar')
 await page.getByRole('link', { name: 'Volver al tablero', exact: true }).click()
 await page.getByRole('alertdialog').getByRole('button', { name: 'Salir sin guardar', exact: true }).click()
 await expect(page.getByRole('heading', { name: 'Tablero del sprint', exact: true })).toBeVisible()
})
test('S4-08: aviso ante Atras del navegador mantiene la review al cancelar', async ({ page }) => {
 await setupProduct(page, { seedSprint: true, active: true }); await loginProduct(page, '/sprints?plan_id=1')
 await page.getByRole('link', { name: 'Abrir tablero #1', exact: true }).click()
 await page.getByRole('link', { name: 'Review y retrospectiva', exact: true }).click()
 await page.getByLabel('Comentarios de revisión', { exact: true }).fill('Comentario protegido')
 await page.goBack()
 await expect(page.getByRole('alertdialog')).toBeVisible()
 await page.getByRole('button', { name: 'Seguir editando', exact: true }).click()
 await expect(page.getByLabel('Comentarios de revisión', { exact: true })).toHaveValue('Comentario protegido')
})
test('S4-08: planificacion protege navegacion y registra aviso de recarga', async ({ page }) => {
 await setupProduct(page); await loginProduct(page, '/sprints?plan_id=1')
 await page.getByRole('button', { name: 'Nuevo sprint', exact: true }).click()
 await page.getByLabel('Nombre del sprint', { exact: true }).fill('Borrador protegido')
 expect(await page.evaluate(() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented })).toBe(true)
 await page.getByRole('navigation', { name: 'Navegación principal', exact: true }).getByRole('link', { name: 'Backlog', exact: true }).click()
 await expect(page.getByRole('alertdialog')).toContainText('sin guardar')
 await page.getByRole('button', { name: 'Seguir editando', exact: true }).click()
 await expect(page.getByLabel('Nombre del sprint', { exact: true })).toHaveValue('Borrador protegido')
})
