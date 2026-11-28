import { useRef, useState } from 'react'
import ConfirmModal from './ConfirmModal.jsx'
import { planningDraft, planningPayload, selectedPoints } from '../domain/scrum.js'

export default function SprintPlanningForm({ sprint, stories, members, busy, onSave, onCancel }) {
 const [draft, setDraft] = useState(() => planningDraft(sprint)), [dirty, setDirty] = useState(false), [confirm, setConfirm] = useState(false)
 const key = useRef(crypto.randomUUID()), points = selectedPoints(stories, draft.historias), remaining = Number(draft.capacidad) - points.total
 const update = (k, v) => { setDraft(d => ({ ...d, [k]: v })); setDirty(true) }
 const toggle = id => update('historias', draft.historias.some(h => h.historia_id === id) ? draft.historias.filter(h => h.historia_id !== id) : [...draft.historias, { historia_id: id, responsable_id: null }])
 return <section className="form-panel" aria-label="Formulario de planificación">
  <h2>{sprint ? `Editar sprint #${sprint.id}` : 'Nuevo sprint del producto'}</h2>
  <form onSubmit={e => { e.preventDefault(); onSave(planningPayload(draft, sprint ? { version: sprint.version } : { solicitud_id: key.current })) }}>
   <fieldset disabled={busy} className="scrum-fieldset">
    <label>Nombre del sprint<input required maxLength={100} value={draft.nombre} onChange={e => update('nombre', e.target.value)} /></label>
    <label>Objetivo del sprint<textarea required maxLength={2000} value={draft.objetivo} onChange={e => update('objetivo', e.target.value)} /></label>
    <div className="scrum-grid">
     <label>Fecha de inicio<input type="date" required value={draft.fecha_inicio} onChange={e => update('fecha_inicio', e.target.value)} /></label>
     <label>Fecha de fin<input type="date" required min={draft.fecha_inicio || undefined} value={draft.fecha_fin} onChange={e => update('fecha_fin', e.target.value)} /></label>
     <label>Capacidad en puntos<input type="number" required min="0" max="10000" step="1" value={draft.capacidad} onChange={e => update('capacidad', e.target.value)} /></label>
    </div>
    <p role="status">Puntos seleccionados: <strong>{points.total}</strong> · Capacidad restante: <strong>{remaining}</strong></p>
    <p id="planning-help">Selecciona historias pendientes y estimadas. Asigna responsables antes de activar. Una historia comprometida en otro sprint abierto será rechazada al guardar.</p>
    <div className="scrum-table-wrap"><table><caption>Historias del backlog disponibles para planificar</caption><thead><tr><th scope="col">Seleccionar</th><th scope="col">Historia</th><th scope="col">Puntos</th><th scope="col">Responsable</th></tr></thead>
     <tbody>{stories.map(s => { const id = String(s.id), selected = draft.historias.find(h => h.historia_id === id), eligible = s.estado === 'pendiente' && Number.isInteger(s.puntos)
      return <tr key={id}><td><input type="checkbox" aria-label={`Seleccionar historia #${id}`} checked={Boolean(selected)} disabled={!eligible && !selected} aria-describedby="planning-help" onChange={() => toggle(id)} /></td>
       <th scope="row">#{id} · {s.titulo}{!eligible && <small className="scrum-help">{s.puntos == null ? 'Estima sus puntos en el backlog.' : 'No está pendiente.'}</small>}</th><td>{s.puntos ?? 'Sin estimar'}</td>
       <td><select aria-label={`Responsable de historia #${id}`} disabled={!selected} value={selected?.responsable_id || ''} onChange={e => update('historias', draft.historias.map(h => h.historia_id === id ? { ...h, responsable_id: e.target.value || null } : h))}>
        <option value="">Sin asignar</option>{members.filter(m => m.activo).map(m => <option key={m.id} value={m.id}>{m.alias}</option>)}</select></td></tr> })}</tbody></table></div>
    {!stories.length && <p>El backlog está vacío. Crea o aprueba historias y estima sus puntos para seleccionarlas.</p>}
    {remaining < 0 && <p role="alert">La selección supera la capacidad. Retira historias o ajusta la capacidad.</p>}
    <div className="form-actions"><button className="button button-primary" disabled={remaining < 0 || points.sinEstimar > 0}>Guardar planificación</button>
     <button type="button" className="button button-outline" onClick={() => dirty ? setConfirm(true) : onCancel()}>Cancelar planificación</button></div>
   </fieldset>
  </form>
  <ConfirmModal isOpen={confirm} title="Descartar cambios de planificación" message="Los cambios que no hayas guardado se perderán." onCancel={() => setConfirm(false)} onConfirm={onCancel} />
 </section>
}
