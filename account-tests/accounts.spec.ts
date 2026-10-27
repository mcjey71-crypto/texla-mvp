import { test, expect, type BrowserContext } from '@playwright/test';
const alice = '00000000-0000-4000-8000-000000000001';
const bob = '00000000-0000-4000-8000-000000000002';
type Row = {id:string;owner_id:string;title:string;version:number;size_bytes:number;updated_at:string;payload:any};
const rows = new Map<string, Row>();
const session = (id:string) => ({access_token:`${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:id,exp:Math.floor(Date.now()/1000)+3600,aud:'authenticated',role:'authenticated'})).toString('base64url')}.test`,refresh_token:'test-refresh',token_type:'bearer',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,user:{id,aud:'authenticated',role:'authenticated',email:id===alice?'ana@example.com':'luis@example.com',app_metadata:{provider:'google'},user_metadata:{},created_at:new Date().toISOString()}});
async function setup(context:BrowserContext,id?:string) {
  if(id) await context.addInitScript(value => localStorage.setItem('sb-texla-test-auth-token',JSON.stringify(value)),session(id));
  await context.route('https://texla-test.supabase.co/**',async route=>{
    const req=route.request(),url=new URL(req.url());const json=(data:unknown,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
    if(url.pathname==='/auth/v1/settings')return json({external:{google:true,email:true}});
    if(url.pathname==='/auth/v1/otp')return json({});
    if(url.pathname==='/auth/v1/logout')return route.fulfill({status:204});
    if(url.pathname==='/auth/v1/user')return json(session(id!).user);
    let uid='';try{uid=JSON.parse(Buffer.from((req.headers().authorization||'').split('.')[1],'base64url').toString()).sub;}catch{}
    if(!uid)return json({message:'Authentication required'},401);
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
test.beforeEach(()=>rows.clear());

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
