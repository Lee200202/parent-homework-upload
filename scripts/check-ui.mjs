import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {Window} from 'happy-dom';

const live=process.argv.includes('--live');
const endpoint='https://script.google.com/macros/s/AKfycbyCsgWlVlC1ORH8HuYKf19BrwykRSLlzBROE-Kxl_qXzzdH6ZiXnH8dldYAbdoQ4fifcg/exec';
async function remote(action,...args){const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:action==='getConfig'?'config':action,args}),signal:AbortSignal.timeout(90000)});const result=await r.json();if(!result.ok)throw new Error(result.error);return result.value}
const config={revision:0,serverNow:Date.now(),schoolDate:new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei'}).format(new Date()),maxBytes:10485760,chunkBytes:1048576,students:[{id:'huang-yun-xi',name:'黃雲晞',greetingName:'雲晞',course:'國二數學',publisher:'nanyi',publisherName:'南一版',termKey:'8-1',termLabel:'國二上',deadlines:{homework:new Date(Date.now()+86400000).toISOString(),exam:new Date(Date.now()+86400000).toISOString()},terms:[{key:'8-1',label:'國二上',chapters:[['平方根與畢氏定理',[['2-2','根式的運算'],['2-3','畢氏定理']]]]},{key:'8-2',label:'國二下',chapters:[['數列與等差級數',[['1-1','等差數列']]]]}]}]};
const calls=[];let memoryFiles=[],sessions=new Map();
async function mock(name,...args){calls.push({name,args});if(name==='getConfig')return config;if(name==='listUploads')return{files:memoryFiles,nextPageToken:null};if(name==='beginUpload'){const m=args[0];const state={requestId:m.requestId,offset:0,size:m.size,done:false,name:'國二上數學_黃雲晞_南一版_作業_2-2 根式的運算_電腦_驗收.pdf'};sessions.set(m.requestId,state);return state}if(name==='uploadChunk'){const state=sessions.get(args[0]);state.offset+=Buffer.from(args[2],'base64').length;state.done=state.offset===state.size;state.receipt='UI-PASS';return state}if(name==='getUploadStatus')return sessions.get(args[0]);throw new Error('Unexpected mock operation '+name)}
function rpcProxy(adapter,ok,fail){
 return new Proxy({}, {get(_,key){
  if(key==='withSuccessHandler')return handler=>rpcProxy(adapter,handler,fail);
  if(key==='withFailureHandler')return handler=>rpcProxy(adapter,ok,handler);
  return(...args)=>{Promise.resolve().then(()=>adapter(key,...JSON.parse(JSON.stringify(args)))).then(ok,fail)};
 }});
}
function page(file,adapter){const w=new Window({url:'https://upload.example/',settings:{enableJavaScriptEvaluation:true,suppressInsecureJavaScriptEnvironmentWarning:true}});w.Option=function(text,value){const option=w.document.createElement('option');option.text=text;option.value=value;return option};w.setInterval=()=>0;w.matchMedia=()=>({matches:false,addEventListener(){}});w.google={script:{run:rpcProxy(adapter)}};w.URL.createObjectURL=()=> 'blob:local-qa';w.URL.revokeObjectURL=()=>{};w.document.write(fs.readFileSync(new URL('../apps-script/'+file,import.meta.url),'utf8').replace(/<script>([\s\S]*?)<\/script>/g,''));const scripts=[...fs.readFileSync(new URL('../apps-script/'+file,import.meta.url),'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);w.eval(scripts.join('\n')+'\nwindow.qa={addFiles,replaceUpload,historyRender,get items(){return items},get busy(){return busy},get historyLoading(){return historyLoading},set historyFiles(v){historyFiles=v}};');return w}
async function waitFor(fn,label,limit=90000){const start=Date.now();while(!fn()){if(Date.now()-start>limit)throw new Error('Timeout: '+label);await new Promise(resolve=>setTimeout(resolve,100))}}
const window=page('Index.html',live?remote:mock);const $=id=>window.document.getElementById(id);
await waitFor(()=>$('student').value==='huang-yun-xi','load config');
assert.equal($('greeting').textContent,'雲晞你好');
assert.equal($('publisher-label').textContent,'南一版');
assert.ok($('content').textContent.includes('2-2 根式的運算'));
$('content').value='2-2';$('content').dispatchEvent(new window.Event('change'));
assert.match($('filename-preview').textContent,/國二上數學_黃雲晞_南一版_作業_2-2 根式的運算/);
$('view-switch').click();assert.equal(window.document.body.dataset.layout,'mobile');$('view-switch').click();assert.equal(window.document.body.dataset.layout,'desktop');
const custom=window.document.querySelector('input[name=category][value=custom]');custom.checked=true;custom.dispatchEvent(new window.Event('change'));assert.equal($('custom-category-field').hidden,false);assert.equal($('upload').disabled,true);$('custom-category').value='訂正';$('custom-category').dispatchEvent(new window.Event('input'));
$('content').value='custom';$('content').dispatchEvent(new window.Event('change'));assert.equal($('custom-content-field').hidden,false);$('custom-content').value='第一次段考';$('custom-content').dispatchEvent(new window.Event('input'));assert.match($('filename-preview').textContent,/訂正_第一次段考/);
window.document.querySelector('input[name=category][value=homework]').checked=true;$('content').value='2-2';$('content').dispatchEvent(new window.Event('change'));
const pdf=fs.readFileSync(new URL('../qa/驗收考卷.pdf',import.meta.url));window.testFile=new window.File([pdf],'家長原本的名字.pdf',{type:'application/pdf'});
await window.qa.addFiles([window.testFile]);assert.equal($('upload').disabled,false);assert.ok(!$('queue').textContent.includes('家長原本的名字'));
$('queue').querySelector('.file-icon').click();assert.equal($('preview-dialog').open,true);assert.ok($('preview-body').querySelector('iframe'));$('preview-close').click();assert.equal($('preview-dialog').open,false);
$('upload-notes').value='驗收測試：請老師確認第 3 題。';$('upload').click();await waitFor(()=>(!window.qa.busy&&window.qa.items[0].status!=="pending"),'upload done');
assert.match($('summary').textContent,/已收到 1 個檔案/);assert.ok($('queue').textContent.includes('上傳成功'));
if(!live){const begin=calls.find(x=>x.name==='beginUpload').args[0];assert.equal(begin.extension,'pdf');assert.equal(begin.submission.content,'2-2');assert.equal(begin.submission.termKey,'8-1');assert.equal(begin.notes,'驗收測試：請老師確認第 3 題。');assert.equal(begin.name,undefined)}
if(live){
  const uploaded=window.qa.items[0];await waitFor(()=>!window.qa.historyLoading,'history after upload');let result=await remote('listUploads','huang-yun-xi');let file=result.files.find(x=>x.name===uploaded.storedName);assert.ok(file,'uploaded file must be present in live Drive history');assert.equal(file.notes,'驗收測試：請老師確認第 3 題。');
  await remote('updateUploadNotes','huang-yun-xi',file.id,'驗收測試：附註已更新。');result=await remote('listUploads','huang-yun-xi');assert.equal(result.files.find(x=>x.id===file.id).notes,'驗收測試：附註已更新。');
  window.qa.historyFiles=result.files;window.qa.historyRender();window.qa.replaceUpload(result.files.find(x=>x.id===file.id));
  const replacement=Buffer.concat([pdf,Buffer.from('\n% replacement acceptance test\n')]);window.testFile=new window.File([replacement],'另一個原始名稱.pdf',{type:'application/pdf'});await window.qa.addFiles([window.testFile]);$('upload').click();await waitFor(()=>(!window.qa.busy&&window.qa.items[0].status!=="pending"),'replace upload');assert.match($('summary').textContent,/已收到 1 個檔案/);
  result=await remote('listUploads','huang-yun-xi');const replaced=result.files.find(x=>x.id===file.id);assert.ok(replaced);assert.equal(replaced.size,replacement.length);const state=await remote('getUploadStatus',window.qa.items[0].requestId);assert.equal(state.md5,crypto.createHash('md5').update(replacement).digest('hex'));
  await remote('trashUpload','huang-yun-xi',file.id);result=await remote('listUploads','huang-yun-xi');assert.equal(result.files.some(x=>x.id===file.id),false);
  console.log('LIVE PASS — exact frontend scripts → Drive; local preview; generated metadata; history; notes; replace existing ID; checksum; trash.');
}else console.log('UI PASS — greeting, publisher sections, custom fields, view toggle, local PDF preview, upload metadata, receipt.');
await window.happyDOM.close();
