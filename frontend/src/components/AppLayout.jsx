import { useState } from 'react'
import { supabase } from '../services/auth.js'
import { NavLink, Outlet } from 'react-router'

const navigation = [
  { to: '/planes', label: 'Planes', icon: '▤' },
  { to: '/sesiones', label: 'Sesiones', icon: '◷' },
  { to: '/resultados', label: 'Resultados', icon: '▥' },
]

export default function AppLayout() {
  const [error, setError] = useState('')
  async function logout() {
    const { error: failure } = await supabase.auth.signOut({ scope: 'local' })
    if (failure) setError('No se pudo cerrar la sesión. Reintenta.')
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#contenido">Saltar al contenido principal</a>
      <aside className="sidebar" aria-label="Panel lateral">
        <NavLink className="brand" to="/planes" aria-label="Panel de pruebas, ir a Planes">
          <span className="brand-mark" aria-hidden="true">UT</span>
          <span className="brand-copy"><strong>Usability Test</strong><small>Panel de pruebas</small></span>
        </NavLink>
        <p className="nav-label">ESPACIO DE TRABAJO</p>
        <nav className="primary-nav" aria-label="Navegación principal">
          {navigation.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <span className="nav-icon" aria-hidden="true">{icon}</span>{label}
            </NavLink>
          ))}
        </nav>
        <p className="sidebar-foot">Grupo 6 · Interacción Humano Computador</p>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <span className="topbar-title">Panel de pruebas de usabilidad</span>
          <button className="button button-outline" onClick={logout}>Cerrar mi sesión</button>
        </header>
        <main id="contenido" className="page-content" tabIndex="-1">
          {error && <p role="alert">{error}</p>}
          <Outlet />
        </main>
      </div>
    </div>
  )
}
