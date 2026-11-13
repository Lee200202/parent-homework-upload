import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../apps-script/Index.html', import.meta.url), 'utf8');
for (const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
const source = fs.readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8');
const cache = new Map();
const requests = [];
let response;
let folderCreated = 0;
const folder = { getId: () => 'student-folder' };
const root = { getFoldersByName: () => ({ hasNext: () => false }), createFolder: () => { folderCreated++; return folder; } };
const context = vm.createContext({
  console,
  CacheService: { getScriptCache: () => ({ get: k => cache.get(k), put: (k,v) => cache.set(k,v), remove: k => cache.delete(k) }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  DriveApp: { getFolderById: id => { assert.equal(id, '18KkBjVH9lslNs7YmA83Vk2vm3SGqAy9X'); return root; } },
  ScriptApp: { getOAuthToken: () => 'test-only-token' },
  Utilities: { formatDate: () => '20261113_120000', base64Decode: s => [...Buffer.from(s, 'base64')] },
  UrlFetchApp: { fetch: (url, options) => { requests.push({url,options}); if(response instanceof Error) throw response; return response; } }
});
vm.runInContext(source, context);
const run = expression => vm.runInContext(expression, context);
const reply = (code, body = {}, headers = {}) => ({ getResponseCode: () => code, getAllHeaders: () => headers, getContentText: () => JSON.stringify(body) });
const meta = { studentId:'huang-yun-xi', extension:'pdf', size: 1024 * 1024 + 10, requestId:'abcdef0123456789abcdef0123456789', submission: {category:'homework',content:'2-2',device:'desktop',sequence:1} };
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
assert.equal(folderCreated, 1);
const metadata=JSON.parse(requests[0].options.payload);
assert.equal(metadata.name,'國二數學_黃雲晞_作業_2-2_電腦_20261113_120000_01_abcdef01.pdf');
assert.match(metadata.description,/上傳裝置：電腦/);
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
const custom=run('beginUpload({...meta,requestId:"112233445566778899aabbccddeeff00",submission:{category:"custom",customCategory:"  課前/資料  ",content:"custom",customContent:"  第一次段考：訂正  ",device:"mobile",sequence:2}})');
assert.equal(custom.name,'國二數學_黃雲晞_課前 資料_第一次段考：訂正_手機_20261113_120000_02_11223344.pdf');
console.log('PASS — Syntax; input limits; signatures; category/content validation; generated filenames; device records; resumable progress; retries; expiry.');
