import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import PageHeader from '../components/PageHeader.jsx'
import PlanPicker from '../components/PlanPicker.jsx'
import FindingEditor from '../components/review/FindingEditor.jsx'
import PrivacyEditor from '../components/review/PrivacyEditor.jsx'
import { ErrorState, LoadingState } from '../components/UiState.jsx'
import { revision } from '../services/revision.js'
import { analysisNotice, ESTADOS_HALLAZGO } from '../domain/revision.js'

export default function ReviewPage() {
  const [params, setParams] = useSearchParams(), planId = params.get('plan_id') || '', analysisId = params.get('analisis_id') || '', findingId = params.get('hallazgo_id') || ''
  const [context, setContext] = useState(null), [loading, setLoading] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [tick, setTick] = useState(0), [message, setMessage] = useState(''), [storyId, setStoryId] = useState(null), [selected, setSelected] = useState([])
  const [privacyDirty, setPrivacyDirty] = useState(false)
  const requestId = useRef(crypto.randomUUID())
  const changePlan = useCallback(value => { setParams({ plan_id: value }); setMessage(''); setStoryId(null) }, [setParams])
  function selectParam(name, value) { setParams(old => { const next = new URLSearchParams(old); value ? next.set(name, value) : next.delete(name); return next }) }
  useEffect(() => { setSelected([]); requestId.current = crypto.randomUUID() }, [planId])
  useEffect(() => { setPrivacyDirty(false) }, [planId, analysisId])
  useEffect(() => {
    if (!planId) { setContext(null); return undefined }
    let active = true; setLoading(true); setError('')
    Promise.all([revision.observaciones(planId), revision.analisis(planId), revision.hallazgos(planId), analysisId ? revision.consultar(planId, analysisId) : Promise.resolve(null)])
      .then(([observaciones, analisis, hallazgos, analysis]) => { if (active) setContext({ planId, observaciones, analisis, hallazgos, analysis }) })
      .catch(reason => { if (active) { setContext(null); setError(reason.message) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [planId, analysisId, tick])
  const current = context?.planId === planId ? context : null, analysis = current?.analysis
  const finding = current?.hallazgos.find(h => String(h.id) === findingId)
  function changed(text, story = null) { setMessage(text); setStoryId(story); setTick(n => n + 1) }
  async function prepare() {
    setBusy(true); setError(''); setMessage('')
    try {
      const created = await revision.preparar(planId, { solicitud_id: requestId.current, resultado_ids: [...selected] })
      selectParam('analisis_id', created.id); setTick(n => n + 1)
      setMessage('Selección preparada. Revisa la privacidad antes de enviar a Gemini.')
    } catch (reason) { setError(reason.message) } finally { setBusy(false) }
  }
  async function refreshAnalysis() {
    try {
      const data = await revision.consultar(planId, analysisId)
      setContext(old => old?.planId === planId ? { ...old, analysis: data } : old)
    } catch (reason) { setError(reason.message) }
  }
  async function execute(retry = false) {
    setBusy(true); setError(''); setMessage('')
    try {
      const data = await revision.ejecutar(planId, analysisId, retry)
      setContext(old => ({ ...old, analysis: data })); setTick(n => n + 1)
      setMessage(data.estado === 'parcial' ? 'Se completó una parte. Consulta los grupos fallidos.' : 'Análisis terminado. Importa y revisa los borradores válidos.')
    } catch (reason) {
      setError(`${reason.message} Se consultará el diario antes de permitir otro envío.`)
      await refreshAnalysis()
    } finally { setBusy(false) }
  }
  async function importFindings() {
    setBusy(true); setError('')
    try {
      const data = await revision.importar(planId, analysisId)
      if (data.hallazgos.length) selectParam('hallazgo_id', data.hallazgos[0].id)
      changed(data.aviso || `Importación completada: ${data.hallazgos.length} borradores recuperados. Repetirla no duplica hallazgos.`)
    } catch (reason) { setError(reason.message) } finally { setBusy(false) }
  }
  function toggle(resultId) {
    setSelected(old => old.includes(resultId) ? old.filter(id => id !== resultId) : [...old, resultId])
    requestId.current = crypto.randomUUID()
  }
  const demo = analysis?.grupos.some(g => g.meta?.modo === 'demo')
  return <div className="review-workspace">
    <PageHeader eyebrow="HU-06 / HU-07" title="Revisión humana de sugerencias" description="Contrasta observaciones y propuestas de IA. Edita y decide antes de incorporar una historia al backlog." />
    <PlanPicker value={planId} onChange={changePlan} disabled={busy} />
    {message && <div className="notice" role="status">{message} {storyId && <Link to={`/historias/${storyId}?plan_id=${planId}`}>Ver historia #{storyId}</Link>}</div>}
    {error && <ErrorState message={error} onRetry={() => setTick(n => n + 1)} />}
    {loading && <LoadingState label="Cargando fuentes y revisión…" />}
    {!loading && current && <>
      <section className="form-panel" aria-label="Preparación del análisis">
        <h2>1. Seleccionar observaciones</h2><p>Solo sesiones cerradas, con consentimiento y evaluación registrada. Máximo 100 observaciones por análisis.</p>
        {!current.observaciones.length ? <p>No hay observaciones elegibles en este plan.</p> : <>
          <div className="review-source-list">{current.observaciones.map(o => <label className="review-checkbox" key={o.resultado_id}>
            <input type="checkbox" checked={selected.includes(o.resultado_id)} disabled={busy || (!selected.includes(o.resultado_id) && selected.length >= 100)} onChange={() => toggle(o.resultado_id)} />
            <span><strong>Resultado #{o.resultado_id} · {o.titulo_tarea}</strong><span className="preserve-text" style={{ display: 'block' }}>{o.observacion_original}</span></span>
          </label>)}</div>
          <p role="status">{selected.length} seleccionadas</p><button className="button button-primary" disabled={busy || !selected.length} onClick={prepare}>Preparar análisis</button>
        </>}
      </section>
      <section className="form-panel" aria-label="Ejecución y recuperación del análisis">
        <h2>2. Analizar e importar borradores</h2>
        <label htmlFor="review-analysis">Análisis del plan</label><select id="review-analysis" value={analysisId} disabled={busy} onChange={e => selectParam('analisis_id', e.target.value)}>
          <option value="">Selecciona un análisis</option>{current.analisis.map(a => <option key={a.id} value={a.id}>#{a.id} · {a.estado}</option>)}
        </select>
        {analysis && <>
          <p className="notice" role="status">{analysisNotice(analysis)}</p>
          <ul className="review-group-list">{analysis.grupos.map(g => <li key={g.id}>Grupo {g.id}: <strong>{g.estado}</strong> · intentos {g.intentos}/{analysis.max_intentos}
            {g.error && <span> · {g.error.code}: {g.error.message}</span>}</li>)}</ul>
          <div className="form-actions review-actions">
            <button className="button button-outline" onClick={refreshAnalysis}>Actualizar estado</button>
            {analysis.estado === 'pendiente' && <button className="button button-primary" disabled={busy || privacyDirty || !analysis.revision_en} onClick={() => execute()}>Ejecutar análisis</button>}
            {analysis.grupos.some(g => g.reintentable) && <button className="button button-outline" disabled={busy} onClick={() => execute(true)}>Reintentar grupos fallidos</button>}
            {['completado', 'parcial'].includes(analysis.estado) && <button className="button button-primary" disabled={busy || demo} onClick={importFindings}>Importar borradores válidos</button>}
          </div>
          {busy && <p role="status">Operación en curso. Puedes consultar el estado sin duplicar el envío.</p>}
          {privacyDirty && <p role="status">Hay cambios de privacidad sin guardar. Guárdalos antes de ejecutar.</p>}
          {analysis.estado === 'pendiente' && <PrivacyEditor key={`${analysis.id}-${analysis.revision_en || ''}`} planId={planId} analysis={analysis} disabled={busy} onDirty={setPrivacyDirty} onBusy={setBusy}
            onSaved={data => { setContext(old => ({ ...old, analysis: data })); setMessage('Revisión de privacidad guardada. Ya puedes ejecutar el análisis.') }} />}
        </>}
      </section>
      <section className="form-panel" aria-label="Lista de hallazgos"><div className="review-title-row"><h2>3. Revisar hallazgos</h2>
        <button className="button button-outline" disabled={busy} onClick={() => setTick(n => n + 1)}>Actualizar hallazgos</button></div>
        {!current.hallazgos.length ? <p>No hay hallazgos importados. Un análisis sin hallazgos no genera propuestas artificiales.</p> : <ul className="finding-list">
          {current.hallazgos.map(h => <li key={h.id}><Link aria-current={String(h.id) === findingId ? 'true' : undefined}
            to={`?plan_id=${planId}${analysisId ? `&analisis_id=${analysisId}` : ''}&hallazgo_id=${h.id}`}>
            #{h.id} · {h.resumen} — {ESTADOS_HALLAZGO[h.estado]}</Link></li>)}</ul>}
      </section>
      {finding && <FindingEditor key={`${planId}-${finding.id}-${finding.version}`} planId={planId} finding={finding} onChanged={changed} onBusy={setBusy} disabled={busy} />}
      {findingId && !finding && <p role="alert">El hallazgo seleccionado no está disponible en este plan.</p>}
    </>}
  </div>
}
