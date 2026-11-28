import { useEffect, useState } from 'react'
import { supabase } from '../services/auth.js'

export default function AuthGate({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    let active = true
    supabase.auth.getSession().then(({ data, error: failure }) => {
      if (active) { setSession(data.session); setError(failure ? 'No se pudo recuperar la sesión.' : ''); setLoading(false) }
    }).catch(() => { if (active) { setError('No se pudo recuperar la sesión.'); setLoading(false) } })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => { if (active) setSession(next) })
    return () => { active = false; data.subscription.unsubscribe() }
  }, [])
  async function login(event) {
    event.preventDefault(); setBusy(true); setError('')
    const form = new FormData(event.currentTarget)
    try {
      const { error: failure } = await supabase.auth.signInWithPassword({ email: String(form.get('correo')).trim(), password: String(form.get('clave')) })
      if (failure) setError('No se pudo iniciar sesión. Revisa tus credenciales y la confirmación de tu correo.')
    } catch { setError('No se pudo contactar al servidor. Reintenta cuando recuperes la conexión.') }
    finally { setBusy(false) }
  }
  if (loading) return <main className="page-content" role="status">Comprobando sesión…</main>
  if (session) return children
  return <main className="page-content" style={{ maxWidth: 600, margin: 'auto' }}>
    <h1>Usability Test · Grupo 6</h1>
    <p>Inicia sesión con tu cuenta autorizada para trabajar con planes, sesiones y evidencias.</p>
    {!supabase ? <p role="alert">Falta configurar la conexión pública con Supabase. Consulta el README del proyecto.</p> :
      <form className="form-panel" onSubmit={login}>
        <label>Correo del equipo<input name="correo" type="email" autoComplete="username" required disabled={busy} /></label>
        <label>Contraseña<input name="clave" type="password" autoComplete="current-password" required disabled={busy} /></label>
        {error && <p role="alert" className="notice notice-error">{error}</p>}
        <button type="submit" className="button button-primary" disabled={busy}>{busy ? 'Ingresando…' : 'Iniciar sesión'}</button>
      </form>}
  </main>
}
