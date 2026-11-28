import { useEffect, useState } from 'react'
import { scrum } from '../services/scrum.js'
export default function useProductSprint(planId, sprintId, load = scrum.obtener) {
 const [data, setData] = useState(null), [members, setMembers] = useState([]), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState(''), [tick, setTick] = useState(0)
 const key = `${planId}/${sprintId}`
 useEffect(() => {
  let active = true; setLoading(true); setError(''); setMessage('')
  if (!planId || !sprintId) { setData(null); setError('Selecciona un plan y un sprint desde la planificación.'); setLoading(false); return }
  Promise.all([load(planId, sprintId), scrum.responsables(planId)]).then(([s, m]) => { if (active) { setData({ ...s, contextKey: key }); setMembers(m) } })
   .catch(e => { if (active) { setData(null); setError(e.message) } }).finally(() => { if (active) setLoading(false) })
  return () => { active = false }
 }, [planId, sprintId, key, tick, load])
 async function mutate(action, success = 'Cambio guardado.') {
  if (busy || !data || data.contextKey !== key) return false
  setBusy(true); setError(''); setMessage('')
  try { const s = await action(data); setData({ ...s, contextKey: key }); setMessage(success); return true }
  catch (e) { setError(`${e.message} Se conserva el último estado confirmado. Actualiza el sprint para comprobar el servidor antes de repetir.`); return false }
  finally { setBusy(false) }
 }
 return { data: data?.contextKey === key ? data : null, members, loading, busy, error, message, mutate, reload: () => setTick(n => n + 1) }
}
