const PUBLISHERS = { nanyi: '南一版', kangxuan: '康軒版', hanlin: '翰林版' };

function records_() {
  const values = PropertiesService.getScriptProperties().getProperties();
  if (!values.configInitialized) return JSON.parse(JSON.stringify(SETTINGS.students));
  return Object.keys(values).filter(function(key) { return key.indexOf('student:') === 0; })
    .map(function(key) { return JSON.parse(values[key]); }).sort(function(a,b) { return a.order - b.order; });
}
function revision_() { return Number(PropertiesService.getScriptProperties().getProperty('configRevision') || 0); }
function getAdminConfig() {
  return { revision: revision_(), publishers: PUBLISHERS, catalogs:{nanyi:NANYI,kangxuan:KANGXUAN,hanlin:HANLIN}, academicYear: schoolContext_({baseGrade:8,baseAcademicYear:2026}).academicYear,
    students: records_().map(function(s) {
      return { id:s.id, name:s.name, greetingName:s.greetingName || s.name, grade:schoolContext_(s).grade,
        publisher:s.publisher || 'nanyi', active:s.active !== false,
        deadlines:s.deadlines || defaultDeadlines_() };
    }) };
}
function defaultDeadlines_() { return {homework:{enabled:true,weekday:3,time:'18:00'},exam:{enabled:true,weekday:3,time:'18:00'}}; }
function checkedDeadline_(input) {
  if (!input || typeof input.enabled !== 'boolean' || !Number.isInteger(input.weekday) || input.weekday < 0 || input.weekday > 6 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time || '')) throw new Error('請設定有效的每週截止日與時間。');
  return {enabled:input.enabled,weekday:input.weekday,time:input.time};
}
function saveAdminConfig(input) {
  if (!input || !Array.isArray(input.students) || input.students.length < 1 || input.students.length > 100) throw new Error('學生名單須有 1～100 位（可停用）。');
  const lock=LockService.getScriptLock(); lock.waitLock(20000);
  try {
    if (input.revision !== revision_()) throw new Error('設定已被其他人更新，請重新載入後再編輯。');
    const year=schoolContext_({baseGrade:8,baseAcademicYear:2026}).academicYear;
    const ids={};
    const records=input.students.map(function(s,index) {
      const id=s.id || 's-' + Utilities.getUuid().replace(/-/g,'');
      if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id) || ids[id]) throw new Error('學生識別碼重複或無效。');
      ids[id]=true;
      const name=customLabel_(s.name,'姓名');
      if (![7,8,9].includes(s.grade) || !PUBLISHERS[s.publisher]) throw new Error('請選擇國一、國二或國三，以及出版社。');
      return {id:id,name:name,greetingName:customLabel_(s.greetingName || name,'稱呼'),
        baseGrade:s.grade,baseAcademicYear:year,publisher:s.publisher,active:s.active !== false,order:index,
        deadlines:{homework:checkedDeadline_(s.deadlines && s.deadlines.homework),exam:checkedDeadline_(s.deadlines && s.deadlines.exam)}};
    });
    for (const old of records_()) if (!ids[old.id]) throw new Error('請使用「停用」保留現有學生的繳交紀錄。');
    const values={configInitialized:'1',configRevision:String(input.revision+1)};
    records.forEach(function(s) {values['student:'+s.id]=JSON.stringify(s);});
    PropertiesService.getScriptProperties().setProperties(values,false);
    return getAdminConfig();
  } finally {lock.releaseLock();}
}
function nextDeadline_(rule, now) {
  if (!rule || !rule.enabled) return null;
  const date=now || new Date();
  const taipei=new Date(date.getTime()+8*60*60*1000);
  const hm=rule.time.split(':').map(Number);
  const delta=(rule.weekday-taipei.getUTCDay()+7)%7;
  let time=Date.UTC(taipei.getUTCFullYear(),taipei.getUTCMonth(),taipei.getUTCDate()+delta,hm[0]-8,hm[1]);
  if (time < date.getTime()) time+=7*24*60*60*1000;
  return new Date(time).toISOString();
}
