import { join } from 'node:path'
import { PayloadTooLargeException } from '@nestjs/common'
const { PDFDocument } = require('pdfkit')
export type Block = { tipo: 'titulo' | 'texto'; texto: string } | { tipo: 'tabla'; columnas: string[]; filas: string[][] }
export interface ReportDocument { titulo: string; plan_id: string; generado_en: string; bloques: Block[]; avisos: string[] }
const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/([`*_#[\]|<>])/g, '\\$1').replace(/\r?\n/g, ' / ')
export function markdown(d: ReportDocument): string {
 return '# ' + escape(d.titulo) + '\n\n' + d.bloques.map(b => b.tipo === 'tabla'
  ? ['| ' + b.columnas.map(escape).join(' | ') + ' |', '| ' + b.columnas.map(() => '---').join(' | ') + ' |', ...b.filas.map(r => '| ' + r.map(escape).join(' | ') + ' |')].join('\n')
  : (b.tipo === 'titulo' ? '## ' : '') + b.texto.split(/\r?\n/).map(escape).join('\n\n')).join('\n\n') + '\n'
}
export function pdf(d: ReportDocument): Promise<Buffer> {
 return new Promise((resolve, reject) => {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 44, bottom: 48, left: 44, right: 44 }, bufferPages: true, info: { Title: d.titulo, Author: 'Usability Test Dashboard - Grupo 6', Subject: 'Resultados aprobados de evaluacion' } })
  const chunks: Buffer[] = []; let bytes = 0
  doc.on('data', (b: Buffer) => { bytes += b.length; if (bytes > 4 * 1024 * 1024) { reject(new PayloadTooLargeException('Reduce el alcance del informe.')); doc.destroy() } else chunks.push(b) })
  doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject)
  let pages = 1
  doc.on('pageAdded', () => { if (++pages > 200) throw new PayloadTooLargeException('El informe supera 200 paginas. Reduce el periodo.') })
  try {
   doc.registerFont('regular', join(__dirname, '../../assets/DejaVuSans.ttf'))
   doc.registerFont('bold', join(__dirname, '../../assets/DejaVuSans-Bold.ttf'))
   const width = doc.page.width - 88, bottom = () => doc.page.height - 48
   const space = (height: number) => { if (doc.y + height > bottom()) doc.addPage() }
   doc.font('bold').fontSize(20).fillColor('#15324f').text(d.titulo, { width }); doc.moveDown(.6)
   for (const block of d.bloques) {
    if (block.tipo === 'titulo') { space(55); doc.font('bold').fontSize(13).fillColor('#15324f').text(block.texto, { width }); doc.moveDown(.4) }
    else if (block.tipo === 'texto') { doc.font('regular').fontSize(10).fillColor('#172b43').text(block.texto, { width, lineGap: 3 }); doc.moveDown(.6) }
    else if (block.tipo === 'tabla') {
     const n = block.columnas.length, widths = block.columnas.map((_, i) => n === 1 ? width : i === 0 ? width * .29 : width * .71 / (n - 1))
     const row = (cells: string[], header = false) => {
      doc.font(header ? 'bold' : 'regular').fontSize(8.5)
      const h = Math.max(...cells.map((cell, i) => doc.heightOfString(cell, { width: widths[i] - 12, lineGap: 1 }))) + 12
      space(h); const top = doc.y; let x = 44
      cells.forEach((cell, i) => { doc.rect(x, top, widths[i], h).fillAndStroke(header ? '#e7edf4' : '#ffffff', '#c9d2df'); doc.fillColor('#172b43').text(cell, x + 6, top + 6, { width: widths[i] - 12, lineGap: 1 }); x += widths[i] })
      doc.x = 44; doc.y = top + h
     }
     row(block.columnas, true)
     for (const cells of block.filas) {
      doc.font('regular').fontSize(8.5)
      const h = Math.max(...cells.map((c, i) => doc.heightOfString(c, { width: widths[i] - 12, lineGap: 1 }))) + 12
      if (doc.y + h > bottom()) { doc.addPage(); row(block.columnas, true) }
      row(cells)
     }
     doc.moveDown(.7)
    }
   }
   const range = doc.bufferedPageRange()
   for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i); const previous = doc.page.margins.bottom; doc.page.margins.bottom = 0
    doc.font('regular').fontSize(8).fillColor('#526276').text(`Plan #${d.plan_id} | ${i + 1} de ${range.count}`, 44, doc.page.height - 28, { width, align: 'right', lineBreak: false })
    doc.page.margins.bottom = previous
   }
   doc.end()
  } catch (e) { reject(e); doc.destroy() }
 })
}
