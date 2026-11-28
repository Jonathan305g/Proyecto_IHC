import { useCallback, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import PageHeader from '../components/PageHeader.jsx'
import PlanPicker from '../components/PlanPicker.jsx'
import { ErrorState } from '../components/UiState.jsx'
import { prepareReport, downloadReport } from '../services/reports.js'
const localDate = iso => { if (!iso) return ''; const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19) }
export default function ReportsPage() {
 const location = useLocation(), initial = location.state?.comparison, [params, setParams] = useSearchParams(), p = params.get('plan_id') || initial?.a?.plan_id || ''
 const [comparison, setComparison] = useState(initial || null), [dates, setDates] = useState({ desde: localDate(initial?.a?.desde), hasta: localDate(initial?.a?.hasta) }), [sections, setSections] = useState(initial ? ['resultados', 'hallazgos', 'historias', 'comparacion'] : ['resultados', 'hallazgos', 'historias'])
 const [preview, setPreview] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('')
 const invalidate = () => { setPreview(null); setMessage(''); setError('') }
 const changePlan = useCallback(value => { setParams({ plan_id: value }); setPreview(null); setComparison(null); setSections(s => s.filter(v => v !== 'comparacion')); setMessage(''); setError('') }, [setParams])
 async function prepare(e) {
  e.preventDefault(); setBusy(true); setError(''); setMessage(''); setPreview(null)
  try { setPreview(await prepareReport({ plan_id: p, ...Object.fromEntries(Object.entries(dates).filter(([, v]) => v).map(([k, v]) => [k, new Date(v).toISOString()])), secciones: sections, ...(sections.includes('comparacion') ? { comparacion: comparison } : {}) })) }
  catch (e) { setError(e.message) } finally { setBusy(false) }
 }
 async function download(format) { setBusy(true); setError(''); try { const name = await downloadReport(preview.reporte_id, format); setMessage(`Descarga preparada: ${name}`) } catch (e) { setError(e.message) } finally { setBusy(false) } }
 return <div className="scrum-workspace"><PageHeader eyebrow="HU-11 / S4-07" title="Exportar informe" description="Prepara una vista previa y descarga el mismo contenido en Markdown o PDF." />
  <PlanPicker value={p} onChange={changePlan} disabled={busy} />
  {error && <ErrorState message={error} />}{message && <p role="status" className="notice">{message}</p>}
  <form className="form-panel" onSubmit={prepare}><fieldset className="scrum-fieldset" disabled={busy}>
   <div className="scrum-grid">{['desde', 'hasta'].map(k => <label key={k}>{k === 'desde' ? 'Desde (inclusive)' : 'Hasta (exclusivo)'}<input type="datetime-local" step="1" value={dates[k]} onChange={e => { setDates(d => ({ ...d, [k]: e.target.value })); setComparison(null); setSections(s => s.filter(v => v !== 'comparacion')); invalidate() }} /></label>)}</div>
   <p>Se usan las horas de tu equipo y la fecha de cierre de cada sesión. Solo se incluyen historias vinculadas a hallazgos aprobados dentro del alcance completo de sus observaciones de origen.</p>
   <fieldset className="scrum-fieldset"><legend>Secciones del informe</legend>{Object.entries({ resultados: 'Resultados', hallazgos: 'Hallazgos aprobados', historias: 'Historias aprobadas', comparacion: 'Comparación seleccionada' }).map(([k, label]) => <label key={k}><input type="checkbox" checked={sections.includes(k)} disabled={k === 'comparacion' && !comparison} onChange={e => { setSections(s => e.target.checked ? [...s, k] : s.filter(v => v !== k)); invalidate() }} />{label}</label>)}</fieldset>
   <p><Link to="/comparacion">Preparar una comparación e incorporarla al informe</Link></p>
   <button className="button button-primary" disabled={!p || !sections.length}>Preparar vista previa</button>
  </fieldset></form>
  {preview && <section className="form-panel" aria-label="Vista previa del informe"><h2>{preview.documento.titulo}</h2><p>Vista previa disponible durante diez minutos. Ambas descargas conservan esta instantánea.</p>
   <div className="form-actions"><button className="button button-primary" disabled={busy} onClick={() => download('markdown')}>Descargar Markdown</button><button className="button button-primary" disabled={busy} onClick={() => download('pdf')}>Descargar PDF</button></div>
   {preview.documento.bloques.map((b, i) => b.tipo === 'titulo' ? <h3 key={i}>{b.texto}</h3> : b.tipo === 'texto' ? <p key={i} style={{ whiteSpace: 'pre-wrap' }}>{b.texto}</p> : <div className="scrum-table-wrap" key={i}><table><caption>Tabla del informe {i + 1}</caption><thead><tr>{b.columnas.map((h, j) => <th scope="col" key={j}>{h}</th>)}</tr></thead><tbody>{b.filas.map((r, j) => <tr key={j}>{r.map((c, k) => k === 0 ? <th scope="row" key={k}>{c}</th> : <td key={k}>{c}</td>)}</tr>)}</tbody></table></div>)}
  </section>}
 </div>
}
