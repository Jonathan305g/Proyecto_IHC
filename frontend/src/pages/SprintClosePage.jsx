import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import PageHeader from '../components/PageHeader.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'
import { ErrorState, LoadingState } from '../components/UiState.jsx'
import useProductSprint from '../hooks/useProductSprint.js'
import { scrum } from '../services/scrum.js'
import { ESTADOS_TAREA } from '../domain/scrum.js'

function ReviewForm({ s, members, busy, onSave, onClose }) {
 const saved = s.revision?.guardado_en, r = s.revision || {}, closed = s.estado === 'cerrado'
 const [draft, setDraft] = useState(() => ({ entregas: saved ? r.entregas : `Historias terminadas: ${s.historias.filter(h => h.estado === 'terminada').map(h => '#' + h.id).join(', ') || 'ninguna'}. ${s.avance.puntos_entregados} puntos.`,
  pendientes: saved ? r.pendientes : `Historias pendientes: ${s.historias.filter(h => h.estado !== 'terminada').map(h => '#' + h.id).join(', ') || 'ninguna'}. ${s.avance.puntos_pendientes} puntos.`,
  observaciones: r.observaciones || '', aspectos_positivos: r.aspectos_positivos || '', dificultades: r.dificultades || '', acuerdos: r.acuerdos || [] }))
 const [dirty, setDirty] = useState(false), [confirm, setConfirm] = useState(false), [reason, setReason] = useState('')
 const update = (k, v) => { setDraft(d => ({ ...d, [k]: v })); setDirty(true) }
 const agreement = (id, k, v) => update('acuerdos', draft.acuerdos.map(a => a.id === id ? { ...a, [k]: v } : a))
 const canClose = s.estado === 'activo' && !dirty && saved && ['entregas', 'pendientes', 'observaciones', 'aspectos_positivos', 'dificultades'].every(k => draft[k].trim()) && draft.acuerdos.length > 0 && (!s.avance.puntos_pendientes || reason.trim())
 return <section className="form-panel"><h2>Review y retrospectiva</h2>
  {closed && <p role="status" className="notice">Sprint cerrado. La revisión conserva una instantánea del cierre.</p>}
  {dirty && <p role="status">Hay cambios sin guardar. Guarda el borrador antes de cerrar el sprint.</p>}
  <form onSubmit={e => { e.preventDefault(); onSave({ version: s.version, ...draft, acuerdos: draft.acuerdos.map(({ id, accion, responsable_id, fecha_compromiso, completado }) => ({ id, accion, responsable_id, fecha_compromiso, completado })) }) }}>
   <fieldset className="scrum-fieldset" disabled={busy || closed}>
    {Object.entries({ entregas: 'Entregas de la review', pendientes: 'Trabajo pendiente', observaciones: 'Comentarios de revisión', aspectos_positivos: 'Aspectos positivos', dificultades: 'Dificultades' }).map(([key, label]) => <label key={key}>{label}<textarea aria-label={label} maxLength={4000} value={draft[key]} onChange={e => update(key, e.target.value)} /></label>)}
    <h3>Acuerdos de mejora</h3>
    {draft.acuerdos.map((a, i) => <fieldset className="scrum-fieldset scrum-card" key={a.id}><legend>Acuerdo {i + 1}</legend>
     <label>Acción del acuerdo {i + 1}<textarea aria-label={`Acción del acuerdo ${i + 1}`} required maxLength={2000} value={a.accion} onChange={e => agreement(a.id, 'accion', e.target.value)} /></label>
     <label>Responsable del acuerdo {i + 1}<select aria-label={`Responsable del acuerdo ${i + 1}`} required value={a.responsable_id} onChange={e => agreement(a.id, 'responsable_id', e.target.value)}><option value="">Selecciona responsable</option>{members.filter(m => m.activo || m.id === a.responsable_id).map(m => <option key={m.id} value={m.id}>{m.alias}</option>)}</select></label>
     <label>Fecha del acuerdo {i + 1}<input type="date" required min={s.fecha_inicio} value={a.fecha_compromiso} onChange={e => agreement(a.id, 'fecha_compromiso', e.target.value)} /></label>
     <label><input type="checkbox" checked={a.completado} onChange={e => agreement(a.id, 'completado', e.target.checked)} />Acuerdo {i + 1} completado</label>
     <button type="button" className="button button-outline" onClick={() => update('acuerdos', draft.acuerdos.filter(v => v.id !== a.id))}>Quitar acuerdo {i + 1}</button>
    </fieldset>)}
    <button type="button" className="button button-outline" disabled={draft.acuerdos.length >= 30} onClick={() => update('acuerdos', [...draft.acuerdos, { id: crypto.randomUUID(), accion: '', responsable_id: members.find(m => m.activo)?.id || '', fecha_compromiso: s.fecha_fin, completado: false }])}>Agregar acuerdo</button>
    {!closed && <button className="button button-primary">Guardar borrador de cierre</button>}
   </fieldset>
  </form>
  {!closed && <section><h3>Cierre del sprint</h3><p>Las historias incompletas volverán al backlog como pendientes. El sprint conservará sus tareas y el historial de lo entregado.</p>
   {s.avance.puntos_pendientes > 0 && <label>Motivo del retorno al backlog<textarea maxLength={2000} value={reason} disabled={busy} onChange={e => setReason(e.target.value)} /></label>}
   <p>Requisitos: sprint activo, borrador guardado, todos los comentarios completos y al menos un acuerdo con responsable y fecha.</p>
   <button className="button button-primary" disabled={busy || !canClose} onClick={() => setConfirm(true)}>Cerrar sprint</button>
  </section>}
  <ConfirmModal isOpen={confirm} title="Confirmar cierre del sprint" message={`Se conservará una instantánea con ${s.avance.puntos_entregados} puntos entregados y ${s.avance.puntos_pendientes} pendientes. El cierre no se puede editar.`} busy={busy} confirmText="Cerrar definitivamente" onCancel={() => setConfirm(false)} onConfirm={async () => { if (await onClose({ version: s.version, confirmacion: true, motivo_pendientes: reason })) setConfirm(false) }} />
 </section>
}
export default function SprintClosePage() {
 const { id } = useParams(), [params] = useSearchParams(), p = params.get('plan_id') || '', vm = useProductSprint(p, id, scrum.cierre), s = vm.data
 return <div className="scrum-workspace"><PageHeader eyebrow="HU-10 / S4-05" title="Review y retrospectiva" description="Revisa entregas, documenta acuerdos y conserva el cierre del sprint." />
  <p><Link to={`/sprints/${id}/tablero?plan_id=${p}`}>Volver al tablero</Link> · <Link to={`/sprints?plan_id=${p}`}>Planificación</Link></p>
  {vm.loading && <LoadingState label="Cargando review…" />}{vm.error && <ErrorState message={vm.error} onRetry={!vm.busy ? vm.reload : undefined} />}{vm.message && <p role="status" className="notice">{vm.message}</p>}
  {s && <><section className="form-panel"><h2>{s.nombre} · {s.estado}</h2><p>Puntos entregados: {s.avance.puntos_entregados} · Puntos pendientes: {s.avance.puntos_pendientes}</p>
   <ul>{s.historias.map(h => <li key={h.id}>#{h.id} · {h.titulo} · {h.puntos} puntos · {ESTADOS_TAREA[h.estado]}</li>)}</ul></section>
   <ReviewForm key={`${s.id}-${s.version}`} s={s} members={vm.members} busy={vm.busy} onSave={b => vm.mutate(() => scrum.guardarCierre(p, id, b), 'Borrador guardado.')} onClose={b => vm.mutate(() => scrum.cerrar(p, id, b), 'Sprint cerrado e historial conservado.')} />
  </>}
 </div>
}
