const labels = { sin_ayuda: 'Éxito sin ayuda', con_ayuda: 'Éxito con ayuda', no_completado: 'No completado' }
const value = (v, unit = '') => v == null ? 'Sin datos' : `${v}${unit}`
function Measures({ a, b, variacion }) {
 return <div className="scrum-table-wrap"><p>A: {a.evaluados}/{a.esperados} evaluados ({value(a.cobertura_porcentaje, '%')}). B: {b.evaluados}/{b.esperados} evaluados ({value(b.cobertura_porcentaje, '%')}).</p>
  <table><caption>Resultados por categoría; variación B − A</caption><thead><tr><th scope="col">Resultado</th><th scope="col">Éxito A / B</th><th scope="col">Variación</th><th scope="col">Tiempo A / B</th><th scope="col">Variación tiempo</th><th scope="col">Errores A / B</th><th scope="col">Variación errores</th></tr></thead><tbody>
   {Object.entries(labels).map(([k, label]) => <tr key={k}><th scope="row">{label}</th><td>{value(a.por_resultado[k].porcentaje, '%')} / {value(b.por_resultado[k].porcentaje, '%')}<small className="scrum-help">n: {a.por_resultado[k].cantidad} / {b.por_resultado[k].cantidad}</small></td><td>{value(variacion?.[k]?.porcentaje_pp, ' pp')}</td>
    <td>{value(a.por_resultado[k].tiempo.promedio_segundos, ' s')} / {value(b.por_resultado[k].tiempo.promedio_segundos, ' s')}<small className="scrum-help">n: {a.por_resultado[k].tiempo.n} / {b.por_resultado[k].tiempo.n}</small></td><td>{value(variacion?.[k]?.tiempo_segundos, ' s')}</td>
    <td>{value(a.por_resultado[k].errores.promedio)} / {value(b.por_resultado[k].errores.promedio)}<small className="scrum-help">n: {a.por_resultado[k].errores.n} / {b.por_resultado[k].errores.n}</small></td><td>{value(variacion?.[k]?.errores_promedio)}</td></tr>)}
  </tbody></table></div>
}
export default function ComparisonResults({ report }) {
 if (!report) return null
 return <section className="form-panel" aria-label="Resultado de comparación"><h2>Comparación de evaluaciones</h2>
  {report.avisos.map((v, i) => <p role="status" className="notice" key={i}>{v}</p>)}
  {report.agregado && <section><h3>Agregado de tareas comparables</h3><Measures {...report.agregado} /></section>}
  {report.pares.map((pair, i) => <section key={i}><h3>#{pair.a.tarea_id} {pair.a.titulo} ↔ #{pair.b.tarea_id} {pair.b.titulo}</h3>{!pair.comparable && <p>Par excluido del agregado por falta de evaluaciones en uno o ambos lados.</p>}<Measures {...pair} /></section>)}
  <h3>Tareas sin equivalencia, excluidas del agregado</h3><p>A: {report.excluidas.a.map(t => `#${t.tarea_id} ${t.titulo}`).join('; ') || 'Ninguna'}</p><p>B: {report.excluidas.b.map(t => `#${t.tarea_id} ${t.titulo}`).join('; ') || 'Ninguna'}</p>
 </section>
}
