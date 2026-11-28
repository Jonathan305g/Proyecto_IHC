import { test, expect } from '@playwright/test'
import { setupProduct, loginProduct } from './support/sprint4-fixtures.js'
async function fill(page) {
 await page.getByRole('button', { name: 'Nuevo sprint', exact: true }).click()
 await page.getByLabel('Nombre del sprint', { exact: true }).fill('Sprint de confirmaciones')
 await page.getByLabel('Objetivo del sprint').fill('Mejorar el guardado')
 await page.getByLabel('Fecha de inicio').fill('2026-11-27'); await page.getByLabel('Fecha de fin').fill('2026-12-10')
 await page.getByLabel('Capacidad en puntos').fill('8')
 await page.getByLabel('Seleccionar historia #1', { exact: true }).check()
 await page.getByLabel('Responsable de historia #1', { exact: true }).selectOption('1')
}
test('S4-01: crear, editar, quitar seleccion y recuperar al recargar', async ({ page }) => {
 await setupProduct(page); await loginProduct(page, '/sprints?plan_id=1'); await fill(page)
 await expect(page.getByText('Puntos seleccionados:', { exact: false })).toContainText('3')
 await page.getByRole('button', { name: 'Guardar planificación', exact: true }).click()
 await expect(page.getByText('Sprint #1 guardado:', { exact: false })).toBeVisible()
 await page.reload(); await page.getByRole('button', { name: 'Editar sprint #1', exact: true }).click()
 await expect(page.getByLabel('Nombre del sprint', { exact: true })).toHaveValue('Sprint de confirmaciones')
 await page.getByLabel('Seleccionar historia #1', { exact: true }).uncheck(); await page.getByLabel('Seleccionar historia #2', { exact: true }).check()
 await page.getByLabel('Responsable de historia #2', { exact: true }).selectOption('1')
 await page.getByRole('button', { name: 'Guardar planificación', exact: true }).click()
 await expect(page.getByText('Sprint #1 guardado:', { exact: false })).toContainText('5 puntos')
})
test('S4-01: capacidad y fallo conservan formulario y UUID de reintento', async ({ page }) => {
 const s = await setupProduct(page, { failSave: true }); await loginProduct(page, '/sprints?plan_id=1'); await fill(page)
 await page.getByLabel('Capacidad en puntos').fill('2'); await expect(page.getByRole('button', { name: 'Guardar planificación', exact: true })).toBeDisabled()
 await page.getByLabel('Capacidad en puntos').fill('8'); await page.getByRole('button', { name: 'Guardar planificación', exact: true }).click()
 await expect(page.getByRole('alert')).toContainText('Conservamos el formulario')
 await expect(page.getByLabel('Nombre del sprint', { exact: true })).toHaveValue('Sprint de confirmaciones')
 await page.getByRole('button', { name: 'Guardar planificación', exact: true }).click(); await expect(page.getByText('Sprint #1 guardado:', { exact: false })).toBeVisible()
 const calls = s.calls.filter(c => c.suffix === 'sprints-producto' && c.method === 'POST'); expect(calls).toHaveLength(2); expect(calls[0].body.solicitud_id).toBe(calls[1].body.solicitud_id)
})
