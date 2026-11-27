import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import PageHeader from '../components/PageHeader.jsx'
import PlanPicker from '../components/PlanPicker.jsx'
import StoryForm from '../components/StoryForm.jsx'
import { ErrorState, LoadingState } from '../components/UiState.jsx'
import { backlog } from '../services/backlog.js'
import { ESTADOS_HISTORIA, moveStory } from '../domain/backlog.js'

export default function BacklogPage() {
  const [params, setParams] = useSearchParams(), planId = params.get('plan_id') || '', stateFilter = params.get('estado') || '', priorityFilter = params.get('prioridad') || ''
  const [data, setData] = useState(null), [loading, setLoading] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [tick, setTick] = useState(0), [message, setMessage] = useState(''), [savedId, setSavedId] = useState(null), [editing, setEditing] = useState(null), [creating, setCreating] = useState(false)
  const filtered = Boolean(stateFilter || priorityFilter), filterKey = `${planId}/${stateFilter}/${priorityFilter}`, formOpen = Boolean(editing || creating)
  const changePlan = useCallback(value => { setParams({ plan_id: value }); setMessage(''); setSavedId(null); setEditing(null); setCreating(false) }, [setParams])
  function filter(key, value) {
    setParams(old => { const next = new URLSearchParams(old); value ? next.set(key, value) : next.delete(key); return next })
    setMessage('')
  }
  useEffect(() => {
    if (!planId) { setData(null); return undefined }
    let active = true; setLoading(true); setError('')
    backlog.listar(planId, { estado: stateFilter, prioridad: priorityFilter }).then(result => { if (active) setData({ ...result, filterKey }) })
      .catch(reason => { if (active) { setData(null); setError(reason.message) } }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [planId, stateFilter, priorityFilter, filterKey, tick])
  const current = data?.filterKey === filterKey ? data : null
  async function save(body) {
    setBusy(true); setError(''); setMessage('')
    try {
      const result = editing ? await backlog.editar(planId, editing.id, body) : await backlog.crear(planId, body)
      setEditing(null); setCreating(false); setSavedId(result.id); setMessage(`Historia #${result.id} guardada.`); setTick(n => n + 1)
    } catch (reason) { setError(`${reason.message} El formulario conserva tus datos. Si hay un conflicto de versión, cancela la edición y actualiza el backlog.`) }
    finally { setBusy(false) }
  }
  async function move(id, direction) {
    if (!current || filtered || busy || formOpen) return
    setBusy(true); setError(''); setMessage('')
    try {
      await backlog.ordenar(planId, { version_orden: current.version_orden, historia_ids: moveStory(current.historias, id, direction) })
      setMessage('Orden guardado. Se conservará al recargar.'); setTick(n => n + 1)
    } catch (reason) { setError(`${reason.message} Actualiza el backlog antes de intentar otro movimiento.`) }
    finally { setBusy(false) }
  }
  return <div className="backlog-workspace">
    <PageHeader eyebrow="HU-08 / S3-10" title="Backlog de mejoras" description="Crea historias, consulta su origen y acuerda prioridades, puntos y orden de trabajo." />
    <PlanPicker value={planId} onChange={changePlan} disabled={busy || formOpen} />
    <section className="form-panel" aria-label="Filtros del backlog">
      <div className="backlog-toolbar">
        <div><label htmlFor="backlog-state">Filtrar por estado</label><select id="backlog-state" value={stateFilter} disabled={busy || formOpen} onChange={e => filter('estado', e.target.value)}>
          <option value="">Todos los estados</option>{Object.entries(ESTADOS_HISTORIA).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></div>
        <div><label htmlFor="backlog-priority">Filtrar por prioridad</label><select id="backlog-priority" value={priorityFilter} disabled={busy || formOpen} onChange={e => filter('prioridad', e.target.value)}>
          <option value="">Todas las prioridades</option>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}{n === 1 ? ' · Más alta' : ''}</option>)}</select></div>
        <button className="button button-outline" disabled={busy || formOpen || !filtered} onClick={() => setParams({ plan_id: planId })}>Restablecer filtros</button>
        <button className="button button-outline" disabled={busy || formOpen || !planId} onClick={() => setTick(n => n + 1)}>Actualizar backlog</button>
        <button className="button button-primary" disabled={busy || formOpen || !planId} onClick={() => { setCreating(true); setError(''); setMessage('') }}>Nueva historia</button>
      </div>
      <p className="field-hint">Prioridad 1 es la más alta. El orden de trabajo se cambia con Subir y Bajar, y se guarda por plan.</p>
      {filtered && <p className="notice" role="status">Filtros activos: se conservan en la URL al recargar. Restablécelos para cambiar el orden completo.</p>}
      {formOpen && <p role="status">Guarda o cancela la historia antes de cambiar de plan o filtros.</p>}
    </section>
    {message && <p role="status" className="notice">{message} {savedId && <Link to={`/historias/${savedId}?plan_id=${planId}`}>Ver historia #{savedId}</Link>}</p>}
    {error && <ErrorState message={error} onRetry={!busy && !formOpen ? () => setTick(n => n + 1) : undefined} />}
    {formOpen && <StoryForm key={editing ? `${editing.id}-${editing.version}` : 'new'} story={editing} busy={busy} onSave={save} onCancel={() => { setEditing(null); setCreating(false) }} />}
    {loading && <LoadingState label="Cargando backlog…" />}
    {!loading && current && <section className="form-panel" aria-label="Historias del backlog">
      <h2>{current.historias.length} historias {filtered ? 'coincidentes' : 'en el plan'}</h2>
      {!current.historias.length ? <p>{filtered ? 'No hay historias que coincidan con estos filtros.' : 'El backlog está vacío. Crea una historia manual o aprueba una sugerencia desde Revisión de IA.'}</p>
        : <div className="backlog-table-wrap"><table className="backlog-table"><thead><tr>
          <th scope="col">Orden</th><th scope="col">Historia</th><th scope="col">Prioridad</th><th scope="col">Puntos</th><th scope="col">Estado</th><th scope="col">Origen</th><th scope="col">Acciones</th>
        </tr></thead><tbody>{current.historias.map((s, index) => <tr key={s.id} data-testid={`historia-${s.id}`} className={String(s.id) === (savedId || params.get('historia_id')) ? 'highlight-story' : undefined}>
          <td>{s.orden}</td><th scope="row"><Link to={`/historias/${s.id}?plan_id=${planId}`}>#{s.id} · {s.titulo}</Link></th>
          <td>{s.prioridad}</td><td>{s.puntos ?? 'Sin estimar'}</td><td>{ESTADOS_HISTORIA[s.estado]}</td>
          <td>{s.hallazgo_id ? <Link to={`/revision?plan_id=${planId}&hallazgo_id=${s.hallazgo_id}`}>Hallazgo #{s.hallazgo_id}</Link> : 'Manual'}</td>
          <td><div className="backlog-row-actions">
            <button className="button button-outline button-sm" disabled={busy || formOpen} aria-label={`Editar historia #${s.id}`} onClick={() => { setEditing(s); setCreating(false); setError('') }}>Editar</button>
            <button className="button button-outline button-sm" disabled={busy || formOpen || filtered || index === 0} aria-label={`Subir historia #${s.id}`} onClick={() => move(s.id, -1)}>↑ Subir</button>
            <button className="button button-outline button-sm" disabled={busy || formOpen || filtered || index === current.historias.length - 1} aria-label={`Bajar historia #${s.id}`} onClick={() => move(s.id, 1)}>↓ Bajar</button>
          </div></td>
        </tr>)}</tbody></table></div>}
      <p><Link to={`/revision?plan_id=${planId}`}>Revisar sugerencias de IA de este plan</Link></p>
    </section>}
  </div>
}
