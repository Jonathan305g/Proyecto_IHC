import { test, expect } from '@playwright/test'
import { setupProduct, loginProduct } from './support/sprint4-fixtures.js'
async function editReview(page) {
 await page.getByLabel('Comentarios de revisión', { exact: true }).fill('Entregas revisadas con el equipo')
 await page.getByLabel('Aspectos positivos', { exact: true }).fill('Se comprende la confirmación')
 await page.getByLabel('Dificultades', { exact: true }).fill('Falta recuperar filtros')
 await page.getByRole('button', { name: 'Agregar acuerdo', exact: true }).click()
 await page.getByLabel('Acción del acuerdo 1', { exact: true }).fill('Completar recuperación de filtros')
}
test('S4-05: borrador y acuerdo recuperables; cierre con cancelacion y confirmacion', async ({ page }) => {
 await setupProduct(page, { seedSprint: true, active: true }); await loginProduct(page, '/sprints/1/cierre?plan_id=1'); await editReview(page)
 await expect(page.getByRole('button', { name: 'Cerrar sprint', exact: true })).toBeDisabled()
 await page.getByRole('button', { name: 'Guardar borrador de cierre', exact: true }).click(); await expect(page.getByText('Borrador guardado.', { exact: true })).toBeVisible()
 await page.reload(); await expect(page.getByLabel('Acción del acuerdo 1', { exact: true })).toHaveValue('Completar recuperación de filtros')
 await page.getByLabel('Motivo del retorno al backlog').fill('Se prioriza completar filtros en el siguiente sprint')
 await page.getByRole('button', { name: 'Cerrar sprint', exact: true }).click(); await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar', exact: true }).click()
 await expect(page.getByRole('button', { name: 'Guardar borrador de cierre', exact: true })).toBeEnabled()
 await page.getByRole('button', { name: 'Cerrar sprint', exact: true }).click(); await page.getByRole('button', { name: 'Cerrar definitivamente', exact: true }).click()
 await expect(page.getByText('Sprint cerrado.', { exact: false })).toBeVisible(); await page.reload()
 await expect(page.getByLabel('Comentarios de revisión', { exact: true })).toBeDisabled()
 await expect(page.getByText('Puntos entregados: 0 · Puntos pendientes: 8', { exact: true })).toBeVisible()
})
test('S4-05: fallo de guardado conserva comentarios y acuerdo sin declarar exito', async ({ page }) => {
 await setupProduct(page, { seedSprint: true, active: true, failSave: true }); await loginProduct(page, '/sprints/1/cierre?plan_id=1'); await editReview(page)
 await page.getByRole('button', { name: 'Guardar borrador de cierre', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('No se guardó la review')
 await expect(page.getByLabel('Comentarios de revisión', { exact: true })).toHaveValue('Entregas revisadas con el equipo')
 await expect(page.getByRole('button', { name: 'Cerrar sprint', exact: true })).toBeDisabled()
})
