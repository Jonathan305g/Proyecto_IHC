import { useEffect, useState } from 'react'
import { plans } from '../services/persistence.js'
import { ErrorState } from './UiState.jsx'
export default function PlanPicker({ value, onChange, disabled = false }) {
  const [items, setItems] = useState([]), [error, setError] = useState(''), [loading, setLoading] = useState(true), [tick, setTick] = useState(0)
  useEffect(() => {
    let active = true; setLoading(true); setError('')
    plans.list().then(data => { if (active) setItems(data || []) }).catch(e => { if (active) setError(e.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [tick])
  useEffect(() => { if (!value && items.length) onChange(String(items[0].id)) }, [value, items, onChange])
  return <section className="form-panel review-plan-picker">
    <label htmlFor="review-plan">Plan de prueba</label>
    <select id="review-plan" value={value} disabled={disabled || loading || !items.length} onChange={e => onChange(e.target.value)}>
      {!value && <option value="">Selecciona un plan</option>}
      {items.map(p => <option key={p.id} value={String(p.id)}>{p.nombre}</option>)}
    </select>
    {loading && <p role="status">Cargando planes…</p>}
    {!loading && !error && !items.length && <p>No hay planes. Crea uno para continuar.</p>}
    {error && <ErrorState message={error} onRetry={() => setTick(n => n + 1)} />}
  </section>
}
