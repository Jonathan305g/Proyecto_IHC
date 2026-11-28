import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import PageHeader from '../components/PageHeader.jsx'
import { ErrorState, LoadingState } from '../components/UiState.jsx'
import { revision } from '../services/revision.js'
export default function StoryDetailPage() {
  const { id } = useParams(), [params] = useSearchParams(), planId = params.get('plan_id') || ''
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState(''), [tick, setTick] = useState(0)
  useEffect(() => {
    let active = true; setData(null); setLoading(true); setError('')
    if (!planId) { setError('Falta el plan de la historia.'); setLoading(false); return undefined }
    revision.historia(planId, id).then(row => { if (active) setData(row) }).catch(reason => { if (active) setError(reason.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [planId, id, tick])
  return <>
    <PageHeader eyebrow="HU-07 / HU-08" title={`Historia #${id}`} description="Consulta la historia guardada y su trazabilidad." />
    {loading && <LoadingState />}{error && <ErrorState message={error} onRetry={() => setTick(n => n + 1)} />}
    {data && <article className="form-panel story-detail">
      <h2>{data.titulo}</h2><p className="preserve-text">{data.descripcion}</p><h3>Criterio de aceptación</h3><p className="preserve-text">{data.criterio_aceptacion || 'Sin criterio registrado (historia legada).'}</p>
      <p>Prioridad: {data.prioridad} · Puntos: {data.puntos ?? 'Sin estimar'} · Estado: {data.estado} · Orden: {data.orden}</p>
      <p><Link className="button button-outline" to={`/backlog?plan_id=${planId}&historia_id=${id}`}>Localizar en el backlog</Link></p>
      {data.hallazgo ? <><h3>Hallazgo de origen #{data.hallazgo.id}</h3><p>{data.hallazgo.resumen}</p>
        {data.hallazgo.observaciones.map(o => <section key={o.resultado_id} className="review-source"><strong>Resultado #{o.resultado_id} · {o.tarea_titulo}</strong><p className="preserve-text">{o.texto_original}</p></section>)}
        <Link className="button button-outline" to={`/revision?plan_id=${planId}&hallazgo_id=${data.hallazgo.id}`}>Consultar revisión de origen</Link>
      </> : <p>Origen: creación manual.</p>}
    </article>}
  </>
}
