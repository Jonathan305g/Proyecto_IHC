import { ErrorContrato, RespuestaIA, SolicitudIA } from './contrato'
import { MetaIA } from './proveedor'

export type EstadoAnalisis = 'pendiente' | 'procesando' | 'completado' | 'parcial' | 'fallido'
export interface GrupoAnalisis {
  id: string
  estado: EstadoAnalisis
  intentos: number
  solicitud: SolicitudIA
  respuesta?: RespuestaIA
  meta?: MetaIA
  error?: ErrorContrato
}
export interface EjecucionAnalisis {
  version: '1.0'
  resultado_ids: string[]
  huella_fuentes: string
  grupos: GrupoAnalisis[]
}
export interface RegistroAnalisis {
  id: string
  plan_id: string
  solicitud_id: string
  estado: EstadoAnalisis
  revision_en: Date | null
  iniciado_en: Date
  terminado_en: Date | null
  bloqueo: string | null
  vencido: boolean
  ejecucion: EjecucionAnalisis | null
}

export function estadoDeGrupos(grupos: readonly GrupoAnalisis[]): EstadoAnalisis {
  if (grupos.some(g => g.estado === 'procesando')) return 'procesando'
  if (grupos.every(g => g.estado === 'pendiente')) return 'pendiente'
  const completos = grupos.filter(g => g.estado === 'completado').length
  return completos === grupos.length ? 'completado' : completos ? 'parcial' : 'fallido'
}
