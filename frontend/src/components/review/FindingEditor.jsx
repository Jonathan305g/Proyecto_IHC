import { useState } from 'react'
import { Link } from 'react-router'
import ConfirmModal from '../ConfirmModal.jsx'
import { revision } from '../../services/revision.js'
import { CATEGORIAS, SEVERIDADES, ESTADOS_HALLAZGO, canApprove, draftFromFinding } from '../../domain/revision.js'

export default function FindingEditor({ planId, finding, onChanged, onBusy, disabled }) {
  const [draft, setDraft] = useState(() => draftFromFinding(finding)), [title, setTitle] = useState(finding.resumen.slice(0, 180))
  const [reason, setReason] = useState(''), [confirm, setConfirm] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const pending = finding.estado === 'pendiente', frozen = busy || disabled || !pending
  const change = (name, value) => setDraft(old => ({ ...old, [name]: value }))
  async function action(kind) {
    setBusy(true); onBusy(true); setError('')
    try {
      if (kind === 'discard') {
        await revision.descartar(planId, finding.id, { version: finding.version, comentario: reason.trim() })
        onChanged('Hallazgo descartado. Se conservó su origen; no se creó una historia.')
      } else {
        const saved = await revision.guardar(planId, finding.id, { ...draft, version: finding.version })
        if (kind === 'approve') {
          const result = await revision.aprobar(planId, finding.id, { version: saved.version, titulo: title.trim() })
          onChanged(`Historia #${result.historia.id} ${result.reutilizada ? 'recuperada' : 'añadida'} al backlog.`, result.historia.id)
        } else onChanged('Borrador guardado. Todavía no está aprobado.')
      }
      setConfirm(null)
    } catch (e) {
      setError(`${e.message} No se confirmó la acción. Consulta el estado antes de repetirla; los cambios que llegaron a guardarse permanecen en el servidor.`)
      setConfirm(null)
    } finally { setBusy(false); onBusy(false) }
  }
  return <section className="form-panel finding-editor" aria-label={`Revisión del hallazgo ${finding.id}`}>
    <div className="review-title-row"><h2>Hallazgo #{finding.id}</h2><span className="badge">{ESTADOS_HALLAZGO[finding.estado]}</span></div>
    <div className="review-comparison">
      <section aria-label="Observaciones de origen"><h3>Observaciones originales</h3>
        {finding.observaciones.map(o => <article key={o.resultado_id} className="review-source">
          <strong>Resultado #{o.resultado_id} · {o.tarea_titulo}</strong><p className="preserve-text">{o.texto_original}</p>
          {o.texto_revisado !== o.texto_original && <details><summary>Texto revisado enviado a IA</summary><p className="preserve-text">{o.texto_revisado}</p></details>}
        </article>)}
        <details open><summary>Propuesta inicial de IA</summary>
          {finding.propuesta_ia ? <><p className="preserve-text">{finding.propuesta_ia.resumen}</p><p>{CATEGORIAS[finding.propuesta_ia.categoria]} · {SEVERIDADES[finding.propuesta_ia.severidad]}</p>
            <p className="preserve-text">{finding.propuesta_ia.mejora_sugerida}</p></> : <p>Hallazgo legado: no hay copia de propuesta IA.</p>}
        </details>
      </section>
      <form onSubmit={e => { e.preventDefault(); action('save') }} aria-label="Edición de la propuesta">
        <h3>Revisión humana</h3>
        <fieldset disabled={frozen}><legend>Contenido revisado</legend>
          <label htmlFor="finding-summary">Resumen revisado</label><textarea id="finding-summary" required maxLength={1000} value={draft.resumen} onChange={e => change('resumen', e.target.value)} />
          <label htmlFor="finding-category">Categoría</label><select id="finding-category" value={draft.categoria} onChange={e => change('categoria', e.target.value)}>
            {Object.entries(CATEGORIAS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select>
          <label htmlFor="finding-severity">Severidad</label><select id="finding-severity" value={draft.severidad} onChange={e => change('severidad', e.target.value)}>
            {Object.entries(SEVERIDADES).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select>
          <label htmlFor="finding-improvement">Mejora sugerida</label><textarea id="finding-improvement" required maxLength={1500} value={draft.mejora_sugerida} onChange={e => change('mejora_sugerida', e.target.value)} />
          <label htmlFor="finding-criterion">Criterio de aceptación</label><textarea id="finding-criterion" maxLength={3000} value={draft.criterio_aceptacion} onChange={e => change('criterio_aceptacion', e.target.value)} />
          <p className="field-hint">Obligatorio para aprobar. Describe un resultado observable.</p>
          <label htmlFor="finding-story-title">Título de historia</label><input id="finding-story-title" maxLength={180} value={title} onChange={e => setTitle(e.target.value)} />
          <label htmlFor="finding-discard-reason">Motivo del descarte</label><textarea id="finding-discard-reason" maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} />
        </fieldset>
        {error && <p role="alert" className="notice notice-error">{error}</p>}
        {pending && <div className="form-actions review-actions">
          <button className="button button-outline" type="submit" disabled={busy || disabled}>Guardar borrador</button>
          <button className="button button-primary" type="button" disabled={busy || disabled || !canApprove(draft, title)} onClick={() => setConfirm('approve')}>Aprobar y añadir al backlog</button>
          <button className="button button-danger" type="button" disabled={busy || disabled || !reason.trim()} onClick={() => setConfirm('discard')}>Descartar</button>
        </div>}
      </form>
    </div>
    {finding.comentario_revision && <p className="notice">Motivo: {finding.comentario_revision}</p>}
    {finding.historia_id && <Link className="button button-outline" to={`/historias/${finding.historia_id}?plan_id=${planId}`}>Ver historia #{finding.historia_id}</Link>}
    <ConfirmModal isOpen={Boolean(confirm)} title={confirm === 'approve' ? 'Aprobar sugerencia' : 'Descartar sugerencia'}
      message={confirm === 'approve' ? 'Se guardarán tus cambios y se creará una única historia vinculada al hallazgo. Esta decisión cierra su revisión.' : 'Se conservará el hallazgo como descartado con tu motivo. No se creará una historia.'}
      confirmText={confirm === 'approve' ? 'Sí, aprobar y crear historia' : 'Sí, descartar'} isDanger={confirm === 'discard'} busy={busy}
      onCancel={() => setConfirm(null)} onConfirm={() => action(confirm === 'approve' ? 'approve' : 'discard')} />
  </section>
}
