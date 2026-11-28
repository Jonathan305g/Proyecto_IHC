require('reflect-metadata')
const { readiness } = require('./environment.cjs')

readiness().then(checks => {
  for (const c of checks) console.log(`${c.ok ? 'OK' : 'PENDIENTE'} | ${c.name}: ${c.detail}`)
  if (checks.some(c => !c.ok)) process.exitCode = 2
  else console.log('Configuración comprobada. Falta ejecutar verify:live para validar operaciones reales.')
}).catch(() => {
  console.error('No se pudo completar la comprobación. No se muestran credenciales ni detalles internos.')
  process.exitCode = 1
})
