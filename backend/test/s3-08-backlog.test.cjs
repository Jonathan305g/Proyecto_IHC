require('reflect-metadata')
const { test }=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs/promises')
const path=require('node:path')
const { randomUUID }=require('node:crypto')
const { PGlite }=require('@electric-sql/pglite')
const { createApplication }=require('../dist/application')
const { DatabaseService }=require('../dist/database.service')
const { AuthGuard }=require('../dist/auth.guard')
const { ProveedorIA }=require('../dist/analisis-ia/proveedor')
const { BacklogService }=require('../dist/backlog/backlog.service')

test('S3-08: HTTP privado, revision atomica, origen N:M e historias persistentes',async t=>{
 const keys=['DATABASE_URL','SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','AUTH_ALLOWED_EMAILS']
 const saved=keys.map(k=>process.env[k]);Object.assign(process.env,{DATABASE_URL:'postgres://test:test@127.0.0.1:1/test',
  SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'test',AUTH_ALLOWED_EMAILS:'equipo@example.com'})
 const pg=new PGlite();let app
 try {
  await pg.exec(await fs.readFile(path.join(__dirname,'../../database/01_esquema.sql'),'utf8'))
  await pg.exec(await fs.readFile(path.join(__dirname,'../migrations/20261118000000_s3_07_ejecuciones_ia.sql'),'utf8'))
  await pg.exec(`INSERT INTO public.planes(id,nombre,objetivo) OVERRIDING SYSTEM VALUE VALUES(101,'Revision','Probar'),(202,'Otro','Aislar');
   INSERT INTO public.tareas(id,plan_id,titulo,descripcion,orden) OVERRIDING SYSTEM VALUE VALUES(10,101,'Guardar','Guardar cambios',1),(20,202,'Buscar','Buscar',1);
   INSERT INTO public.participantes(id,codigo) OVERRIDING SYSTEM VALUE VALUES(1,'S308-ANONIMO');
   INSERT INTO public.sesiones(id,plan_id,participante_id,estado,consentimiento_confirmado,iniciada_en,cerrada_en)
    OVERRIDING SYSTEM VALUE VALUES(1,101,1,'cerrada',true,'2026-11-01T10:00Z','2026-11-01T11:00Z'),
    (2,202,1,'cerrada',true,'2026-11-01T10:00Z','2026-11-01T11:00Z'),(3,101,1,'cerrada',false,'2026-11-01T10:00Z','2026-11-01T11:00Z'),
    (4,101,1,'cerrada',true,'2026-11-01T10:00Z','2026-11-01T11:00Z');
   INSERT INTO public.resultados(id,plan_id,sesion_id,tarea_id,completada,observaciones) OVERRIDING SYSTEM VALUE
    VALUES(1,101,1,10,true,'La confirmacion no fue visible.'),(2,202,2,20,true,'Otro plan'),
    (3,101,3,10,true,'Sin consentimiento'),(9007199254740993,101,4,10,true,'Requirio ayuda.');`)
  await pg.exec(`INSERT INTO public.analisis_ia(plan_id) VALUES(101);
   INSERT INTO public.hallazgos(plan_id,analisis_id,resultado_id,resumen,sugerencia,estado) VALUES(101,1,1,'Legado','Conservar','aprobado');
   INSERT INTO public.historias(hallazgo_id,titulo,descripcion) VALUES(1,'Historia anterior','No borrar');`)
  const migration=await fs.readFile(path.join(__dirname,'../migrations/20261127000000_s3_08_hallazgos_historias.sql'),'utf8')
  await pg.exec(migration);await pg.exec(migration)
  app=await createApplication(false)
  let email='equipo@example.com',failInsert=false
  app.get(AuthGuard).client={auth:{getUser:async token=>token==='valid'?{data:{user:{email,email_confirmed_at:'2026-01-01'}}}:{data:{},error:Error('expired')}}}
  const convert=r=>({rows:r.rows.map(row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k,typeof v==='bigint'?String(v):v]))),rowCount:r.affectedRows})
  const db=app.get(DatabaseService)
  const query=async (client,sql,args=[])=>{
   if(failInsert && sql.includes('INSERT INTO public.historias')) throw Error('Fallo privado de escritura')
   return convert(await client.query(sql,args))
  }
  db.query=(sql,args)=>query(pg,sql,args)
  db.transaction=op=>pg.transaction(tx=>op({query:(sql,args)=>query(tx,sql,args)}))
  const actualProvider=new ProveedorIA({IA_MODE:'gemini',GEMINI_API_KEY:'clave-test',IA_MODEL:'gemini-test'},async(_,options)=>{
   const req=JSON.parse(JSON.parse(options.body).contents[0].parts[0].text)
   return new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({version:'1.0',estado:'borrador',
    hallazgos:[{observacion_ids:req.observaciones.map(o=>o.id),resumen:'Confirmacion invisible',categoria:'retroalimentacion',severidad:'media',mejora_sugerida:'Mostrar confirmacion persistente'}],observaciones_sin_hallazgo:[]})}]}}]}))
  })
  app.get(ProveedorIA).analizar=input=>actualProvider.analizar(input)
  await app.listen(0,'127.0.0.1');const base=`${await app.getUrl()}/api/planes`
  const send=async(route,method='GET',body,token='valid',plan='101')=>{
   const res=await fetch(`${base}/${plan}/${route}`,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})})
   return {status:res.status,body:await res.json()}
  }
  const generar=async()=>{
   const created=await send('analisis-ia','POST',{solicitud_id:randomUUID(),resultado_ids:['1','9007199254740993']})
   assert.equal(created.status,201,JSON.stringify(created.body));const a=created.body
   const obs=a.grupos.flatMap(g=>g.solicitud.observaciones.map(o=>({resultado_id:o.id.slice(10),texto:o.texto,titulo_tarea:o.tarea.titulo,criterio_exito:o.tarea.criterio_exito})))
   assert.equal((await send(`analisis-ia/${a.id}/revision`,'PUT',{observaciones:obs})).status,200)
   assert.equal((await send(`analisis-ia/${a.id}/ejecutar`,'POST',{})).status,200)
   return a.id
  }
  const draft=h=>({version:h.version,resumen:h.resumen,categoria:h.categoria,severidad:h.severidad,mejora_sugerida:h.mejora_sugerida,criterio_aceptacion:h.criterio_aceptacion})
  const nueva=extra=>({solicitud_id:randomUUID(),titulo:'Mejora manual',descripcion:'Facilitar la tarea',criterio_aceptacion:'El mensaje es visible al guardar.',prioridad:2,puntos:3,...extra})
  let aid,hallazgo,story,second
  await t.test('migracion repetible conserva legado, origen y RLS',async()=>{
   const old=(await send('historias/1')).body
   assert.equal(old.titulo,'Historia anterior');assert.equal(old.plan_id,'101');assert.equal(old.hallazgo.observaciones[0].resultado_id,'1')
   assert.equal((await pg.query("SELECT relrowsecurity FROM pg_class WHERE oid='public.hallazgo_observaciones'::regclass")).rows[0].relrowsecurity,true)
  })
  await t.test('todas las rutas nuevas exigen autenticacion y equipo autorizado',async()=>{
   const routes=[['observaciones-ia','GET'],['analisis-ia','GET'],['analisis-ia/1/hallazgos','POST',{}],['hallazgos','GET'],
    ['hallazgos/1','GET'],['hallazgos/1','PUT',{}],['hallazgos/1/aprobar','POST',{}],['hallazgos/1/descartar','POST',{}],
    ['historias','GET'],['historias','POST',{}],['historias/orden','PUT',{}],['historias/1','GET'],['historias/1','PATCH',{}]]
   for(const [r,m,b] of routes) {assert.equal((await send(r,m,b,null)).status,401);email='ajeno@example.com';assert.equal((await send(r,m,b)).status,403);email='equipo@example.com'}
  })
  await t.test('observaciones elegibles conservan BIGINT exacto y excluyen otro plan y sin consentimiento',async()=>{
   assert.deepEqual((await send('observaciones-ia')).body.map(o=>o.resultado_id),['1','9007199254740993'])
   assert.equal((await send('observaciones-ia','GET',undefined,'valid','999')).status,404)
  })
  await t.test('S3-07 a S3-08: importar conserva N:M y sigue pendiente sin crear historia',async()=>{
   aid=await generar();const r=await send(`analisis-ia/${aid}/hallazgos`,'POST',{})
   assert.equal(r.status,200,JSON.stringify(r.body));hallazgo=r.body.hallazgos[0]
   assert.equal(hallazgo.estado,'pendiente');assert.equal(hallazgo.historia_id,null);assert.equal(hallazgo.propuesta_ia.resumen,'Confirmacion invisible')
   assert.deepEqual(hallazgo.observaciones.map(o=>o.resultado_id),['1','9007199254740993'])
   assert.equal(hallazgo.observaciones[0].texto_original,'La confirmacion no fue visible.')
   assert.equal((await send('analisis-ia')).body.some(a=>a.id===aid),true)
  })
  await t.test('reimportar no duplica ni sobrescribe el borrador editado',async()=>{
   let b=draft(hallazgo);b.resumen='Edicion humana';const saved=await send(`hallazgos/${hallazgo.id}`,'PUT',b)
   assert.equal(saved.status,200);hallazgo=saved.body
   const retry=await send(`analisis-ia/${aid}/hallazgos`,'POST',{})
   assert.equal(retry.body.hallazgos[0].id,hallazgo.id);assert.equal(retry.body.hallazgos[0].resumen,'Edicion humana')
   assert.equal((await pg.query('SELECT count(*)::int n FROM public.hallazgos WHERE analisis_id=$1',[aid])).rows[0].n,1)
  })
  await t.test('no aprobar sin criterio, campos invalidos ni version obsoleta',async()=>{
   assert.equal((await send(`hallazgos/${hallazgo.id}/aprobar`,'POST',{version:hallazgo.version,titulo:'Mejora'})).status,400)
   assert.equal((await send(`hallazgos/${hallazgo.id}`,'PUT',{...draft(hallazgo),version:1})).status,409)
   assert.equal((await send(`hallazgos/${hallazgo.id}`,'PUT',{...draft(hallazgo),categoria:'inventada'})).status,400)
   assert.equal((await send(`hallazgos/${hallazgo.id}`,'PUT',{...draft(hallazgo),estado:'aprobado'})).status,400)
   hallazgo=(await send(`hallazgos/${hallazgo.id}`,'PUT',{...draft(hallazgo),criterio_aceptacion:'Al guardar se muestra una confirmacion persistente.'})).body
  })
  await t.test('fallo al crear historia revierte tambien la aprobacion',async()=>{
   failInsert=true
   const r=await send(`hallazgos/${hallazgo.id}/aprobar`,'POST',{version:hallazgo.version,titulo:'Confirmar guardado'})
   failInsert=false;assert.equal(r.status,500);assert.equal(JSON.stringify(r.body).includes('Fallo privado'),false)
   assert.equal((await send(`hallazgos/${hallazgo.id}`)).body.estado,'pendiente')
  })
  await t.test('aprobar y repetir crea exactamente una historia y conserva origen despues de recargar',async()=>{
   const body={version:hallazgo.version,titulo:'Confirmar guardado',prioridad:1,puntos:5}
   const r=await send(`hallazgos/${hallazgo.id}/aprobar`,'POST',body);assert.equal(r.status,200,JSON.stringify(r.body))
   story=r.body.historia;assert.equal(r.body.hallazgo.estado,'aprobado');assert.equal(story.hallazgo_id,hallazgo.id)
   const retry=await send(`hallazgos/${hallazgo.id}/aprobar`,'POST',body)
   assert.equal(retry.body.historia.id,story.id);assert.equal(retry.body.reutilizada,true)
   const restarted=new BacklogService(db),loaded=await restarted.historia('101',story.id)
   assert.equal(loaded.hallazgo.observaciones.length,2);assert.equal(loaded.hallazgo.propuesta_ia.resumen,'Confirmacion invisible')
   assert.equal(loaded.hallazgo.resumen,'Edicion humana')
   assert.equal((await send(`hallazgos/${hallazgo.id}/descartar`,'POST',{version:retry.body.hallazgo.version,comentario:'No'})).status,409)
  })
  await t.test('descartar es explicito, persistente y no crea historia',async()=>{
   const a=await generar();const r=await send(`analisis-ia/${a}/hallazgos`,'POST',{});const h=r.body.hallazgos[0]
   const body={version:h.version,comentario:'No corresponde al objetivo.'}
   assert.equal((await send(`hallazgos/${h.id}/descartar`,'POST',body)).body.estado,'rechazado')
   assert.equal((await send(`hallazgos/${h.id}/descartar`,'POST',body)).status,200)
   assert.equal((await send(`hallazgos/${h.id}/aprobar`,'POST',{version:2,titulo:'No crear'})).status,409)
   assert.equal((await send('hallazgos?estado=rechazado')).body.some(x=>x.id===h.id),true)
  })
  await t.test('manual: UUID idempotente, edicion y filtros por prioridad y estado',async()=>{
   const body=nueva();const r=await send('historias','POST',body);assert.equal(r.status,201,JSON.stringify(r.body));second=r.body
   assert.equal(second.origen,'manual');assert.equal((await send('historias','POST',body)).body.id,second.id)
   assert.equal((await send('historias','POST',{...body,titulo:'Otra intencion'})).status,409)
   const edit=await send(`historias/${second.id}`,'PATCH',{version:second.version,prioridad:4,estado:'en_progreso',puntos:8})
   assert.equal(edit.status,200);second=edit.body
   assert.equal((await send(`historias/${second.id}`,'PATCH',{version:1,titulo:'Obsoleto'})).status,409)
   const list=(await send('historias?prioridad=4&estado=en_progreso')).body.historias
   assert.deepEqual(list.map(s=>s.id),[second.id])
  })
  await t.test('aislamiento por plan e IDs exactos en toda mutacion',async()=>{
   for(const [r,m,b] of [[`hallazgos/${hallazgo.id}`,'GET'],[`hallazgos/${hallazgo.id}`,'PUT',draft(hallazgo)],
    [`hallazgos/${hallazgo.id}/aprobar`,'POST',{version:1,titulo:'Otra'}],[`historias/${story.id}`,'GET'],
    [`historias/${story.id}`,'PATCH',{version:1,titulo:'Otra'}],[`analisis-ia/${aid}/hallazgos`,'POST',{}]])
    assert.equal((await send(r,m,b,'valid','202')).status,404)
   for(const bad of [nueva({prioridad:0}),nueva({puntos:-1}),nueva({estado:'aprobada'}),nueva({hallazgo_id:hallazgo.id}),nueva({plan_id:'202'}),nueva({criterio_aceptacion:''})])
    assert.equal((await send('historias','POST',bad)).status,400)
  })
  await t.test('orden completo persistente, rechaza filtros, duplicados y version antigua',async()=>{
   const list=(await send('historias')).body;const ids=list.historias.map(s=>s.id).reverse()
   assert.equal((await send('historias/orden','PUT',{version_orden:list.version_orden,historia_ids:[ids[0]]})).status,400)
   assert.equal((await send('historias/orden','PUT',{version_orden:list.version_orden,historia_ids:[ids[0],ids[0]]})).status,400)
   const body={version_orden:list.version_orden,historia_ids:ids}
   assert.equal((await send('historias/orden','PUT',body)).status,200)
   assert.equal((await send('historias/orden','PUT',body)).status,409)
   assert.deepEqual((await new BacklogService(db).historias('101')).historias.map(s=>s.id),ids)
  })
  await t.test('BD rechaza relaciones ajenas y crear historia desde hallazgo sin aprobar',async()=>{
   const a=await generar(),h=(await send(`analisis-ia/${a}/hallazgos`,'POST',{})).body.hallazgos[0]
   await assert.rejects(pg.query("INSERT INTO public.historias(plan_id,hallazgo_id,titulo,descripcion,orden) VALUES(101,$1,'X','X',99)",[h.id]))
   await assert.rejects(pg.query("INSERT INTO public.hallazgo_observaciones(hallazgo_id,plan_id,resultado_id,texto_original,texto_revisado,tarea_titulo) VALUES($1,101,2,'X','X','X')",[h.id]))
   await assert.rejects(pg.query("UPDATE public.hallazgos SET estado='rechazado' WHERE id=$1",[hallazgo.id]))
  })
  await t.test('demo y fuentes sin consentimiento no se importan como propuestas reales',async()=>{
   const a=await generar();await pg.query("UPDATE public.analisis_ia SET ejecucion=jsonb_set(ejecucion,'{grupos,0,meta,modo}','\"demo\"'::jsonb) WHERE id=$1",[a])
   assert.equal((await send(`analisis-ia/${a}/hallazgos`,'POST',{})).status,409)
   const b=await generar();await pg.query('UPDATE public.sesiones SET consentimiento_confirmado=false WHERE id=1')
   assert.equal((await send(`analisis-ia/${b}/hallazgos`,'POST',{})).status,409)
   await pg.query('UPDATE public.sesiones SET consentimiento_confirmado=true WHERE id=1')
  })
 } finally {
  if(app) await app.close();await pg.close();keys.forEach((k,i)=>saved[i]===undefined?delete process.env[k]:process.env[k]=saved[i])
 }
})
