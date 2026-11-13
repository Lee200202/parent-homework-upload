import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const endpoint='https://script.google.com/macros/s/AKfycbyCsgWlVlC1ORH8HuYKf19BrwykRSLlzBROE-Kxl_qXzzdH6ZiXnH8dldYAbdoQ4fifcg/exec';
async function call(action,...args){
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,args}),redirect:'follow',signal:AbortSignal.timeout(90000)});
  const text=await response.text();
  let result;try{result=JSON.parse(text)}catch{throw new Error('Expected JSON from upload service; HTTP '+response.status+'; '+text.replace(/<[^>]*>/g,' ').slice(0,200))}
  if(!result.ok)throw new Error(result.error);return result.value;
}
const config=await call('config');
assert.equal(config.students[0].greetingName,'雲晞');
const reports=[];
const tests=process.argv.includes('--jfif')?[
  {file:'qa/photo-acceptance.jfif',category:'homework',content:'2-2',device:'desktop'}
]:process.argv.includes('--large')?[
  {file:'qa/驗收上限10MB.pdf',category:'exam',content:'段考考卷',device:'desktop'}
]:[
  {file:'qa/驗收考卷.pdf',category:'homework',content:'2-2',device:'desktop'},
  {file:'qa/驗收照片.png',category:'exam',content:'段考考卷',device:'mobile'},
  {file:'qa/驗收考卷.pdf',category:'custom',customCategory:'驗收測試',content:'custom',customContent:'自訂內容驗收',device:'desktop'}
];
for(const test of tests){
  const buffer=fs.readFileSync(test.file);
  const id=crypto.randomUUID().replaceAll('-','');
  const submission={...test,sequence:1,termKey:config.students[0].termKey,publisher:config.students[0].publisher};delete submission.file;
  const meta={studentId:config.students[0].id,extension:test.file.split('.').pop(),size:buffer.length,requestId:id,submission};
  let state=await call('beginUpload',meta);
  console.log('Started: '+state.name);
  const progress=[];
  while(!state.done){const offset=state.offset;state=await call('uploadChunk',id,offset,buffer.subarray(offset,offset+config.chunkBytes).toString('base64'));assert.ok(!state.expired);assert.ok(state.offset>offset);progress.push(state.offset);console.log('Received '+state.offset+'/'+buffer.length)}
  assert.equal(state.offset,buffer.length);
  const retry=await call('beginUpload',meta);assert.equal(retry.done,true);assert.equal(retry.name,state.name);
  const status=await call('getUploadStatus',id);assert.equal(status.done,true);
  assert.ok(Number.isFinite(Date.parse(state.receivedAt)),'Completion timestamp must come from the server');
  const checksum=crypto.createHash('md5').update(buffer).digest('hex');assert.equal(state.md5,checksum,'Google Drive checksum must match local file');
  const history=await call('listUploads',config.students[0].id);assert.ok(history.files.some(file=>file.name===state.name&&file.size===buffer.length));
  const report={name:state.name,size:buffer.length,md5:state.md5,receipt:state.receipt,progress,device:test.device};
  reports.push(report);console.log('PASS '+JSON.stringify(report));
  if(process.argv.includes('--cleanup')){const ownFile=history.files.find(file=>file.name===state.name);await call('trashUpload',config.students[0].id,ownFile.id);console.log('Moved this test file to Drive trash.')}
}
fs.mkdirSync('.local',{recursive:true});
fs.writeFileSync('.local/live-acceptance'+(process.argv.includes('--jfif')?'-jfif':process.argv.includes('--large')?'-large':'')+'.json',JSON.stringify({testedAt:new Date().toISOString(),reports},null,2));
