export type Student = { id:string; user_id:string; student_no:number; name:string; guardian_name:string; guardian_phone:string; tags:string[]; notes:string; archived:boolean; created_at?:string };
export type Attendance = { id:string; user_id:string; student_id:string; date:string; status:'present'|'late'|'personal'|'sick'|'absent'; notes:string; updated_at?:string };
export type Task = { id:string; user_id:string; title:string; due_at:string; priority:'low'|'normal'|'high'; completed:boolean; student_id:string|null; category:string; created_at?:string };
export type Schedule = { id:string; user_id:string; weekday:number; period:number; start_time:string; subject:string; location:string };
export type StudentRecord = { id:string; user_id:string; student_id:string; record_date:string; record_type:string; content:string; follow_up_date:string|null; created_at?:string };
export type ClassSettings = { id:string; user_id:string; class_name:string; school_year:string; semester:string; teacher_name:string };
export type AppData = { students:Student[]; attendance:Attendance[]; tasks:Task[]; schedule:Schedule[]; student_records:StudentRecord[]; class_settings:ClassSettings[] };
export type Session = { access_token:string; refresh_token:string; expires_at?:number; user:{ id:string; email:string } };
export type CloudConfig = { url:string; key:string };

export const emptyData:AppData = { students:[], attendance:[], tasks:[], schedule:[], student_records:[], class_settings:[] };
export const tableNames = ['students','attendance','tasks','schedule','student_records','class_settings'] as const;
const uid = () => crypto.randomUUID();
const isoDate = (offset=0) => { const d=new Date(); d.setDate(d.getDate()+offset); return d.toISOString().slice(0,10); };

export function demoData():AppData {
  const user='demo-user';
  const students:Student[] = [
    [1,'王予安','王先生','0912-345-678',['需關注']], [2,'李晨希','李女士','0922-110-862',['班級幹部']], [3,'張以樂','張先生','0935-821-410',[]],
    [8,'陳語晴','陳女士','0918-205-733',['學習追蹤']], [12,'林品睿','林先生','0988-721-336',[]], [21,'郭宇辰','郭女士','0920-553-812',['家長聯絡']]
  ].map(([student_no,name,guardian_name,guardian_phone,tags])=>({id:uid(),user_id:user,student_no:student_no as number,name:name as string,guardian_name:guardian_name as string,guardian_phone:guardian_phone as string,tags:tags as string[],notes:'',archived:false}));
  const byNo=(n:number)=>students.find(s=>s.student_no===n)!.id;
  return {
    students,
    attendance:students.map((s,i)=>({id:uid(),user_id:user,student_id:s.id,date:isoDate(),status:i===3?'sick':i===5?'late':'present',notes:''})),
    tasks:[
      {id:uid(),user_id:user,title:'回覆王同學家長',due_at:`${isoDate(-1)}T10:00`,priority:'high',completed:false,student_id:byNo(1),category:'學生聯絡'},
      {id:uid(),user_id:user,title:'收齊校外教學同意書',due_at:`${isoDate()}T16:00`,priority:'normal',completed:false,student_id:null,category:'班級事務'},
      {id:uid(),user_id:user,title:'整理本週缺席紀錄',due_at:`${isoDate(3)}T17:00`,priority:'normal',completed:false,student_id:null,category:'行政'}],
    schedule:[
      [2,1,'08:10','國文','本班教室'],[2,2,'09:10','數學','本班教室'],[2,3,'10:20','自然','自然教室'],[2,4,'11:20','英語','本班教室'],
      [1,1,'08:10','數學','本班教室'],[3,1,'08:10','英語','本班教室'],[4,1,'08:10','社會','本班教室'],[5,1,'08:10','班會','本班教室']
    ].map(([weekday,period,start_time,subject,location])=>({id:uid(),user_id:user,weekday:weekday as number,period:period as number,start_time:start_time as string,subject:subject as string,location:location as string})),
    student_records:[
      {id:uid(),user_id:user,student_id:byNo(8),record_date:isoDate(-5),record_type:'學習狀況',content:'近期作業完成度下降，已約定本週再次了解。',follow_up_date:isoDate()},
      {id:uid(),user_id:user,student_id:byNo(21),record_date:isoDate(-2),record_type:'家長聯絡',content:'已和家長討論到校狀況，明日回訪。',follow_up_date:isoDate(1)}],
    class_settings:[{id:uid(),user_id:user,class_name:'七年三班',school_year:'115 學年度',semester:'第一學期',teacher_name:'林老師'}]
  };
}

function authHeaders(config:CloudConfig, token?:string, json=true) {
  const h:Record<string,string>={apikey:config.key};
  if(token) h.Authorization=`Bearer ${token}`;
  if(json) h['Content-Type']='application/json';
  return h;
}
async function parseResponse(response:Response) {
  const text=await response.text();
  const body=text ? JSON.parse(text) : null;
  if(!response.ok) throw new Error(body?.msg || body?.message || body?.error_description || body?.hint || `連線失敗 (${response.status})`);
  return body;
}

export async function signIn(config:CloudConfig,email:string,password:string):Promise<Session> {
  const r=await fetch(`${config.url}/auth/v1/token?grant_type=password`,{method:'POST',headers:authHeaders(config),body:JSON.stringify({email,password})});
  return parseResponse(r);
}
export async function signUp(config:CloudConfig,email:string,password:string) {
  const r=await fetch(`${config.url}/auth/v1/signup`,{method:'POST',headers:authHeaders(config),body:JSON.stringify({email,password})}); return parseResponse(r);
}
export async function resetPassword(config:CloudConfig,email:string,redirectTo:string) {
  const r=await fetch(`${config.url}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`,{method:'POST',headers:authHeaders(config),body:JSON.stringify({email})}); return parseResponse(r);
}
export async function updatePassword(config:CloudConfig,token:string,password:string) {
  const r=await fetch(`${config.url}/auth/v1/user`,{method:'PUT',headers:authHeaders(config,token),body:JSON.stringify({password})}); return parseResponse(r);
}
export async function refreshSession(config:CloudConfig,refresh_token:string):Promise<Session> {
  const r=await fetch(`${config.url}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:authHeaders(config),body:JSON.stringify({refresh_token})}); return parseResponse(r);
}
export function sessionFromHash():Session|null {
  if(typeof location==='undefined') return null; const p=new URLSearchParams(location.hash.slice(1));
  const token=p.get('access_token'), refresh=p.get('refresh_token'); if(!token||!refresh) return null;
  const payload=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
  history.replaceState(null,'',location.pathname+location.search);
  return {access_token:token,refresh_token:refresh,expires_at:Number(p.get('expires_at')||0),user:{id:payload.sub,email:payload.email||''}};
}

export async function loadCloud(config:CloudConfig,session:Session):Promise<AppData> {
  const entries=await Promise.all(tableNames.map(async table=>{
    const order=table==='students'?'student_no.asc':table==='schedule'?'weekday.asc,period.asc':table==='tasks'?'due_at.asc':table==='student_records'?'record_date.desc':table==='attendance'?'date.desc':'';
    const query=`select=*${order?`&order=${order}`:''}`;
    const r=await fetch(`${config.url}/rest/v1/${table}?${query}`,{headers:authHeaders(config,session.access_token,false)}); return [table,await parseResponse(r)];
  }));
  return Object.fromEntries(entries) as AppData;
}

export async function cloudInsert<T>(config:CloudConfig,session:Session,table:string,row:T):Promise<T> {
  const r=await fetch(`${config.url}/rest/v1/${table}`,{method:'POST',headers:{...authHeaders(config,session.access_token),Prefer:'return=representation'},body:JSON.stringify(row)}); return (await parseResponse(r))[0];
}
export async function cloudUpdate<T>(config:CloudConfig,session:Session,table:string,id:string,patch:Partial<T>):Promise<T> {
  const r=await fetch(`${config.url}/rest/v1/${table}?id=eq.${id}`,{method:'PATCH',headers:{...authHeaders(config,session.access_token),Prefer:'return=representation'},body:JSON.stringify(patch)}); return (await parseResponse(r))[0];
}
export async function cloudDelete(config:CloudConfig,session:Session,table:string,id:string) {
  const r=await fetch(`${config.url}/rest/v1/${table}?id=eq.${id}`,{method:'DELETE',headers:authHeaders(config,session.access_token,false)}); await parseResponse(r);
}
export async function cloudReplace(config:CloudConfig,session:Session,data:AppData) {
  for(const table of [...tableNames].reverse()) { const r=await fetch(`${config.url}/rest/v1/${table}?user_id=eq.${session.user.id}`,{method:'DELETE',headers:authHeaders(config,session.access_token,false)}); await parseResponse(r); }
  for(const table of tableNames) if(data[table].length) { const rows=data[table].map(row=>({...row,user_id:session.user.id})); const r=await fetch(`${config.url}/rest/v1/${table}`,{method:'POST',headers:authHeaders(config,session.access_token),body:JSON.stringify(rows)}); await parseResponse(r); }
}

export function loadLocal():AppData { try { const raw=localStorage.getItem('teacher-desk-demo'); if(raw) return JSON.parse(raw); } catch {} const data=demoData(); saveLocal(data); return data; }
export function saveLocal(data:AppData) { localStorage.setItem('teacher-desk-demo',JSON.stringify(data)); }
