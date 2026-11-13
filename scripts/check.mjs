import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

for(const file of ['Index.html','Admin.html']){
 const html=fs.readFileSync(new URL('../apps-script/'+file,import.meta.url),'utf8');
 for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);
}
const source = fs.readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8');
const cache = new Map();
const requests = [];
let response;
const props=new Map();
const root = { getId: () => '18KkBjVH9lslNs7YmA83Vk2vm3SGqAy9X' };
class FixedDate extends Date {constructor(value){super(value===undefined?'2026-11-13T04:00:00Z':value)}static now(){return new Date('2026-11-13T04:00:00Z').getTime()}}
const context = vm.createContext({
  console,Date:FixedDate,
  PropertiesService:{getScriptProperties:()=>({getProperties:()=>Object.fromEntries(props),getProperty:k=>props.get(k)||null,setProperties:values=>Object.entries(values).forEach(([k,v])=>props.set(k,v))})},
  CacheService: { getScriptCache: () => ({ get: k => cache.get(k), put: (k,v) => cache.set(k,v), remove: k => cache.delete(k) }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  DriveApp: { getFolderById: id => { assert.equal(id, '18KkBjVH9lslNs7YmA83Vk2vm3SGqAy9X'); return root; } },
  ScriptApp: { getOAuthToken: () => 'test-only-token' },
  Utilities: { getUuid:()=>crypto.randomUUID(),formatDate: (date,tz,pattern) => pattern==='yyyy-MM-dd'?new Date(date.getTime()+28800000).toISOString().slice(0,10):'20261113_120000', base64Decode: s => [...Buffer.from(s, 'base64')] },
  UrlFetchApp: { fetch: (url, options) => { requests.push({url,options}); if(response instanceof Error) throw response; return typeof response === 'function' ? response(url,options) : response; } }
});
for(const file of ['PublisherCatalog.gs','Curriculum.gs','StudentSettings.gs','History.gs'])vm.runInContext(fs.readFileSync(new URL('../apps-script/'+file,import.meta.url),'utf8'),context);
vm.runInContext(source, context);
const run = expression => vm.runInContext(expression, context);
const reply = (code, body = {}, headers = {}) => ({ getResponseCode: () => code, getAllHeaders: () => headers, getContentText: () => JSON.stringify(body) });
const meta = { studentId:'huang-yun-xi', extension:'pdf', size: 1024 * 1024 + 10, requestId:'abcdef0123456789abcdef0123456789', submission: {category:'homework',termKey:'8-1',content:'2-2',device:'desktop',sequence:1} };
context.meta = meta;
assert.throws(() => run('beginUpload({...meta,studentId:"other"})'), /選擇學生/);
assert.throws(() => run('beginUpload({...meta,size:10485761})'), /10 MB/);
assert.throws(() => run('beginUpload({...meta,size:0})'), /10 MB/);
assert.throws(() => run('beginUpload({...meta,extension:"mp4"})'), /照片或 PDF/);
assert.throws(() => run('beginUpload({...meta,extension:undefined,name:"原本正常的檔案.pdf",submission:undefined})'), /頁面已更新/);
assert.throws(() => run('beginUpload({...meta,submission:{...meta.submission,category:"other"}})'), /類型/);
assert.throws(() => run('beginUpload({...meta,submission:{...meta.submission,category:"custom",customCategory:"  "}})'), /自訂類型/);
assert.throws(() => run('beginUpload({...meta,submission:{...meta.submission,content:"custom",customContent:""}})'), /自訂內容/);
assert.throws(() => run('beginUpload({...meta,submission:{...meta.submission,content:"unlisted"}})'), /內容/);
assert.throws(() => run('beginUpload({...meta,submission:{...meta.submission,device:"fake"}})'), /裝置/);
assert.equal(requests.length, 0, 'Invalid input must never contact Drive');

response = reply(200, {}, { Location:'https://www.googleapis.com/upload/drive/v3/files?upload_id=test' });
const started = run('beginUpload(meta)');
assert.equal(started.offset, 0);
const metadata=JSON.parse(requests[0].options.payload);
assert.equal(metadata.name,'國二上數學_黃雲晞_南一版_作業_2-2 根式的運算_電腦_20261113_120000_01_abcdef01.pdf');
assert.equal(metadata.parents[0],'18KkBjVH9lslNs7YmA83Vk2vm3SGqAy9X');
assert.equal(JSON.parse(metadata.description).device,'電腦');
assert.equal(started.name, metadata.name);
assert.throws(() => run('beginUpload({...meta,submission:{...meta.submission,content:"2-3"}})'), /識別碼已使用/);
run('beginUpload(meta)');
assert.equal(requests.length, 1, 'Retried begin must reuse the existing session');
const first = Buffer.alloc(1024 * 1024);first.write('%PDF-1.4');context.block = first.toString('base64');
context.invalid = Buffer.alloc(1024 * 1024).toString('base64');
assert.throws(() => run('uploadChunk(meta.requestId,0,invalid)'), /內容與副檔名/);
assert.equal(requests.length, 1);

response = reply(308, {}, { Range:'bytes=0-1048575' });
assert.equal(run('uploadChunk(meta.requestId,0,block)').offset, 1048576);
assert.equal(requests[1].options.headers['Content-Range'], 'bytes 0-1048575/1048586');
assert.equal(run('uploadChunk(meta.requestId,0,block)').offset, 1048576);
assert.equal(requests.length, 2, 'Repeated acknowledged chunk must not be written twice');

// Lost client acknowledgment: query Drive before resuming, then upload the final bytes.
assert.equal(run('getUploadStatus(meta.requestId)').offset, 1048576);
assert.equal(requests[2].options.headers['Content-Range'], 'bytes */1048586');
context.last = Buffer.alloc(10).toString('base64');
response = reply(200, {id:'received-file',size:String(meta.size)});
assert.equal(run('uploadChunk(meta.requestId,1048576,last)').done, true);
const count = requests.length;
assert.equal(run('getUploadStatus(meta.requestId)').receipt, 'ABCDEF01');
assert.equal(run('uploadChunk(meta.requestId,1048576,last)').done, true);
assert.equal(requests.length,count,'Retry after completion must not create a second file');

assert.equal(run('validSignature_([137,80,78,71,13,10,26,10],"image/png")'),true);
assert.equal(run('validSignature_([255,216,255],"image/jpeg")'),true);
assert.equal(run('validSignature_([60,115,118,103],"image/png")'),false);
assert.throws(() => run('beginUpload({...meta,requestId:"bad"})'),/識別碼/);
const session = JSON.parse(cache.get('upload:'+meta.requestId));session.done=false;cache.set(session.key,JSON.stringify(session));
response=reply(404);
assert.equal(run('getUploadStatus(meta.requestId)').expired,true);
assert.equal(cache.has(session.key),false);
response=reply(200,{}, { Location:'https://www.googleapis.com/upload/drive/v3/files?upload_id=custom' });
const custom=run('beginUpload({...meta,requestId:"112233445566778899aabbccddeeff00",submission:{category:"custom",termKey:"8-1",customCategory:"  課前/資料  ",content:"custom",customContent:"  第一次段考：訂正  ",device:"mobile",sequence:2}})');
assert.equal(custom.name,'國二上數學_黃雲晞_南一版_課前 資料_第一次段考：訂正_手機_20261113_120000_02_11223344.pdf');

assert.equal(run('schoolContext_(SETTINGS.students[0],new Date("2027-01-31T15:59:59Z")).termKey'),'8-1');
assert.equal(run('schoolContext_(SETTINGS.students[0],new Date("2027-01-31T16:00:00Z")).termKey'),'8-2');
assert.equal(run('schoolContext_(SETTINGS.students[0],new Date("2027-06-30T15:59:59Z")).termKey'),'8-2');
assert.equal(run('schoolContext_(SETTINGS.students[0],new Date("2027-06-30T16:00:00Z")).termKey'),'9-1');
assert.equal(run('schoolContext_(SETTINGS.students[0],new Date("2028-07-01T00:00:00Z")).graduated'),true);
assert.equal(run('nextDeadline_({enabled:true,weekday:3,time:"18:00"},new Date("2026-11-18T09:59:59Z"))'),'2026-11-18T10:00:00.000Z');
assert.equal(run('nextDeadline_({enabled:true,weekday:3,time:"18:00"},new Date("2026-11-18T10:00:01Z"))'),'2026-11-25T10:00:00.000Z');
assert.equal(run('nextDeadline_({enabled:false,weekday:3,time:"18:00"})'),null);
assert.throws(()=>run('beginUpload({...meta,submission:{...meta.submission,termKey:"9-1"}})'),/年級或學期/);
assert.throws(()=>run('beginUpload({...meta,submission:{...meta.submission,publisher:"hanlin"}})'),/版本已更新/);
for(const catalog of ['NANYI','KANGXUAN','HANLIN']){assert.equal(run('Object.keys('+catalog+').length'),6);assert.equal(run('Object.values('+catalog+').every(chapters=>new Set(chapters.flatMap(c=>c[1].map(s=>s[0]))).size===chapters.flatMap(c=>c[1]).length)'),true)}
const admin=run('getAdminConfig()');context.admin=admin;assert.equal(admin.students[0].deadlines.homework.time,'18:00');
run('saveAdminConfig({revision:admin.revision,students:admin.students})');assert.equal(run('revision_()'),1);
assert.throws(()=>run('saveAdminConfig({revision:0,students:admin.students})'),/其他人更新/);
assert.equal(run('studentConfig_({...records_()[0],publisher:"hanlin"}).terms[0].chapters[0][1][1][1]'),'多項式的加減');
assert.throws(()=>run('managedFile_("other-student","valid-file-id")'),/有效的學生/);
response=reply(200,{id:'valid-file-id',parents:['other-folder'],appProperties:{portal:'math-parent-upload',studentId:'huang-yun-xi',requestId:'abcdef0123456789abcdef0123456789'}});
assert.throws(()=>run('trashUpload("huang-yun-xi","valid-file-id")'),/資料夾已變更/);
response=url=>url.includes('files?q=')?reply(200,{files:[{id:'valid-file-id'}]}):reply(200,{id:'valid-file-id',appProperties:{portal:'math-parent-upload',studentId:'huang-yun-xi',requestId:'abcdef0123456789abcdef0123456789'}});
assert.equal(run('managedFile_("huang-yun-xi","valid-file-id").id'),'valid-file-id');
assert.throws(()=>run('notes_("x".repeat(2001))'),/2000/);
console.log('PASS — Syntax; root destination; publisher catalogs; grade/semester boundaries; weekly deadlines; admin persistence/concurrency; notes and file scope; upload progress and retries.');
