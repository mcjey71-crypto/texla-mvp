import { test, expect, type BrowserContext } from '@playwright/test';
const alice = '00000000-0000-4000-8000-000000000001';
const bob = '00000000-0000-4000-8000-000000000002';
type Row = {id:string;owner_id:string;title:string;version:number;size_bytes:number;updated_at:string;payload:any};
const rows = new Map<string, Row>();
const images=new Map<string,Buffer>();
const session = (id:string) => ({access_token:`${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:id,exp:Math.floor(Date.now()/1000)+3600,aud:'authenticated',role:'authenticated'})).toString('base64url')}.test`,refresh_token:'test-refresh',token_type:'bearer',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,user:{id,aud:'authenticated',role:'authenticated',email:id===alice?'ana@example.com':'luis@example.com',app_metadata:{provider:'google'},user_metadata:{},created_at:new Date().toISOString()}});
async function setup(context:BrowserContext,id?:string) {
  if(id) await context.addInitScript(value => localStorage.setItem('sb-texla-test-auth-token',JSON.stringify(value)),session(id));
  await context.route('https://texla-test.supabase.co/**',async route=>{
    const req=route.request(),url=new URL(req.url());const json=(data:unknown,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
    if(url.pathname.startsWith('/storage/v1/object/public/texla-images/')){const bytes=images.get(url.pathname.slice('/storage/v1/object/public/texla-images/'.length));return bytes?route.fulfill({contentType:'application/octet-stream',body:bytes}):json({message:'Not found'},404);}
    if(url.pathname==='/auth/v1/settings')return json({external:{google:true,email:true}});
    if(url.pathname==='/auth/v1/otp')return json({});
    if(url.pathname==='/auth/v1/logout')return route.fulfill({status:204});
    if(url.pathname==='/auth/v1/user')return json(session(id!).user);
    let uid='';try{uid=JSON.parse(Buffer.from((req.headers().authorization||'').split('.')[1],'base64url').toString()).sub;}catch{}
    if(!uid)return json({message:'Authentication required'},401);
    if(url.pathname.startsWith('/storage/v1/object/texla-images/')&&req.method()==='POST'){const path=url.pathname.slice('/storage/v1/object/texla-images/'.length);if(!path.startsWith(uid+'/'))return json({message:'policy violation'},403);if(images.has(path))return json({statusCode:'409',message:'The resource already exists'},409);images.set(path,req.postDataBuffer()!);return json({Key:'texla-images/'+path});}
    if(url.pathname==='/rest/v1/rpc/save_texla_document'){
      const body=req.postDataJSON();const old=rows.get(body.p_id);
      if(old&&(old.owner_id!==uid||old.version!==body.p_expected_version)||!old&&body.p_expected_version!==0)return json({code:'40001',message:'Conflict'},409);
      const row:Row={id:body.p_id,owner_id:uid,title:body.p_payload.document.title,payload:body.p_payload,version:(old?.version||0)+1,size_bytes:JSON.stringify(body.p_payload).length,updated_at:new Date().toISOString()};rows.set(row.id,row);return json({version:row.version});
    }
    if(url.pathname==='/rest/v1/texla_documents'){
      const key=url.searchParams.get('id')?.replace('eq.','');
      if(req.method()==='DELETE'){const old=rows.get(key!);if(old?.owner_id===uid&&old.version===Number(url.searchParams.get('version')?.replace('eq.',''))){rows.delete(key!);return json([{id:key}]);}return json([]);}
      if(key){const row=rows.get(key);return row?.owner_id===uid?json(row):json({code:'PGRST116'},406);}
      return json([...rows.values()].filter(row=>row.owner_id===uid).map(({payload,...row})=>row));
    }
    return json({message:'Unhandled test route'},404);
  });
}
async function create(page:import('@playwright/test').Page,name:string){await page.getByRole('button',{name:'Nuevo documento'}).click();await page.getByPlaceholder('Mi próxima gran idea').fill(name);await page.getByRole('button',{name:'Crear documento',exact:true}).click();await page.locator('.tiptap p').last().click();await page.keyboard.type('Contenido privado de la cuenta.');await expect(page.locator('.save-status')).toContainText('Guardado en tu cuenta');}
test.beforeEach(()=>{rows.clear();images.clear();});

test('Google and email login options are available, use PKCE and preserve local work',async({page,context})=>{
  await setup(context);await page.goto('/');await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await expect(page.getByRole('button',{name:'Continuar con Google'})).toBeVisible();
  await page.getByLabel('Tu correo electrónico').fill('ana@example.com');const request=page.waitForRequest(r=>r.url().includes('/auth/v1/otp'));await page.getByRole('button',{name:'Enviarme enlace para entrar'}).click();const req=await request;expect(req.postDataJSON().email).toBe('ana@example.com');expect(req.postDataJSON().code_challenge).toBeTruthy();await expect(page.getByRole('status')).toContainText('Revisa tu correo');
  await page.route('https://texla-test.supabase.co/auth/v1/authorize**',route=>route.fulfill({contentType:'text/html',body:'Google test redirect'}));const google=page.waitForRequest(r=>r.url().includes('/auth/v1/authorize'));await page.getByRole('button',{name:'Continuar con Google'}).click();const url=new URL((await google).url());expect(url.searchParams.get('provider')).toBe('google');expect(url.searchParams.get('redirect_to')).toBe('http://127.0.0.1:5176/');expect(url.searchParams.get('code_challenge')).toBeTruthy();
});
test('private documents autosave, open on another device and stay out of a different account',async({browser,page,context})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await setup(context,alice);await page.goto('/');await create(page,'Tesis privada');
  const other=await browser.newContext();await setup(other,alice);const second=await other.newPage();await second.goto('/');await second.getByRole('button',{name:'Mi cuenta',exact:true}).click();await second.getByRole('button',{name:/^Tesis privada/}).click();await expect(second.locator('.tiptap')).toContainText('Contenido privado de la cuenta.');
  const stranger=await browser.newContext();await setup(stranger,bob);const third=await stranger.newPage();await third.goto('/');await third.getByRole('button',{name:'Mi cuenta',exact:true}).click();await expect(third.locator('.account-library')).not.toContainText('Tesis privada');
  await page.getByRole('button',{name:'Mi cuenta',exact:true}).click();await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await expect(page.getByRole('button',{name:'Iniciar sesión',exact:true})).toBeVisible();await expect(page.locator('.document-list')).not.toContainText('Tesis privada');
  expect(errors).toEqual([]);await other.close();await stranger.close();
});
test('conflicting writes preserve local edits and can be saved as a separate document',async({browser,page,context})=>{
  await setup(context,alice);await page.goto('/');await create(page,'Investigación');
  const other=await browser.newContext();await setup(other,alice);const second=await other.newPage();await second.goto('/');await second.getByRole('button',{name:'Mi cuenta',exact:true}).click();await second.getByRole('button',{name:/^Investigación/}).click();
  await page.getByLabel('Nombre del documento').fill('Versión del primer dispositivo');await expect(page.locator('.save-status')).toContainText('Guardado en tu cuenta');
  await second.getByLabel('Nombre del documento').fill('Mi aporte pendiente');await expect(second.getByRole('alert')).toContainText('cambió en otro dispositivo');await expect(second.getByLabel('Nombre del documento')).toHaveValue('Mi aporte pendiente');
  await second.getByRole('button',{name:'Guardar mis cambios como otro documento'}).click();await expect(second.locator('.save-status')).toContainText('Guardado en tu cuenta');expect([...rows.values()].map(row=>row.title)).toEqual(expect.arrayContaining(['Versión del primer dispositivo','Mi aporte pendiente (mi copia)']));await other.close();
});
test('missing schema shows an activation message and never claims cloud persistence',async({page,context})=>{
  await setup(context,alice);await context.route('https://texla-test.supabase.co/rest/v1/**',route=>route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({code:'PGRST202',message:'schema missing'})}));await page.goto('/');await page.getByRole('button',{name:'Nuevo documento'}).click();await page.getByPlaceholder('Mi próxima gran idea').fill('Borrador seguro');await page.getByRole('button',{name:'Crear documento',exact:true}).click();await expect(page.getByRole('alert')).toContainText('script SQL');await expect(page.locator('.save-status')).not.toContainText('Guardado en tu cuenta');await expect(page.locator('.tiptap')).toContainText('Borrador seguro');
});
test('cloud deletion keeps the open device copy and works on mobile',async({page,context})=>{
  await setup(context,alice);await page.goto('/');await create(page,'Documento descartable');await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Mi cuenta',exact:true}).click();await page.getByRole('button',{name:'Eliminar de la nube: Documento descartable'}).click();await page.getByRole('button',{name:'Confirmar eliminación'}).click();await expect(page.locator('.account-library')).not.toContainText('Documento descartable');await page.getByRole('button',{name:'Cerrar',exact:true}).click();await expect(page.locator('.tiptap')).toContainText('Contenido privado de la cuenta.');expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);expect(rows.size).toBe(0);
});
test('import uploads only after review and honors the local-only choice and cloud size limit',async({page,context})=>{
  await setup(context,alice);await page.goto('/');
  const open=()=>page.locator('.document-tools').getByRole('button',{name:'Importar documento'}).click();
  const convert=async(name:string,content:string)=>{await page.getByLabel('Archivo para importar').setInputFiles({name,mimeType:'text/plain',buffer:Buffer.from(content)});await page.getByRole('button',{name:'Convertir documento',exact:true}).click();await expect(page.getByText('Conversión preparada',{exact:true})).toBeVisible();};
  await open();await convert('importado.txt','Investigación privada importada.');expect(rows.size).toBe(0);
  await expect(page.getByLabel('Guardar también en mi cuenta')).toBeChecked();await page.getByRole('button',{name:'Crear documento editable'}).click();await expect(page.locator('.save-status')).toContainText('Guardado en tu cuenta');expect(rows.size).toBe(1);
  await open();await convert('local.txt','Contenido solo para este navegador.');await page.getByLabel('Guardar también en mi cuenta').uncheck();await page.getByRole('button',{name:'Crear documento editable'}).click();await expect(page.locator('.save-status')).toContainText('Guardado en este navegador');expect(rows.size).toBe(1);
  await open();await convert('extenso.txt','é'.repeat(550000));await expect(page.getByLabel('Guardar también en mi cuenta')).toBeDisabled();await expect(page.locator('.import-limit')).toContainText('Supera 1 MiB');expect(rows.size).toBe(1);
});

test('sharing a saved document preserves its account row and reopens the same collaboration on a second device',async({browser,page,context})=>{
 await setup(context,alice);await page.goto('/');await create(page,'Una sola tesis');const id=[...rows.keys()][0];
 const count=await page.locator('.document-list>button').count();
 await page.getByRole('button',{name:'Compartir',exact:true}).click();await page.getByLabel('Servidor de colaboración').fill('http://127.0.0.1:8790');await page.getByRole('button',{name:'Crear enlace de edición'}).click();await expect(page.getByLabel('Enlace de edición')).toBeVisible();await page.getByRole('button',{name:'Cerrar',exact:true}).click();await expect(page.locator('.collaboration-status')).toContainText('Guardado en el servidor');await expect(page.locator('.document-list>button')).toHaveCount(count);
 await expect.poll(()=>rows.get(id)?.payload.collaboration?.room).toBeTruthy();expect(rows.size).toBe(1);
 const secondContext=await browser.newContext();await setup(secondContext,alice);const second=await secondContext.newPage();
 try{
  await second.goto('/');await second.getByRole('button',{name:'Mi cuenta',exact:true}).click();await second.getByRole('button',{name:/^Una sola tesis/}).click();await expect(second.locator('.collaboration-status')).toContainText('Guardado en el servidor');await expect(second.locator('.tiptap')).toContainText('Contenido privado de la cuenta.');
  await second.getByLabel('Tipografía',{exact:true}).selectOption('Times New Roman');await expect(page.getByLabel('Tipografía',{exact:true})).toHaveValue('Times New Roman');
  await second.locator('.tiptap').evaluate(el=>{const editor=(el as HTMLElement&{editor:import('@tiptap/core').Editor}).editor;editor.commands.insertContentAt(editor.state.doc.content.size,{type:'paragraph',content:[{type:'text',text:'Aporte desde otro dispositivo.'}]});});await expect(page.locator('.tiptap')).toContainText('Aporte desde otro dispositivo.');await expect.poll(()=>JSON.stringify(rows.get(id)?.payload.document.content)).toContain('Aporte desde otro dispositivo.');expect(rows.size).toBe(1);
  await page.getByRole('button',{name:'Compartir',exact:true}).click();await page.getByRole('button',{name:'Dejar de compartir',exact:true}).click();await page.getByRole('button',{name:'Confirmar: dejar de compartir'}).click();await expect(page.locator('.collaboration-status')).toHaveCount(0);await expect.poll(()=>rows.get(id)?.payload.collaboration).toBeUndefined();await expect(page.locator('.save-status')).toContainText('Guardado en tu cuenta');await expect(page.locator('.document-list>button')).toHaveCount(count);expect([...rows.keys()]).toEqual([id]);
 } finally {await secondContext.close();}
});

test('delete waits for an in-flight autosave and removes the account and device document without recreating it',async({page,context})=>{
 await setup(context,alice);let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});let held=true;
 await context.route('https://texla-test.supabase.co/rest/v1/rpc/save_texla_document',async route=>{if(held){held=false;await gate;}await route.fallback();});
 await page.goto('/');await page.getByRole('button',{name:'Nuevo documento'}).click();await page.getByPlaceholder('Mi próxima gran idea').fill('Borrar durante guardado');const saving=page.waitForRequest(request=>request.url().includes('/rpc/save_texla_document'));await page.getByRole('button',{name:'Crear documento',exact:true}).click();const id=(await saving).postDataJSON().p_id;
 await page.getByRole('button',{name:'Borrar documento',exact:true}).click();await page.getByRole('button',{name:'Confirmar: borrar documento'}).click();await expect(page.getByRole('button',{name:'Borrando…',exact:true})).toBeDisabled();await expect(page.getByRole('dialog').getByRole('button',{name:'Cerrar',exact:true})).toBeDisabled();
 release();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('.document-list')).not.toContainText('Borrar durante guardado');expect(rows.has(id)).toBe(false);await page.waitForTimeout(2200);expect(rows.has(id)).toBe(false);await page.reload();await expect(page.locator('.document-list')).not.toContainText('Borrar durante guardado');
});
test('failed account deletion keeps the document available for retry',async({page,context})=>{
 await setup(context,alice);await page.goto('/');await create(page,'Conservar si falla');
 await context.route('https://texla-test.supabase.co/rest/v1/texla_documents**',route=>route.request().method()==='DELETE'?route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Unavailable'})}):route.fallback());
 await page.getByRole('button',{name:'Borrar documento',exact:true}).click();await page.getByRole('button',{name:'Confirmar: borrar documento'}).click();await expect(page.getByRole('dialog').getByRole('alert')).toContainText('No se pudo completar');expect(rows.size).toBe(1);await page.getByRole('button',{name:'Cancelar',exact:true}).click();await expect(page.locator('.tiptap')).toContainText('Contenido privado de la cuenta.');
});

async function chooseImage(page:import('@playwright/test').Page){
 const png=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=600;canvas.height=240;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#486243';ctx.fillRect(0,0,600,240);return canvas.toDataURL('image/png').split(',')[1];});
 await page.getByRole('button',{name:'Imagen',exact:true}).click();await page.getByLabel('Archivo de imagen').setInputFiles({name:'proyecto.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await expect(page.getByAltText('Vista previa de la imagen')).toBeVisible();await page.getByLabel('Pie de figura',{exact:true}).fill('Esquema del proyecto');
}
test('encrypted images survive cloud reopening and are visible to shared guests without exposing upload rights',async({page,context,browser})=>{
 await setup(context,alice);await page.goto('/');await create(page,'Proyecto ilustrado');const id=[...rows.keys()][0];
 await chooseImage(page);await page.getByRole('button',{name:'Insertar imagen',exact:true}).click();await expect(page.locator('.texla-figure img')).toBeVisible();await expect.poll(()=>JSON.stringify(rows.get(id)?.payload)).toContain('"remote"');
 expect(images.size).toBe(1);const encrypted=[...images.values()][0];expect([...encrypted.subarray(0,8)]).not.toEqual([137,80,78,71,13,10,26,10]);expect(JSON.stringify(rows.get(id)?.payload)).not.toContain('data:image');
 const secondContext=await browser.newContext();await setup(secondContext,alice);const second=await secondContext.newPage();const guestContext=await browser.newContext();await setup(guestContext);const guest=await guestContext.newPage();
 try{
  await second.goto('/');await second.getByRole('button',{name:'Mi cuenta',exact:true}).click();await second.getByRole('button',{name:/^Proyecto ilustrado/}).click();await expect(second.locator('.texla-figure img')).toBeVisible();expect(await second.locator('.texla-figure img').evaluate((el:HTMLImageElement)=>el.naturalWidth)).toBe(600);
  await page.getByRole('button',{name:'Compartir',exact:true}).click();await page.getByLabel('Servidor de colaboración').fill('http://127.0.0.1:8790');await page.getByRole('button',{name:'Crear enlace de edición'}).click();await expect(page.getByLabel('Enlace de edición')).toBeVisible();const link=await page.getByLabel('Enlace de edición').inputValue();await page.getByRole('button',{name:'Cerrar',exact:true}).click();
  await guest.goto(link);await expect(guest.locator('.texla-figure img')).toBeVisible();await expect(guest.locator('.collaboration-status')).toContainText('Guardado en el servidor');expect(await guest.locator('.texla-figure img').evaluate((el:HTMLImageElement)=>el.naturalWidth)).toBe(600);
  await guest.getByRole('button',{name:'Editar imagen',exact:true}).click();await guest.getByLabel('Pie de figura',{exact:true}).fill('Esquema revisado');await guest.getByRole('button',{name:'Guardar figura',exact:true}).click();await expect(page.locator('figcaption')).toContainText('Esquema revisado');
  await chooseImage(guest);await guest.getByRole('button',{name:'Insertar imagen',exact:true}).click();await expect(guest.getByRole('alert')).toContainText('Inicia sesión');expect(images.size).toBe(1);await expect(guest.locator('.texla-figure')).toHaveCount(1);await guest.getByRole('button',{name:'Cerrar',exact:true}).click();
  await page.getByRole('button',{name:'Compartir',exact:true}).click();await page.getByRole('button',{name:'Dejar de compartir',exact:true}).click();await page.getByRole('button',{name:'Confirmar: dejar de compartir'}).click();
 }finally{await secondContext.close();await guestContext.close();}
});
test('missing image bucket keeps the upload form and existing document intact, then retry succeeds',async({page,context})=>{
 await setup(context,alice);let missing=true;await context.route('https://texla-test.supabase.co/storage/v1/object/texla-images/**',route=>missing?route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({statusCode:'404',message:'Bucket not found'})}):route.fallback());await page.goto('/');await create(page,'Conservar contenido');await chooseImage(page);await page.getByRole('button',{name:'Insertar imagen',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Activa el almacenamiento');await expect(page.locator('.texla-figure')).toHaveCount(0);await expect(page.locator('.tiptap')).toContainText('Contenido privado');await expect(page.getByAltText('Vista previa de la imagen')).toBeVisible();missing=false;await page.getByRole('button',{name:'Insertar imagen',exact:true}).click();await expect(page.locator('.texla-figure img')).toBeVisible();expect(images.size).toBe(1);
});
