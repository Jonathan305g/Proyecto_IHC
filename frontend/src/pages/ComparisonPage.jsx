import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import PageHeader from '../components/PageHeader.jsx'
import ComparisonResults from '../components/ComparisonResults.jsx'
import { ErrorState, LoadingState } from '../components/UiState.jsx'
import { plans } from '../services/persistence.js'
import { compareEvaluations } from '../services/comparison.js'
const scope = (id, dates) => ({ plan_id: id, ...(dates.desde ? { desde: new Date(dates.desde).toISOString() } : {}), ...(dates.hasta ? { hasta: new Date(dates.hasta).toISOString() } : {}) })
export default function ComparisonPage() {
 const [items, setItems] = useState([]), [a, setA] = useState(''), [b, setB] = useState(''), [da, setDa] = useState({}), [db, setDb] = useState({}), [tasks, setTasks] = useState(null), [mapping, setMapping] = useState({}), [report, setReport] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [tick, setTick] = useState(0)
 useEffect(() => { let active = true; setError(''); plans.list().then(rows => { if (active) { setItems(rows); setA(v => v || String(rows[0]?.id || '')); setB(v => v || String(rows[1]?.id || rows[0]?.id || '')) } }).catch(e => { if (active) setError(e.message) }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [tick])
 useEffect(() => {
  setTasks(null); setMapping({}); setReport(null); if (!a || !b) return
  let active = true; setLoading(true); setError('')
  Promise.all([plans.detail(a), plans.detail(b)]).then(([pa, pb]) => { if (active) setTasks({ a, b, ta: pa.tareas || [], tb: pb.tareas || [] }) }).catch(e => { if (active) setError(e.message) }).finally(() => { if (active) setLoading(false) })
  return () => { active = false }
 }, [a, b, tick])
 async function compare(e) {
  e.preventDefault(); setBusy(true); setError(''); setReport(null)
  try { setReport(await compareEvaluations({ a: scope(a, da), b: scope(b, db), equivalencias: Object.entries(mapping).filter(([, v]) => v).map(([tarea_a, tarea_b]) => ({ tarea_a, tarea_b })) })) }
  catch (e) { setError(e.message) } finally { setBusy(false) }
 }
 const current = tasks?.a === a && tasks?.b === b ? tasks : null
 return <div className="scrum-workspace"><PageHeader eyebrow="HU-12 / S4-06" title="Comparar evaluaciones" description="Relaciona tareas equivalentes de dos planes o períodos. Las tareas exclusivas se muestran por separado." />
  {error && <ErrorState message={error} onRetry={!busy ? () => setTick(n => n + 1) : undefined} />}{loading && <LoadingState label="Cargando evaluaciones…" />}
  <form className="form-panel" onSubmit={compare}><fieldset className="scrum-fieldset" disabled={busy}>
   <div className="scrum-grid">{[['A', a, setA, da, setDa], ['B', b, setB, db, setDb]].map(([label, id, set, dates, setDates]) => <section key={label}><h2>Evaluación {label}</h2>
    <label>Plan {label}<select aria-label={`Plan ${label}`} required value={id} onChange={e => set(e.target.value)}><option value="">Selecciona un plan</option>{items.map(p => <option key={p.id} value={String(p.id)}>{p.nombre}</option>)}</select></label>
    <label>Desde {label}<input type="datetime-local" step="1" value={dates.desde || ''} onChange={e => { setDates(d => ({ ...d, desde: e.target.value })); setReport(null) }} /></label>
    <label>Hasta {label}<input type="datetime-local" step="1" value={dates.hasta || ''} onChange={e => { setDates(d => ({ ...d, hasta: e.target.value })); setReport(null) }} /></label>
   </section>)}</div><p>Horas del equipo: desde inclusive y hasta exclusivo, según el cierre de la sesión. Sin fechas se incluyen todas las sesiones elegibles del plan.</p>
   {current && <div className="scrum-table-wrap"><table><caption>Equivalencias explícitas uno a uno</caption><thead><tr><th scope="col">Tarea en A</th><th scope="col">Tarea equivalente en B</th></tr></thead><tbody>{current.ta.map(t => <tr key={t.id}><th scope="row">#{t.id} · {t.titulo}</th><td><select aria-label={`Equivalente para tarea #${t.id}`} value={mapping[t.id] || ''} onChange={e => { setMapping(m => ({ ...m, [t.id]: e.target.value })); setReport(null) }}><option value="">Sin equivalencia</option>{current.tb.map(u => <option key={u.id} value={String(u.id)} disabled={Object.entries(mapping).some(([id, v]) => id !== String(t.id) && v === String(u.id))}>#{u.id} · {u.titulo}</option>)}</select></td></tr>)}</tbody></table></div>}
   <button className="button button-primary" disabled={!current || loading}>Comparar evaluaciones</button>
  </fieldset></form><ComparisonResults report={report} />
  {report?.agregado && <p><Link className="button button-primary" to={`/informes?plan_id=${a}`} state={{ comparison: { a: scope(a, da), b: scope(b, db), equivalencias: Object.entries(mapping).filter(([, v]) => v).map(([tarea_a, tarea_b]) => ({ tarea_a, tarea_b })) } }}>Usar esta comparación en informe</Link></p>}
 </div>
}
