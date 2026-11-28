import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { setupProduct, loginProduct } from './support/sprint4-fixtures.js'
import { setupComparison } from './support/comparison-fixtures.js'
async function reportRoutes(page) {
 const calls = [], buffer = await readFile(new URL('../../docs/sprint4/evidencias-tecnicas/S4-07_referencia.pdf', import.meta.url))
 await page.route('**/api/informes/previsualizar', route => { calls.push(route.request().postDataJSON()); return route.fulfill({ json: { reporte_id: 'f118848a-5742-4894-9a51-a680c8a102cf', documento: { titulo: 'Informe de evaluación de usabilidad', bloques: [{ tipo: 'texto', texto: 'Alcance confirmado: plan #1.' }, { tipo: 'titulo', texto: 'Hallazgos aprobados' }, { tipo: 'texto', texto: 'No hay hallazgos aprobados en este período.' }] } } }) })
 await page.route('**/api/informes/f118848a-5742-4894-9a51-a680c8a102cf/*', route => { const pdf = route.request().url().endsWith('/pdf'); expect(route.request().headers().authorization).toMatch(/^Bearer /); return route.fulfill({ contentType: pdf ? 'application/pdf' : 'text/markdown; charset=utf-8', headers: { 'Content-Disposition': `attachment; filename="informe-plan-1.${pdf ? 'pdf' : 'md'}"` }, body: pdf ? buffer : '# Informe de evaluación\n\nSin datos.' }) })
 return calls
}
test('S4-07: vista previa y descargas autenticadas PDF y Markdown', async ({ page }) => {
 await setupProduct(page); await reportRoutes(page); await loginProduct(page, '/informes?plan_id=1')
 await page.getByRole('button', { name: 'Preparar vista previa', exact: true }).click()
 await expect(page.getByRole('region', { name: 'Vista previa del informe', exact: true })).toContainText('No hay hallazgos aprobados')
 for (const format of ['Markdown', 'PDF']) { const waiting = page.waitForEvent('download'); await page.getByRole('button', { name: `Descargar ${format}`, exact: true }).click(); const download = await waiting; expect(download.suggestedFilename()).toBe(`informe-plan-1.${format === 'PDF' ? 'pdf' : 'md'}`) }
 await page.getByLabel('Hallazgos aprobados', { exact: true }).uncheck(); await expect(page.getByRole('button', { name: 'Descargar PDF', exact: true })).toHaveCount(0)
})
test('S4-07: incorporar comparacion explicita desde su pantalla', async ({ page }) => {
 await setupComparison(page); const calls = await reportRoutes(page); await loginProduct(page, '/comparacion')
 await page.getByLabel('Equivalente para tarea #1', { exact: true }).selectOption('11'); await page.getByRole('button', { name: 'Comparar evaluaciones', exact: true }).click()
 await page.getByRole('link', { name: 'Usar esta comparación en informe', exact: true }).click()
 await expect(page.getByLabel('Comparación seleccionada', { exact: true })).toBeChecked()
 await page.getByRole('button', { name: 'Preparar vista previa', exact: true }).click(); await expect(page.getByRole('button', { name: 'Descargar PDF', exact: true })).toBeVisible()
 expect(calls[0].comparacion.equivalencias).toEqual([{ tarea_a: '1', tarea_b: '11' }]); expect(calls[0].plan_id).toBe('1')
})
