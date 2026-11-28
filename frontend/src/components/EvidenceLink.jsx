import { useState } from 'react'
import { evidencias } from '../services/evidencias.js'

/** La API entrega una URL firmada de corta duración después de autorizar al usuario. */
export default function EvidenceLink({ evidence }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function open() {
    const tab = window.open('about:blank', '_blank')
    if (tab) tab.opener = null
    setBusy(true); setError('')
    try {
      const { url } = await evidencias.access(evidence.id)
      const parsed = new URL(url)
      if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('El enlace no es válido.')
      if (tab) tab.location.replace(url)
      else { setError('Permite abrir ventanas emergentes y vuelve a intentarlo.') }
    } catch (reason) { tab?.close(); setError(reason.message || 'No se pudo abrir la evidencia.') }
    finally { setBusy(false) }
  }
  return <span>
    <button type="button" className="button button-outline button-sm" disabled={busy} onClick={open}>
      {busy ? 'Abriendo…' : 'Abrir evidencia'}<span className="visually-hidden"> «{evidence.nombre_archivo || evidence.ruta}» (se abre en otra pestaña)</span>
    </button>
    {error && <span role="alert" className="field-error">{error}</span>}
  </span>
}
