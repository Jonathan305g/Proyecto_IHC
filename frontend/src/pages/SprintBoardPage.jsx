import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import PageHeader from '../components/PageHeader.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'
import { ErrorState, LoadingState } from '../components/UiState.jsx'
import useProductSprint from '../hooks/useProductSprint.js'
import { ESTADOS_TAREA } from '../domain/scrum.js'
import { scrum } from '../services/scrum.js'

function TaskCard({ task, story, members, disabled, active, onEdit, onMove, onRemove }) {
 const [editing, setEditing] = useState(false), [title, setTitle] = useState(task.titulo), [member, setMember] = useState(task.responsable_id)
 const allowed = { pendiente: ['en_progreso'], en_progreso: ['pendiente', 'en_revision'], en_revision: ['en_progreso', 'terminada'], terminada: ['en_revision'] }
 return <article className="scrum-card" aria-label={`Tarea #${task.id}`}>
  <h3>#{task.id} · {task.titulo}</h3><p>Historia #{task.historia_id}: {story?.titulo} · {story?.puntos} puntos</p><p>Responsable: {task.responsable}</p>
  <label>Cambiar estado de tarea #{task.id}<select id={`sprint-task-state-${task.id}`} aria-label={`Cambiar estado de tarea #${task.id}`} value={task.estado} disabled={disabled || !active} onChange={e => onMove(task, e.target.value)}>
   {Object.entries(ESTADOS_TAREA).map(([value, label]) => <option key={value} value={value} disabled={value !== task.estado && !allowed[task.estado].includes(value)}>{label}</option>)}</select></label>
  <button className="button button-outline" disabled={disabled} onClick={() => { setEditing(v => !v); setTitle(task.titulo); setMember(task.responsable_id) }}>Editar tarea #{task.id}</button>
  {!active && <button className="button button-outline" disabled={disabled} onClick={() => onRemove(task)}>Retirar tarea #{task.id}</button>}
  {editing && <form className="scrum-fieldset" onSubmit={async e => { e.preventDefault(); if (await onEdit(task, { titulo: title, responsable_id: member })) setEditing(false) }}>
   <label>Título de tarea #{task.id}<input required maxLength={240} value={title} disabled={disabled} onChange={e => setTitle(e.target.value)} /></label>
   <label>Responsable de tarea #{task.id}<select aria-label={`Responsable de tarea #${task.id}`} value={member} disabled={disabled} onChange={e => setMember(e.target.value)}>{members.filter(m => m.activo).map(m => <option key={m.id} value={m.id}>{m.alias}</option>)}</select></label>
   <button className="button button-primary" disabled={disabled}>Guardar tarea #{task.id}</button><button type="button" className="button button-outline" onClick={() => setEditing(false)}>Cancelar edición de tarea</button>
  </form>}
 </article>
}
export default function SprintBoardPage() {
 const { id } = useParams(), [params] = useSearchParams(), p = params.get('plan_id') || ''
 const vm = useProductSprint(p, id), s = vm.data, [title, setTitle] = useState(''), [history, setHistory] = useState(''), [member, setMember] = useState(''), [confirm, setConfirm] = useState(null), key = useRef(crypto.randomUUID())
 const [focusTask, setFocusTask] = useState(null)
 useEffect(() => { if (focusTask && !vm.busy) { document.getElementById(`sprint-task-state-${focusTask}`)?.focus(); setFocusTask(null) } }, [focusTask, vm.busy, s?.version])
 const historyId = history || s?.historias[0]?.id || '', memberId = member || vm.members.find(m => m.activo)?.id || ''
 async function add(e) {
  e.preventDefault()
  if (await vm.mutate(s => scrum.crearTarea(p, id, { version: s.version, solicitud_id: key.current, historia_id: historyId, titulo: title, responsable_id: memberId }), 'Tarea guardada.')) { setTitle(''); key.current = crypto.randomUUID() }
 }
 return <div className="scrum-workspace">
  <PageHeader eyebrow="HU-09 / S4-03" title="Tablero del sprint" description="Gestiona tareas por teclado. Los estados y el avance se confirman en el servidor." />
  <p><Link to={`/sprints?plan_id=${p}`}>Volver a planificación</Link> · <Link to={`/sprints/${id}/cierre?plan_id=${p}`}>Review y retrospectiva</Link></p>
  {vm.loading && <LoadingState label="Cargando tablero…" />}{vm.error && <ErrorState message={vm.error} onRetry={!vm.busy ? vm.reload : undefined} />}{vm.message && <p role="status" className="notice">{vm.message}</p>}
  {s && <>
   <section className="form-panel"><h2>{s.nombre} · {s.estado}</h2><p>{s.objetivo}</p>
    <p>Puntos entregados: {s.avance.puntos_entregados} de {s.avance.puntos_seleccionados} · Pendientes: {s.avance.puntos_pendientes}</p>
    {s.avance.porcentaje_puntos != null && <label>Avance por puntos: {s.avance.porcentaje_puntos}%<progress max="100" value={s.avance.porcentaje_puntos} /></label>}
    <p>Tareas terminadas: {s.avance.tareas_terminadas} de {s.avance.tareas} · {s.avance.porcentaje_tareas ?? 'Sin tareas'}{s.avance.porcentaje_tareas != null && '%'}</p>
    <div className="form-actions"><button className="button button-outline" disabled={vm.busy} onClick={vm.reload}>Actualizar tablero</button>
     {s.estado === 'planificado' && <button className="button button-primary" disabled={vm.busy} onClick={() => setConfirm({ type: 'activate' })}>Activar sprint</button>}</div>
   </section>
   {s.estado !== 'cerrado' && <section className="form-panel"><h2>Nueva tarea del sprint</h2><form onSubmit={add}><fieldset disabled={vm.busy || !s.historias.length} className="scrum-fieldset">
    <label>Historia de la tarea<select required value={historyId} onChange={e => setHistory(e.target.value)}>{s.historias.map(h => <option key={h.id} value={h.id}>#{h.id} · {h.titulo}</option>)}</select></label>
    <label>Título de la nueva tarea<input required maxLength={240} value={title} onChange={e => setTitle(e.target.value)} /></label>
    <label>Responsable de la nueva tarea<select required value={memberId} onChange={e => setMember(e.target.value)}><option value="">Selecciona responsable</option>{vm.members.filter(m => m.activo).map(m => <option key={m.id} value={m.id}>{m.alias}</option>)}</select></label>
    <button className="button button-primary">Agregar tarea</button></fieldset></form></section>}
   <section className="scrum-board" aria-label="Columnas del tablero">{Object.entries(ESTADOS_TAREA).map(([state, label]) => <section className="scrum-column" key={state} aria-label={`Columna ${label}`}><h2>{label}</h2>
    {s.tareas.filter(t => t.estado === state).map(t => <TaskCard key={`${t.id}-${t.titulo}-${t.responsable_id}`} task={t} story={s.historias.find(h => h.id === t.historia_id)} members={vm.members} disabled={vm.busy || s.estado === 'cerrado'} active={s.estado !== 'planificado'}
     onEdit={(task, b) => vm.mutate(s => scrum.editarTarea(p, id, task.id, { version: s.version, ...b }), 'Tarea editada.')}
     onMove={(task, state) => { setFocusTask(task.id); return vm.mutate(s => scrum.moverTarea(p, id, task.id, { version: s.version, estado: state }), 'Estado guardado.') }}
     onRemove={task => setConfirm({ type: 'remove', task })} />)}
    {!s.tareas.some(t => t.estado === state) && <p>No hay tareas en esta columna.</p>}
   </section>)}</section>
   <section className="form-panel"><h2>Historias seleccionadas y avance</h2><ul>{s.historias.map(h => <li key={h.id}><Link to={`/historias/${h.id}?plan_id=${p}`}>#{h.id} · {h.titulo}</Link> · {h.puntos} puntos · {ESTADOS_TAREA[h.estado]} · {h.responsable || 'Sin asignar'}</li>)}</ul>
    <h2>Historial reciente</h2><ol>{s.eventos.slice(0, 10).map(e => <li key={e.id}>{e.accion} · {new Date(e.registrado_en).toLocaleString('es-EC')}</li>)}</ol>
   </section>
  </>}
  <ConfirmModal isOpen={Boolean(confirm)} title={confirm?.type === 'activate' ? 'Activar sprint' : 'Retirar tarea del sprint'} message={confirm?.type === 'activate' ? 'La selección de historias y su capacidad quedarán congeladas. El tablero permitirá avanzar las tareas.' : 'La tarea se retirará de la planificación. La historia permanecerá seleccionada.'} busy={vm.busy} onCancel={() => setConfirm(null)} onConfirm={async () => {
   const ok = confirm.type === 'activate' ? await vm.mutate(s => scrum.activar(p, id, { version: s.version }), 'Sprint activado.') : await vm.mutate(s => scrum.retirarTarea(p, id, confirm.task.id, { version: s.version }), 'Tarea retirada.')
   if (ok) setConfirm(null)
  }} />
 </div>
}
