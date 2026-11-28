async function cleanupSprint4(db, marker) {
 if (typeof marker !== 'string' || !/^VERIFICACION-S4-[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(marker)) throw Error('Marcador de comprobacion invalido')
 await db.transaction(async tx => {
  const names = [marker, marker + '-B']
  const plans = (await tx.query('SELECT id::text FROM public.planes WHERE nombre=ANY($1::text[]) FOR UPDATE', [names])).rows.map(p => p.id)
  if (plans.length > 2) throw Error('La seleccion no es univoca')
  if (plans.length) {
   for (const [table, where] of [['producto_sprint_tareas', 'plan_id'], ['producto_acuerdos', 'plan_id'], ['producto_cierres', 'sprint_id'], ['producto_sprint_eventos', 'sprint_id'], ['producto_sprint_historias', 'plan_id'], ['producto_sprints', 'plan_id'], ['producto_responsables', 'plan_id']]) {
    const clause = where === 'sprint_id' ? 'sprint_id IN(SELECT id FROM public.producto_sprints WHERE plan_id=ANY($1::bigint[]))' : 'plan_id=ANY($1::bigint[])'
    await tx.query(`DELETE FROM public.${table} WHERE ${clause}`, [plans])
   }
   for (const table of ['historias', 'hallazgo_observaciones', 'hallazgos', 'analisis_ia', 'resultados', 'sesiones']) await tx.query(`DELETE FROM public.${table} WHERE plan_id=ANY($1::bigint[])`, [plans])
   await tx.query('DELETE FROM public.planes WHERE id=ANY($1::bigint[]) AND nombre=ANY($2::text[])', [plans, names])
  }
  const codes = [1, 2].map(i => `S4-${marker.slice(-20)}-${i}`)
  await tx.query('DELETE FROM public.participantes WHERE codigo=ANY($1::text[]) AND NOT EXISTS(SELECT 1 FROM public.sesiones WHERE participante_id=public.participantes.id)', [codes])
 })
}
module.exports = { cleanupSprint4 }
