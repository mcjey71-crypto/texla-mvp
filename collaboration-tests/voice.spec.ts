import {test,expect,type Page} from '@playwright/test';
import {writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const wav=join(tmpdir(),'texla-voice-test.wav');
test.use({permissions:['microphone'],launchOptions:{executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',`--use-file-for-fake-audio-capture=${wav}`]}});
test.beforeAll(()=>{const samples=48000*4;const bytes=Buffer.alloc(44+samples*2);bytes.write('RIFF');bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(48000,24);bytes.writeUInt32LE(96000,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(samples*2,40);for(let i=0;i<samples;i++)bytes.writeInt16LE(Math.round(10000*Math.sin(2*Math.PI*440*i/48000)),44+i*2);writeFileSync(wav,bytes);});
test.afterAll(()=>rmSync(wav,{force:true}));
async function probe(page:Page){await page.addInitScript(()=>{
 const state=(window as any).__voice={sent:0,streams:[] as MediaStream[],analysers:[] as AnalyserNode[]};
 const send=WebSocket.prototype.send;WebSocket.prototype.send=function(data){if(typeof data==='string'&&data.includes('"type":"voice:audio"'))state.sent++;return send.call(this,data);};
 const get=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async options=>{const stream=await get(options);state.streams.push(stream);return stream;};
 const gain=AudioContext.prototype.createGain;AudioContext.prototype.createGain=function(){const node=gain.call(this);const analyser=this.createAnalyser();node.connect(analyser);state.analysers.push(analyser);return node;};
 });}
async function energy(page:Page){return page.evaluate(()=>{let maximum=0;for(const analyser of (window as any).__voice.analysers as AnalyserNode[]){const data=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(data);maximum=Math.max(maximum,...data.map(Math.abs));}return maximum;});}
async function share(page:Page,name='Ana'){
 await page.goto('./');await page.getByRole('button',{name:'Compartir',exact:true}).click();await page.getByLabel('Tu nombre para colaborar').fill(name);await page.getByLabel('Servidor de colaboración').fill('http://127.0.0.1:8787');await page.getByRole('button',{name:'Crear enlace de edición',exact:true}).click();await expect(page.getByLabel('Enlace de edición')).toBeVisible();const link=await page.getByLabel('Enlace de edición').inputValue();await page.getByRole('button',{name:'Cerrar',exact:true}).click();await expect(page.locator('.collaboration-status')).toContainText('Guardado en el servidor');return link;
}
async function activate(page:Page){await page.getByRole('button',{name:'Activar walkie-talkie',exact:true}).click();await expect(page.getByRole('button',{name:'Mantener pulsado para hablar'})).toBeEnabled();}
test('real audio reaches another browser only while held, preserves editing, mutes and releases microphone',async({page,browser})=>{
 await probe(page);const link=await share(page);expect(await page.evaluate(()=>(window as any).__voice.streams.length)).toBe(0);
 const context=await browser.newContext({permissions:['microphone']});const guest=await context.newPage();await probe(guest);
 try{
  await guest.goto(link);await expect(guest.locator('.collaboration-status')).toContainText('Guardado en el servidor');await activate(page);await activate(guest);await expect(page.locator('.walkie-heading')).toContainText('2 en el canal');
  await expect(page.locator('.walkie-panel')).toHaveClass(/walkie-compact/);
  expect((await page.locator('.walkie-panel').boundingBox())!.height).toBeLessThan(85);
  await page.getByRole('button',{name:'Mostrar detalles del walkie-talkie'}).click();await expect(page.locator('.walkie-hint')).toBeVisible();
  await page.getByRole('button',{name:'Reducir walkie-talkie'}).click();await expect(page.locator('.walkie-hint')).toBeHidden();await expect(page.locator('.walkie-heading')).toContainText('2 en el canal');
  await page.waitForTimeout(300);expect(await page.evaluate(()=>(window as any).__voice.sent)).toBe(0);
  const button=page.getByRole('button',{name:'Mantener pulsado para hablar'});await button.hover();await page.mouse.down();await expect(page.locator('.walkie-status')).toContainText('Tu micrófono está transmitiendo');await expect(guest.locator('.walkie-status')).toContainText('Ana está hablando');await expect(guest.getByRole('button',{name:'Mantener pulsado para hablar'})).toBeDisabled();
  await expect.poll(()=>energy(guest)).toBeGreaterThan(.01);expect(await energy(page)).toBeLessThan(.001);
  await page.locator('.tiptap').evaluate(el=>(el as any).editor.commands.insertContentAt((el as any).editor.state.doc.content.size,{type:'paragraph',content:[{type:'text',text:'Texto durante la transmisión.'}]}));await expect(guest.locator('.tiptap')).toContainText('Texto durante la transmisión.');
  await guest.getByRole('button',{name:'Silenciar sonido del walkie-talkie'}).click();await expect.poll(()=>energy(guest)).toBeLessThan(.001);await guest.getByRole('button',{name:'Activar sonido del walkie-talkie'}).click();await expect.poll(()=>energy(guest)).toBeGreaterThan(.01);
  await page.mouse.up();await expect(guest.locator('.walkie-status')).toContainText('Canal libre');const sent=await page.evaluate(()=>(window as any).__voice.sent);await page.waitForTimeout(400);expect(await page.evaluate(()=>(window as any).__voice.sent)).toBe(sent);await expect.poll(()=>energy(guest)).toBeLessThan(.001);
  await page.getByRole('button',{name:'Despejar pantalla',exact:true}).click();await expect(button).toBeVisible();await button.focus();await page.keyboard.down('Space');await expect(page.locator('.walkie-status')).toContainText('transmitiendo');await page.keyboard.up('Space');await expect(page.locator('.walkie-status')).toContainText('Canal libre');
  await button.hover();await page.mouse.down();await expect(page.locator('.walkie-status')).toContainText('transmitiendo');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await expect(page.locator('.walkie-status')).toContainText('Canal libre');await page.mouse.up();
  await page.getByRole('button',{name:'Desactivar walkie-talkie',exact:true}).click();expect(await page.evaluate(()=>(window as any).__voice.streams.every((stream:MediaStream)=>stream.getTracks().every(track=>track.readyState==='ended')))).toBe(true);
  await expect(guest.locator('.walkie-heading')).toContainText('1 en el canal');await guest.evaluate(()=>window.dispatchEvent(new Event('offline')));await expect(guest.getByRole('button',{name:'Activar walkie-talkie',exact:true})).toBeVisible();expect(await guest.evaluate(()=>(window as any).__voice.streams.every((stream:MediaStream)=>stream.getTracks().every(track=>track.readyState==='ended')))).toBe(true);
  const stored=await page.evaluate(()=>localStorage.getItem('texla-docs-v1'));expect(stored).not.toContain('voice:audio');expect(stored).not.toContain('voiceTurn');
 }finally{await context.close();}
});
test('microphone denial leaves editing available; mobile control fits',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.addInitScript(()=>{navigator.mediaDevices.getUserMedia=()=>Promise.reject(new DOMException('Denied','NotAllowedError'));});await share(page);await page.getByRole('button',{name:'Activar walkie-talkie',exact:true}).click();await expect(page.locator('.walkie-error')).toContainText('Permite el micrófono');await expect(page.getByRole('button',{name:'Activar walkie-talkie',exact:true})).toBeEnabled();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);await page.locator('.tiptap p').last().click();await page.keyboard.type('Edición disponible sin micrófono.');await expect(page.locator('.tiptap')).toContainText('Edición disponible sin micrófono.');
});
test('server enforces exclusive turns, membership, leases and ephemeral audio',async({page})=>{
 const link=await share(page);const access=JSON.parse(decodeURIComponent(new URL(link).hash.slice(7)));
 const result=await page.evaluate(async access=>{
  const wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
  async function until(check:()=>boolean,label:string){const deadline=Date.now()+5000;while(!check()){if(Date.now()>deadline)throw new Error('Timed out waiting for '+label);await wait(20);}}
  async function peer(){return await new Promise<{ws:WebSocket;messages:any[];id:string;initial:any}>((resolve,reject)=>{
   const ws=new WebSocket(access.server.replace('http','ws')+'/rooms/'+access.room+'/socket');const messages:any[]=[];
   const timeout=setTimeout(()=>{ws.close();reject(new Error('Audio test socket did not authenticate'));},5000);
   ws.onopen=()=>ws.send(JSON.stringify({type:'auth',token:access.token,clientId:Math.floor(Math.random()*10000000)}));
   ws.onerror=()=>{clearTimeout(timeout);reject(new Error('Audio test socket failed'));};ws.onclose=event=>{clearTimeout(timeout);reject(new Error('Audio test socket closed before sync: '+event.code));};
   ws.onmessage=e=>{if(e.data==='pong'){messages.push('pong');return;}const m=JSON.parse(e.data);messages.push(m);if(m.type==='sync'){clearTimeout(timeout);resolve({ws,messages,id:m.voicePeer,initial:m});}};
  });}
  const a=await peer(),b=await peer(),observer=await peer();const send=(p:typeof a,m:any)=>p.ws.send(JSON.stringify(m));const state=(p:typeof a)=>p.messages.filter(m=>m.type==='voice:state').at(-1);
  try{
   send(a,{type:'voice:join',name:'A'});send(b,{type:'voice:join',name:'B'});await until(()=>state(a)?.peers.length===2&&state(b)?.peers.length===2,'both voice participants');
   send(a,{type:'voice:take',turn:crypto.randomUUID()});send(b,{type:'voice:take',turn:crypto.randomUUID()});await until(()=>!!state(a)?.floor&&!!state(b)?.floor,'exclusive turn');
   const floor=state(a).floor;const leader=floor.peer===a.id?a:b;const listener=leader===a?b:a;const turn=floor.turn;
   const raw=new Uint8Array(3200);for(let i=0;i<raw.length;i++)raw[i]=i%255;const data=btoa(String.fromCharCode(...raw));
   send(listener,{type:'voice:audio',turn,data});send(leader,{type:'voice:audio',turn,data});await until(()=>listener.messages.some(m=>m.type==='voice:audio'),'authorized audio');
   const spoofed=leader.messages.filter(m=>m.type==='voice:audio').length;const delivered=listener.messages.filter(m=>m.type==='voice:audio').length;const observed=observer.messages.filter(m=>m.type==='voice:audio').length;
   send(leader,{type:'voice:audio',turn,data:'bad'});leader.ws.send('ping');await until(()=>leader.messages.includes('pong'),'editing transport after malformed audio');const healthy=true;
   const reload=await peer();const unchanged=reload.initial.state===a.initial.state;reload.ws.close();
   await until(()=>state(listener)?.floor===null,'expired voice lease');send(listener,{type:'voice:take',turn:crypto.randomUUID()});await until(()=>state(listener)?.floor?.peer===listener.id,'new turn after expiration');const recovered=true;
   send(listener,{type:'voice:leave'});await until(()=>state(leader)?.floor===null,'turn released on leave');const released=true;
   const abuser=await peer();const rateCode=await new Promise<number>((resolve,reject)=>{
    // Sustain an excessive rate rather than assume one batch lands in a single wall-clock second.
    const burst=()=>{if(abuser.ws.readyState===WebSocket.OPEN)for(let i=0;i<80;i++)send(abuser,{type:'voice:join',name:'Rate test'});};
    const interval=setInterval(burst,100);const timeout=setTimeout(()=>{clearInterval(interval);abuser.ws.close();reject(new Error('Server did not close sustained excessive audio traffic'));},5000);
    abuser.ws.onclose=event=>{clearInterval(interval);clearTimeout(timeout);resolve(event.code);};burst();
   });
   return {rateCode,oneSpeaker:[a.id,b.id].includes(floor.peer),spoofed,delivered,observed,healthy,unchanged,recovered,released};
  }finally{a.ws.close();b.ws.close();observer.ws.close();}
 },access);
 expect(result).toEqual({rateCode:4008,oneSpeaker:true,spoofed:0,delivered:1,observed:0,healthy:true,unchanged:true,recovered:true,released:true});
});
test('cancelling a delayed microphone prompt stops any late stream and keeps the channel off',async({page})=>{
 await probe(page);await page.addInitScript(()=>{const get=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async constraints=>{await new Promise<void>(resolve=>{(window as any).__resolveMicrophone=resolve;});return get(constraints);};});await share(page);await page.getByRole('button',{name:'Activar walkie-talkie',exact:true}).click();await expect(page.getByRole('button',{name:'Cancelar audio',exact:true})).toBeVisible();await expect.poll(()=>page.evaluate(()=>typeof(window as any).__resolveMicrophone)).toBe('function');await page.getByRole('button',{name:'Cancelar audio',exact:true}).click();await page.evaluate(()=>(window as any).__resolveMicrophone());await expect.poll(()=>page.evaluate(()=>(window as any).__voice.streams.length)).toBe(1);await expect.poll(()=>page.evaluate(()=>(window as any).__voice.streams.every((stream:MediaStream)=>stream.getTracks().every(track=>track.readyState==='ended')))).toBe(true);await expect(page.getByRole('button',{name:'Activar walkie-talkie',exact:true})).toBeVisible();expect(await page.evaluate(()=>(window as any).__voice.sent)).toBe(0);
});
test('separate documents cannot hear one another and a held turn ends after thirty seconds',async({page,browser})=>{
 await probe(page);await share(page);await activate(page);const otherContext=await browser.newContext({permissions:['microphone']});const other=await otherContext.newPage();await probe(other);
 try{await share(other,'Otro documento');await activate(other);const button=page.getByRole('button',{name:'Mantener pulsado para hablar'});await button.hover();await page.mouse.down();await expect(page.locator('.walkie-status')).toContainText('transmitiendo');await page.waitForTimeout(500);await expect(other.locator('.walkie-status')).toContainText('Canal libre');expect(await energy(other)).toBeLessThan(.001);await expect(page.locator('.walkie-status')).toContainText('Canal libre',{timeout:35000});expect(await page.evaluate(()=>(window as any).__voice.streams.every((stream:MediaStream)=>stream.getAudioTracks().every(track=>!track.enabled)))).toBe(true);await page.mouse.up();await expect(button).toBeEnabled();await page.screenshot({path:'/tmp/texla-walkie-desktop.png'});await page.setViewportSize({width:390,height:844});await page.waitForTimeout(350);await page.screenshot({path:'/tmp/texla-walkie-mobile.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);}finally{await otherContext.close();}
});
