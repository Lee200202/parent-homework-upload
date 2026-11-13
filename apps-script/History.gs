function notes_(text) {
  if (text == null) return '';
  if (typeof text !== 'string' || text.length > 2000) throw new Error('附註最多 2000 字。');
  return text.trim();
}
function driveRequest_(path,options) {
  const init=options || {};
  init.headers={Authorization:'Bearer '+ScriptApp.getOAuthToken()};
  init.muteHttpExceptions=true;
  const response=UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/'+path,init);
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) throw new Error('雲端檔案暫時無法存取，請重新整理或稍後重試。');
  return JSON.parse(response.getContentText());
}
function checkedStudent_(id) {
  if (!records_().some(function(s) {return s.id === id && s.active !== false;})) throw new Error('請選擇有效的學生姓名。');
}
function managedFile_(studentId,fileId) {
  checkedStudent_(studentId);
  if (typeof fileId !== 'string' || !/^[a-zA-Z0-9_-]{10,160}$/.test(fileId)) throw new Error('檔案識別碼無效。');
  const file=driveRequest_('files/'+fileId+'?fields=id,name,parents,trashed,appProperties,description,mimeType,size,webViewLink,modifiedTime');
  if (file.trashed || !(file.parents || []).includes(SETTINGS.folderId) || !file.appProperties || file.appProperties.portal !== 'math-parent-upload' || file.appProperties.studentId !== studentId) throw new Error('這個檔案不屬於目前學生的繳交紀錄。');
  return file;
}
function fileInfo_(file) {
  let details={};
  try {const parsed=JSON.parse(file.description || '{}');if(parsed.portal==='math-parent-upload') details=parsed;}catch(e){}
  return {id:file.id,name:file.name,size:Number(file.size || 0),mimeType:file.mimeType,modifiedTime:file.modifiedTime,
    viewUrl:'https://drive.google.com/file/d/'+file.id+'/view',notes:details.notes || '',details:details};
}
function listUploads(studentId,pageToken) {
  checkedStudent_(studentId);
  if (pageToken && (typeof pageToken !== 'string' || pageToken.length > 2000)) throw new Error('分頁資料無效。');
  const query="'"+SETTINGS.folderId+"' in parents and trashed=false and appProperties has { key='portal' and value='math-parent-upload' } and appProperties has { key='studentId' and value='"+studentId+"' }";
  const data=driveRequest_('files?q='+encodeURIComponent(query)+'&orderBy=modifiedTime%20desc&pageSize=30&fields=nextPageToken,files(id,name,size,mimeType,modifiedTime,description)' + (pageToken?'&pageToken='+encodeURIComponent(pageToken):''));
  return {files:(data.files || []).map(fileInfo_),nextPageToken:data.nextPageToken || null};
}
function trashUpload(studentId,fileId) {
  managedFile_(studentId,fileId);
  driveRequest_('files/'+fileId+'?fields=id,trashed',{method:'patch',contentType:'application/json',payload:JSON.stringify({trashed:true})});
  return {ok:true};
}
function updateUploadNotes(studentId,fileId,text) {
  const file=managedFile_(studentId,fileId);
  const info=fileInfo_(file);
  info.details.notes=notes_(text);
  driveRequest_('files/'+fileId+'?fields=id',{method:'patch',contentType:'application/json',payload:JSON.stringify({description:JSON.stringify(info.details)})});
  return {ok:true,notes:info.details.notes};
}
