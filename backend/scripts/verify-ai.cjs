// Ensayo independiente: no usa BD ni datos privados de participantes.
const { ProveedorIA } = require('../dist/analisis-ia/proveedor')
const { prepararSolicitud } = require('../dist/analisis-ia/contrato')

async function main() {
  const args = process.argv.slice(2)
  if (args.length !== 1 || !['--demo', '--live'].includes(args[0])) {
    console.log('Uso: node --env-file=backend/.env backend/scripts/verify-ai.cjs --demo | --live')
    console.log('--live envia una observacion ficticia al proveedor y puede consumir saldo de la API.')
    process.exitCode = 1
    return
  }
  const demo = args[0] === '--demo'
  if (!demo && process.env.IA_MODE !== 'gemini') {
    console.log('PENDIENTE | Configura IA_MODE=gemini, IA_MODEL y GEMINI_API_KEY en backend/.env.')
    process.exitCode = 1
    return
  }
  const input = prepararSolicitud('1', [{ resultado_id: '1', plan_id: '1', tarea_id: '1',
    titulo_tarea: 'Guardar cambios', criterio_exito: 'Reconocer que el guardado termino.',
    resultado: 'con_ayuda', observacion_revisada: 'La confirmacion de guardado paso desapercibida y se solicito ayuda.',
    privacidad_revisada: true, estado_sesion: 'cerrada', consentimiento_confirmado: true }])
  if (!input.ok) throw new Error('IA_SOLICITUD_INVALIDA')
  const provider = new ProveedorIA(demo ? { ...process.env, IA_MODE: 'demo' } : process.env)
  const result = await provider.analizar(input.data)
  if (!result.ok) {
    console.log(`PENDIENTE | ${result.error.code} | intentos=${result.meta.intentos}`)
    process.exitCode = 1
    return
  }
  console.log(`OK | modo=${result.meta.modo} | intentos=${result.meta.intentos} | estado=${result.meta.estado} | respuesta=${result.data.estado}`)
  console.log(`EVIDENCIA | fecha=${new Date().toISOString()} | modelo=${result.meta.modelo || 'demo-local'}`)
  console.log(`OK | Contrato y origen validos | hallazgos=${result.data.hallazgos.length}`)
  if (result.meta.advertencia) console.log(result.meta.advertencia)
  console.log(demo ? 'APROBADO | Demostracion local del contrato; conexion real pendiente.' : 'APROBADO | Conexion real y respuesta validadas; calidad del contenido requiere revision humana.')
}
main().catch(() => { console.log('PENDIENTE | No se pudo completar el ensayo de IA.'); process.exitCode = 1 })
