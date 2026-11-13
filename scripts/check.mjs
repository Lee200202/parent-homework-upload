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
const meta = { studentId:'huang-yun-xi', name:'練習.pdf', size: 1024 * 1024 + 10, requestId:'abcdef0123456789abcdef0123456789' };
context.meta = meta;
assert.throws(() => run('beginUpload({...meta,studentId:"other"})'), /選擇學生/);
assert.throws(() => run('beginUpload({...meta,size:10485761})'), /10 MB/);
assert.throws(() => run('beginUpload({...meta,size:0})'), /10 MB/);
assert.throws(() => run('beginUpload({...meta,name:"movie.mp4"})'), /照片或 PDF/);
assert.equal(requests.length, 0, 'Invalid input must never contact Drive');

response = reply(200, {}, { Location:'https://www.googleapis.com/upload/drive/v3/files?upload_id=test' });
const started = run('beginUpload(meta)');
assert.equal(started.offset, 0);
assert.equal(folderCreated, 1);
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
console.log('PASS — JavaScript syntax; input limits and signatures; resumable progress; retry without duplicate files; expired sessions.');
