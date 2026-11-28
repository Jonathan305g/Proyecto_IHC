const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const root = path.join(__dirname, '..'), git = args => { const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' }); return r.status === 0 ? r.stdout.trim() : 'no-disponible' }
const jobs = [['Pruebas de backend y frontend', ['test']], ['Compilacion', ['run', 'build']], ['Navegador Chromium', ['run', 'test:e2e', '--prefix', 'frontend']]]
const report = { fecha: new Date().toISOString(), revision: git(['rev-parse', 'HEAD']), arbol: git(['rev-parse', 'HEAD^{tree}']), node: process.version, cambios_locales: Boolean(git(['status', '--porcelain'])), comprobaciones: [], sesiones_con_participantes: 'No verificadas por este comando' }
for (const [nombre, args] of jobs) {
 console.log('\nVERIFICANDO | ' + nombre)
 const r = process.platform === 'win32' ? spawnSync('cmd.exe', ['/d', '/s', '/c', 'npm', ...args], { cwd: root, stdio: 'inherit' }) : spawnSync('npm', args, { cwd: root, stdio: 'inherit' })
 report.comprobaciones.push({ nombre, estado: r.status === 0 ? 'aprobado' : 'fallido', codigo: r.status })
 if (r.status !== 0) { process.exitCode = 1; break }
}
report.resultado = report.comprobaciones.length === jobs.length && report.comprobaciones.every(c => c.estado === 'aprobado') ? 'aprobado' : 'fallido'
const directory = path.join(root, 'verification-results', 'sprint4'); fs.mkdirSync(directory, { recursive: true }); fs.writeFileSync(path.join(directory, 'verificacion.json'), JSON.stringify(report, null, 2) + '\n')
console.log('\n' + report.resultado.toUpperCase() + ' | Registro: verification-results/sprint4/verificacion.json')
