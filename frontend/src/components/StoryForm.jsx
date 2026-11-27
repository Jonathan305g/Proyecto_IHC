import { useRef, useState } from 'react'
import ConfirmModal from './ConfirmModal.jsx'
import { ESTADOS_HISTORIA, storyBody, storyDraft, validateStory } from '../domain/backlog.js'

export default function StoryForm({ story, busy, onSave, onCancel }) {
  const [draft, setDraft] = useState(() => storyDraft(story)), [errors, setErrors] = useState({}), [cancelConfirm, setCancelConfirm] = useState(false)
  const initial = useRef(JSON.stringify(storyDraft(story))), requestId = useRef(crypto.randomUUID())
  const change = (key, value) => { setDraft(old => ({ ...old, [key]: value })); setErrors(old => ({ ...old, [key]: undefined })) }
  function submit(e) {
    e.preventDefault(); const found = validateStory(draft); setErrors(found)
    if (Object.keys(found).length) return
    onSave(storyBody(draft, story ? { version: story.version } : { solicitud_id: requestId.current }))
  }
  function cancel() { JSON.stringify(draft) === initial.current ? onCancel() : setCancelConfirm(true) }
  return <section className="form-panel story-form" aria-label={story ? 'Editar historia' : 'Crear historia manual'}>
    <h2>{story ? `Editar historia #${story.id}` : 'Nueva historia manual'}</h2>
    {story?.hallazgo_id && <p className="notice">Origen: hallazgo #{story.hallazgo_id}. La edición conserva ese vínculo.</p>}
    <form onSubmit={submit} noValidate>
      <fieldset disabled={busy}><legend>Datos de la historia</legend>
        {[['titulo', 'Título', 180], ['descripcion', 'Descripción', 4000], ['criterio_aceptacion', 'Criterio de aceptación', 3000]].map(([key, label, max]) => <div key={key}>
          <label htmlFor={`story-${key}`}>{label}</label>
          {key === 'titulo' ? <input id={`story-${key}`} maxLength={max} required value={draft[key]} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `story-error-${key}` : undefined} onChange={e => change(key, e.target.value)} />
            : <textarea id={`story-${key}`} maxLength={max} required value={draft[key]} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `story-error-${key}` : undefined} onChange={e => change(key, e.target.value)} />}
          {errors[key] && <p id={`story-error-${key}`} role="alert" className="field-error">{errors[key]}</p>}
        </div>)}
        <div className="story-form-grid">
          <div><label htmlFor="story-priority">Prioridad</label><select id="story-priority" value={draft.prioridad} onChange={e => change('prioridad', e.target.value)}>
            {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}{n === 1 ? ' · Más alta' : n === 5 ? ' · Más baja' : ''}</option>)}</select>
            {errors.prioridad && <p role="alert">{errors.prioridad}</p>}</div>
          <div><label htmlFor="story-points">Puntos</label><input id="story-points" type="number" min="1" max="100" step="1" value={draft.puntos} onChange={e => change('puntos', e.target.value)} aria-describedby="story-points-hint" />
            <p id="story-points-hint" className="field-hint">Opcional: vacío significa sin estimar.</p>{errors.puntos && <p role="alert">{errors.puntos}</p>}</div>
          <div><label htmlFor="story-state">Estado</label><select id="story-state" value={draft.estado} onChange={e => change('estado', e.target.value)}>
            {Object.entries(ESTADOS_HISTORIA).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{errors.estado && <p role="alert">{errors.estado}</p>}</div>
        </div>
      </fieldset>
      <div className="form-actions"><button className="button button-primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar historia'}</button>
        <button className="button button-outline" type="button" disabled={busy} onClick={cancel}>Cancelar edición</button></div>
    </form>
    <ConfirmModal isOpen={cancelConfirm} title="Descartar cambios locales" message="Los cambios sin guardar de esta historia se perderán. La versión guardada permanece en el servidor."
      confirmText="Sí, descartar cambios" isDanger onCancel={() => setCancelConfirm(false)} onConfirm={onCancel} />
  </section>
}
