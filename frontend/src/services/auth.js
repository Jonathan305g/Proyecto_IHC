import { createClient } from '@supabase/supabase-js'

const url = import.meta.env?.VITE_SUPABASE_URL
const key = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY
export const supabase = url && key ? createClient(url, key) : null

export async function authHeaders() {
  if (!supabase) throw new Error('Configura la conexión pública de Supabase en frontend/.env.')
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session) throw new Error('Inicia sesión para continuar.')
  return { Authorization: `Bearer ${data.session.access_token}` }
}
