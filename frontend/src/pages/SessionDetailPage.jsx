import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import PageHeader from '../components/PageHeader.jsx'
import { ErrorState, LoadingState } from '../components/UiState.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'
import { sessions } from '../services/persistence.js'

export default function SessionDetailPage() {
  const { id } = useParams()
  const [session, setSession] = useState(null)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showCloseModal, setShowCloseModal] = useState(false)

  const load = useCallback(() => {
    setError('')
    sessions
      .detail(id)
      .then((s) => {
        setSession(s)
        setConsent(Boolean(s.consentimiento_confirmado))
      })
      .catch((reason) => setError(reason.message))
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function change(action) {
    setBusy(true)
    setError('')
    try {
      setSession(
        await sessions.update(id, {
          accion: action,
          consentimiento_confirmado: consent,
        }),
      )
    } catch (reason) {
      setError(reason.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="EJECUCIÓN / SESIÓN"
        title={session ? `Sesión de ${session.participante_codigo}` : 'Detalle de sesión'}
        description="El avance guardado permanece disponible al recargar o reabrir esta dirección."
      />

      <ConfirmModal
        isOpen={showCloseModal}
        title="Finalizar sesión"
        message="¿Deseas cerrar y finalizar esta sesión de prueba? Ya no se podrán registrar nuevos resultados en ella."
        confirmText="Finalizar sesión"
        cancelText="Volver"
        isDanger={false}
        onConfirm={() => {
          setShowCloseModal(false)
          change('cerrar')
        }}
        onCancel={() => setShowCloseModal(false)}
      />

      {error && <ErrorState message={error} onRetry={load} />}
      {!session && !error && <LoadingState />}
      {session && (
        <section className="form-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Información de la sesión</h2>
            <span
              className={`badge ${
                session.estado === 'en_curso'
                  ? 'badge-active'
                  : session.estado === 'pendiente'
                  ? 'badge-draft'
                  : 'badge-subtle'
              }`}
            >
              {session.estado.toUpperCase()}
            </span>
          </div>

          <p>
            <strong>Plan asociado:</strong>{' '}
            <Link to={`/planes/${session.plan_id}`}>{session.plan_nombre}</Link>
          </p>

          <p>
            <strong>Participante anónimo:</strong>{' '}
            <code>{session.participante_codigo}</code>
          </p>

          {session.estado === 'pendiente' && (
            <div
              style={{
                border: '1px solid #cfdfec',
                borderRadius: '8px',
                padding: '16px',
                background: '#f4f9fd',
                display: 'grid',
                gap: '12px',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '15px', color: '#173d66' }}>
                Condición de inicio: Consentimiento informado
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#45596e' }}>
                De acuerdo a las pautas de ética en IHC, antes de iniciar la sesión de prueba de usabilidad debe verificarse y registrarse la conformidad del participante.
              </p>
              <label className="checkbox-label" style={{ fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                Confirmo que se preparó y obtuvo el consentimiento informado del participante.
              </label>
              <div className="form-actions">
                <button
                  className="button button-primary"
                  disabled={!consent || busy}
                  onClick={() => change('iniciar')}
                >
                  {busy ? 'Iniciando…' : 'Iniciar sesión de prueba'}
                </button>
              </div>
            </div>
          )}

          {session.estado === 'en_curso' && (
            <div className="form-actions">
              <button
                className="button button-primary"
                disabled={busy}
                onClick={() => setShowCloseModal(true)}
              >
                {busy ? 'Cerrando…' : 'Finalizar y cerrar sesión'}
              </button>
            </div>
          )}

          <h2>Tareas a ejecutar ({session.tareas?.length ?? 0})</h2>
          <ol style={{ paddingLeft: '20px', display: 'grid', gap: '8px' }}>
            {session.tareas.map((task) => (
              <li key={task.id} style={{ fontSize: '14px' }}>
                <strong>{task.titulo}</strong>
                {task.criterio_exito && (
                  <p style={{ margin: '3px 0 0', color: '#576a7d', fontSize: '12px' }}>
                    Criterio: {task.criterio_exito}
                  </p>
                )}
              </li>
            ))}
          </ol>

          <div style={{ marginTop: '12px' }}>
            <Link className="button button-outline" to="/sesiones">
              Volver a sesiones
            </Link>
          </div>
        </section>
      )}
    </>
  )
}
