import { PoolClient } from 'pg'
import { missing } from './validation'

export interface LockedSession { id: string; plan_id: string; estado: string; consentimiento_confirmado: boolean }

// Orden común: plan, luego sesión. El plan bloqueado estabiliza tareas y cupo
// mientras se comprueban las reglas y se realiza la escritura.
export async function lockSession(client: PoolClient, identifier: string): Promise<LockedSession> {
  const found = await client.query<{ plan_id: string }>('SELECT plan_id FROM public.sesiones WHERE id = $1', [identifier])
  if (!found.rows.length) missing('La sesión')
  await client.query('SELECT id FROM public.planes WHERE id = $1 FOR UPDATE', [found.rows[0].plan_id])
  const { rows } = await client.query<LockedSession>(
    'SELECT id, plan_id, estado, consentimiento_confirmado FROM public.sesiones WHERE id = $1 FOR UPDATE', [identifier],
  )
  if (!rows.length) missing('La sesión')
  return rows[0]
}
