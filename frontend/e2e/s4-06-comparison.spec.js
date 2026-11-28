import { test, expect } from '@playwright/test'
import { setupComparison } from './support/comparison-fixtures.js'
import { loginProduct } from './support/sprint4-fixtures.js'
test('S4-06: equivalencia, resultados, unidades y tareas excluidas visibles', async ({ page }) => {
 await setupComparison(page); await loginProduct(page, '/comparacion')
 await page.getByLabel('Equivalente para tarea #1', { exact: true }).selectOption('11')
 await page.getByRole('button', { name: 'Comparar evaluaciones', exact: true }).click()
 const result = page.getByRole('region', { name: 'Resultado de comparación', exact: true })
 await expect(result.getByRole('heading', { name: 'Agregado de tareas comparables', exact: true })).toBeVisible()
 await expect(result.getByText('50 pp', { exact: true })).toHaveCount(2)
 await expect(result.getByText('A: #2 Exclusiva A', { exact: true })).toBeVisible()
 await page.getByLabel('Equivalente para tarea #1', { exact: true }).selectOption('')
 await page.getByRole('button', { name: 'Comparar evaluaciones', exact: true }).click()
 await expect(result).toContainText('No existen pares'); await expect(result.getByRole('heading', { name: 'Agregado de tareas comparables', exact: true })).toHaveCount(0)
})
