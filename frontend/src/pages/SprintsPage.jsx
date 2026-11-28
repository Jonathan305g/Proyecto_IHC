import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import PlanPicker from '../components/PlanPicker.jsx'
import PageHeader from '../components/PageHeader.jsx'
import SprintPlanningForm from '../components/SprintPlanningForm.jsx'
import { ErrorState, LoadingState } from '../components/UiState.jsx'
import { scrum } from '../services/scrum.js'
import { backlog } from '../services/backlog.js'

export default function SprintsPage() {
 const [params, setParams] = useSearchParams(), p = params.get('plan_id') || ''
 const [data, setData] = useState(null), [error, setError] = useState(''), [message, setMessage] = useState(''), [loading, setLoading] = useState(false), [busy, setBusy] = useState(false), [tick, setTick] = useState(0)
 const [form, setForm] = useState(null), [alias, setAlias] = useState(''), key = useRef(crypto.randomUUID())
 const changePlan = useCallback(value => { setParams({ plan_id: value }); setData(null); setForm(null); setMessage(''); setAlias(''); key.current = crypto.randomUUID() }, [setParams])
 useEffect(() => {
  if (!p) return
  let active = true; setLoading(true); setError('')
  Promise.all([scrum.listar(p), scrum.responsables(p), backlog.listar(p)]).then(([sprints, members, stories]) => { if (active) setData({ p, sprints, members, stories: stories.historias }) })
   .catch(e => { if (active) { setData(null); setError(e.message) } }).finally(() => { if (active) setLoading(false) })
  return () => { active = false }
 }, [p, tick])
 const current = data?.p === p ? data : null
 async function save(b) {
  setBusy(true); setError('')
  try { const s = form.id ? await scrum.editar(p, form.id, b) : await scrum.crear(p, b); setForm(null); setMessage(`Sprint #${s.id} guardado: ${s.avance.puntos_seleccionados} puntos seleccionados.`); setTick(n => n + 1) }
  catch (e) { setError(`${e.message} Conservamos el formulario. Si perdiste la confirmación, consulta la lista antes de iniciar otra planificación.`) }
  finally { setBusy(false) }
 }
 async function edit(s) {
  setBusy(true); setError('')
  try { setForm(await scrum.obtener(p, s.id)) } catch (e) { setError(e.message) } finally { setBusy(false) }
 }
 async function member(e) {
  e.preventDefault(); setBusy(true); setError('')
  try { await scrum.crearResponsable(p, { solicitud_id: key.current, alias }); setAlias(''); key.current = crypto.randomUUID(); setMessage('Responsable guardado.'); setTick(n => n + 1) }
  catch (e) { setError(e.message) } finally { setBusy(false) }
 }
 return <div className="scrum-workspace">
  <PageHeader eyebrow="HU-09 / S4-01" title="Planificación de sprints" description="Organiza las historias de mejora del producto, su capacidad y sus responsables." />
  <PlanPicker value={p} onChange={changePlan} disabled={busy || Boolean(form)} />
  {message && <p role="status" className="notice">{message}</p>}
  {error && <ErrorState message={error} onRetry={!form && !busy ? () => setTick(n => n + 1) : undefined} />}
  {loading && <LoadingState label="Cargando sprints y backlog…" />}
  {current && <>
   <section className="form-panel"><h2>Responsables del producto</h2><p>Utiliza un alias de trabajo. Estos responsables pertenecen al plan seleccionado.</p>
    <form className="scrum-inline" onSubmit={member}><label>Alias del responsable<input required maxLength={120} value={alias} disabled={busy} onChange={e => setAlias(e.target.value)} /></label><button className="button button-outline" disabled={busy}>Agregar responsable</button></form>
    <ul>{current.members.map(m => <li key={m.id}>{m.alias}{!m.activo && ' (inactivo)'}</li>)}</ul>
   </section>
   {form && <SprintPlanningForm key={form.id || 'new'} sprint={form.id ? form : null} members={current.members} stories={current.stories} busy={busy} onSave={save} onCancel={() => setForm(null)} />}
   <section className="form-panel"><div className="scrum-inline"><h2>Sprints guardados</h2><button className="button button-primary" disabled={busy || Boolean(form)} onClick={() => { setForm({}); setMessage(''); setError('') }}>Nuevo sprint</button><button className="button button-outline" disabled={busy || Boolean(form)} onClick={() => setTick(n => n + 1)}>Actualizar sprints</button></div>
    {!current.sprints.length && <p>No hay sprints para este plan.</p>}
    <ul className="scrum-list">{current.sprints.map(s => <li key={s.id}><h3>#{s.id} · {s.nombre}</h3><p>{s.objetivo}</p><p>{s.fecha_inicio} — {s.fecha_fin} · Capacidad: {s.capacidad} puntos · {s.estado}</p><button className="button button-outline" disabled={busy || Boolean(form) || s.estado !== 'planificado'} onClick={() => edit(s)}>Editar sprint #{s.id}</button></li>)}</ul>
    <p><Link to={`/backlog?plan_id=${p}`}>Abrir backlog y estimar historias</Link></p>
   </section>
  </>}
 </div>
}
