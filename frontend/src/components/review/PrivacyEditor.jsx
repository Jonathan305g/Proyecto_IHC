import { useState } from 'react'
import { privacyFromAnalysis } from '../../domain/revision.js'
import { revision } from '../../services/revision.js'
export default function PrivacyEditor({ planId, analysis, onSaved, disabled, onDirty, onBusy }) {
  const [items, setItems] = useState(() => privacyFromAnalysis(analysis)), [checked, setChecked] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const change = (index, name, value) => { setChecked(false); onDirty(true); setItems(old => old.map((o, i) => i === index ? { ...o, [name]: value } : o)) }
  async function save(e) {
    e.preventDefault(); setBusy(true); onBusy(true); setError('')
    try { onSaved(await revision.privacidad(planId, analysis.id, { observaciones: items })); onDirty(false) }
    catch (reason) { setError(reason.message) } finally { setBusy(false); onBusy(false) }
  }
  return <form className="review-privacy" onSubmit={save}>
    <h3>Revisión de privacidad antes de enviar</h3>
    <p>Retira nombres, contactos y datos personales del texto, título y criterio. Esta revisión no aprueba las propuestas posteriores.</p>
    <fieldset disabled={disabled || busy}><legend>Textos que recibirá Gemini</legend>
      {items.map((o, index) => <section key={o.resultado_id} className="review-source">
        <strong>Resultado #{o.resultado_id}</strong>
        <label htmlFor={`privacy-title-${index}`}>Título revisado #{o.resultado_id}</label><input id={`privacy-title-${index}`} required maxLength={150} value={o.titulo_tarea} onChange={e => change(index, 'titulo_tarea', e.target.value)} />
        <label htmlFor={`privacy-text-${index}`}>Texto revisado #{o.resultado_id}</label><textarea id={`privacy-text-${index}`} required maxLength={2000} value={o.texto} onChange={e => change(index, 'texto', e.target.value)} />
        <label htmlFor={`privacy-criterion-${index}`}>Criterio revisado #{o.resultado_id}</label><textarea id={`privacy-criterion-${index}`} maxLength={500} value={o.criterio_exito || ''} onChange={e => change(index, 'criterio_exito', e.target.value || null)} />
      </section>)}
      <label className="review-checkbox"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} />Confirmo que revisé la privacidad de todos estos textos.</label>
    </fieldset>
    {error && <p role="alert" className="notice notice-error">{error}</p>}
    <button className="button button-outline" disabled={disabled || busy || !checked}>Guardar revisión de privacidad</button>
  </form>
}
