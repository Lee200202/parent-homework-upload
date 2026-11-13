/** Public upload API. Secrets and Drive access remain on Google's servers. */
const SETTINGS = Object.freeze({
  folderId: '18KkBjVH9lslNs7YmA83Vk2vm3SGqAy9X',
  maxBytes: 10 * 1024 * 1024,
  chunkBytes: 1024 * 1024,
  students: [{ id: 'huang-yun-xi', name: '黃雲晞', greetingName: '雲晞', course: '國二數學' }]
});

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('作業繳交・數學家教')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getConfig() {
  return { students: SETTINGS.students, maxBytes: SETTINGS.maxBytes, chunkBytes: SETTINGS.chunkBytes };
}

function beginUpload(meta) {
  const student = SETTINGS.students.find(function(s) { return meta && s.id === meta.studentId; });
  if (!student) throw new Error('請先選擇學生姓名。');
  if (!Number.isInteger(meta.size) || meta.size < 1 || meta.size > SETTINGS.maxBytes) {
    throw new Error('每個檔案須介於 1 byte 與 10 MB 之間。');
  }
  if (!/^[a-zA-Z0-9_-]{16,80}$/.test(meta.requestId || '')) throw new Error('上傳識別碼無效，請重新選檔。');
  const extension = String(meta.extension || (typeof meta.name === 'string' ? meta.name.split('.').pop() : '')).toLowerCase();
  const mime = mimeFor_('file.' + extension);
  if (!meta.submission) throw new Error('頁面已更新，請重新整理後選擇類型與內容，再重新選檔。');
  const submission = submission_(meta.submission);
  const identity = JSON.stringify({ studentId: student.id, size: meta.size, extension: extension, submission: submission });
  const key = 'upload:' + meta.requestId;
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const old = getSession_(key);
    if (old) {
      if (old.identity !== identity) throw new Error('上傳識別碼已使用。');
      return publicSession_(old);
    }
    const folder = studentFolder_(student);
    const stamp = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyyMMdd_HHmmss');
    const storedName = [student.course, student.name, submission.category, submission.content, submission.device, stamp, String(submission.sequence).padStart(2, '0'), meta.requestId.slice(0, 8)].join('_') + '.' + extension;
    const response = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,size,md5Checksum', {
      method: 'post', contentType: 'application/json; charset=UTF-8',
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'X-Upload-Content-Type': mime, 'X-Upload-Content-Length': String(meta.size) },
      payload: JSON.stringify({ name: storedName, parents: [folder.getId()], description: ['家長作業繳交', student.course, student.name, submission.category, submission.content, '上傳裝置：' + submission.device].join('｜') }),
      muteHttpExceptions: true, followRedirects: false
    });
    if (response.getResponseCode() !== 200) throw new Error('目前無法建立上傳，請稍後重試或聯絡老師。');
    const headers = response.getAllHeaders();
    const url = headers.Location || headers.location;
    if (!url || !/^https:\/\/www\.googleapis\.com\//.test(url)) throw new Error('無法取得上傳連線。');
    const state = { key: key, requestId: meta.requestId, identity: identity, name: storedName, mime: mime, size: meta.size, offset: 0, url: url, done: false };
    putSession_(state);
    return publicSession_(state);
  } finally { lock.releaseLock(); }
}

function uploadChunk(requestId, offset, base64) {
  if (!/^[a-zA-Z0-9_-]{16,80}$/.test(requestId || '')) throw new Error('上傳識別碼無效。');
  if (typeof base64 !== 'string' || base64.length > 4 * Math.ceil(SETTINGS.chunkBytes / 3)) throw new Error('檔案區塊過大。');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const state = getSession_('upload:' + requestId);
    if (!state) throw new Error('上傳連線已到期，請按重試重新上傳。');
    if (state.done) return publicSession_(state);
    if (!Number.isInteger(offset) || offset < 0 || offset > state.size) throw new Error('檔案進度無效。');
    if (offset !== state.offset) return publicSession_(state);
    const bytes = Utilities.base64Decode(base64);
    if (!bytes.length || bytes.length > SETTINGS.chunkBytes || offset + bytes.length > state.size || (offset + bytes.length < state.size && bytes.length !== SETTINGS.chunkBytes)) throw new Error('檔案區塊不完整，請重試。');
    if (offset === 0 && !validSignature_(bytes, state.mime)) throw new Error('檔案內容與副檔名不符，請使用照片或 PDF 原檔。');
    const response = UrlFetchApp.fetch(state.url, {
      method: 'put', contentType: state.mime,
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'Content-Range': 'bytes ' + offset + '-' + (offset + bytes.length - 1) + '/' + state.size },
      payload: bytes, muteHttpExceptions: true, followRedirects: false
    });
    return applyResponse_(state, response);
  } finally { lock.releaseLock(); }
}

function getUploadStatus(requestId) {
  if (!/^[a-zA-Z0-9_-]{16,80}$/.test(requestId || '')) throw new Error('上傳識別碼無效。');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const state = getSession_('upload:' + requestId);
    if (!state) return { expired: true };
    if (state.done) return publicSession_(state);
    const response = UrlFetchApp.fetch(state.url, {
      method: 'put', headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'Content-Range': 'bytes */' + state.size },
      payload: '', muteHttpExceptions: true, followRedirects: false
    });
    return applyResponse_(state, response);
  } finally { lock.releaseLock(); }
}

function applyResponse_(state, response) {
  const code = response.getResponseCode();
  if (code === 200 || code === 201) {
    const file = JSON.parse(response.getContentText());
    if (!file.id || Number(file.size) !== state.size) throw new Error('雲端檔案確認失敗，請聯絡老師。');
    state.done = true; state.offset = state.size; state.fileId = file.id;
  } else if (code === 308) {
    const headers = response.getAllHeaders();
    const range = String(headers.Range || headers.range || '');
    const match = /bytes=0-(\d+)/.exec(range);
    state.offset = match ? Number(match[1]) + 1 : 0;
  } else if (code === 404 || code === 410) {
    CacheService.getScriptCache().remove(state.key);
    return { expired: true };
  } else {
    throw new Error('網路或雲端暫時忙碌，請按重試繼續。');
  }
  putSession_(state);
  return publicSession_(state);
}

function publicSession_(state) {
  return { requestId: state.requestId, name: state.name, offset: state.offset, size: state.size, done: state.done, receipt: state.done ? state.requestId.slice(0, 8).toUpperCase() : null };
}
function getSession_(key) {
  const text = CacheService.getScriptCache().get(key);
  return text ? JSON.parse(text) : null;
}
function putSession_(state) { CacheService.getScriptCache().put(state.key, JSON.stringify(state), 21600); }
function studentFolder_(student) {
  const root = DriveApp.getFolderById(SETTINGS.folderId);
  const name = student.course + '＿' + student.name;
  const folders = root.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : root.createFolder(name);
}
function submission_(input) {
  if (!input || !['homework', 'exam', 'custom'].includes(input.category)) throw new Error('請選擇考試、作業或自訂類型。');
  const category = input.category === 'custom' ? customLabel_(input.customCategory, '類型') : input.category === 'exam' ? '考試' : '作業';
  const presets = ['2-2', '2-3', '3-1', '3-2', '段考考卷'];
  if (input.content !== 'custom' && !presets.includes(input.content)) throw new Error('請選擇繳交內容。');
  const content = input.content === 'custom' ? customLabel_(input.customContent, '內容') : input.content;
  if (!['mobile', 'desktop'].includes(input.device)) throw new Error('無法辨識上傳裝置，請重新整理。');
  if (!Number.isInteger(input.sequence) || input.sequence < 1 || input.sequence > 20) throw new Error('檔案序號無效。');
  return { category: category, content: content, device: input.device === 'mobile' ? '手機' : '電腦', sequence: input.sequence };
}
function customLabel_(text, field) {
  if (typeof text !== 'string' || !text.trim() || text.trim().length > 30) throw new Error('請填寫自訂' + field + '（1～30 字）。');
  const clean = text.trim().replace(/[\x00-\x1f\x7f/\\<>:"|?*]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) throw new Error('請填寫有效的自訂' + field + '。');
  return clean;
}
function mimeFor_(name) {
  const ext = name.split('.').pop().toLowerCase();
  const mimes = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif' };
  if (!mimes[ext]) throw new Error('請使用 JPG、PNG、WebP、HEIC 照片或 PDF。');
  return mimes[ext];
}
function validSignature_(bytes, mime) {
  const b = bytes.slice(0, 40).map(function(v) { return v & 255; });
  const ascii = b.map(function(v) { return String.fromCharCode(v); }).join('');
  if (mime === 'application/pdf') return ascii.indexOf('%PDF-') === 0;
  if (mime === 'image/jpeg') return b[0] === 255 && b[1] === 216 && b[2] === 255;
  if (mime === 'image/png') return b.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10';
  if (mime === 'image/webp') return ascii.slice(0, 4) === 'RIFF' && ascii.slice(8, 12) === 'WEBP';
  if (mime === 'image/heic' || mime === 'image/heif') return ascii.slice(4, 8) === 'ftyp' && /heic|heix|hevc|hevx|mif1|msf1/.test(ascii.slice(8));
  return false;
}

/** Run once from the editor to authorize and verify the fixed destination. */
function verifyDestination_() {
  const folder = DriveApp.getFolderById(SETTINGS.folderId);
  console.log('上傳目的地：' + folder.getName());
  UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + SETTINGS.folderId + '?fields=id,name', { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } });
}
