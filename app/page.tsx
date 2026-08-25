'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppData, Attendance, ClassSettings, CloudConfig, Schedule, Session, Student, StudentRecord, Task,
  cloudDelete, cloudInsert, cloudReplace, cloudUpdate, emptyData, loadCloud, loadLocal, resetPassword,
  saveLocal, sessionFromHash, signIn, signUp, tableNames, updatePassword,
} from './data';

type Page='dashboard'|'attendance'|'tasks'|'students'|'records'|'schedule'|'settings';
type EditState={table:keyof AppData; row:Record<string,unknown>}|null;
const labels:Record<Page,string>={dashboard:'今日總覽',attendance:'出缺勤',tasks:'待辦事項',students:'學生名冊',records:'個案紀錄',schedule:'課表設定',settings:'設定與資料'};
const icons:Record<Page,string>={dashboard:'今',attendance:'勤',tasks:'辦',students:'生',records:'記',schedule:'課',settings:'設'};
const statusLabels:Record<Attendance['status'],string>={present:'出席',late:'遲到',personal:'事假',sick:'病假',absent:'缺席'};
const weekdays=['一','二','三','四','五','六','日'];
const today=()=>new Date().toISOString().slice(0,10);
const formatDate=(value:string)=>value?new Intl.DateTimeFormat('zh-TW',{month:'numeric',day:'numeric'}).format(new Date(value)):'—';
const formatDateTime=(value:string)=>value?new Intl.DateTimeFormat('zh-TW',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value)):'—';
const download=(name:string,text:string,type='application/json;charset=utf-8')=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();URL.revokeObjectURL(a.href);};

export default function Home(){
  const [ready,setReady]=useState(false),[demo,setDemo]=useState(false),[busy,setBusy]=useState(false);
  const [config,setConfig]=useState<CloudConfig|null>(null),[session,setSession]=useState<Session|null>(null);
  const [data,setData]=useState<AppData>(emptyData),[page,setPage]=useState<Page>('dashboard'),[edit,setEdit]=useState<EditState>(null);
  const [toast,setToast]=useState(''),[query,setQuery]=useState(''),[attendanceDate,setAttendanceDate]=useState(today());
  const importRef=useRef<HTMLInputElement>(null);

  useEffect(()=>{
    const envUrl=process.env.NEXT_PUBLIC_SUPABASE_URL||'',envKey=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||'';
    const saved=localStorage.getItem('teacher-desk-cloud'); const cfg=envUrl&&envKey?{url:envUrl,key:envKey}:saved?JSON.parse(saved):null;
    const recovered=sessionFromHash(); const stored=localStorage.getItem('teacher-desk-session'); const sess=recovered||(stored?JSON.parse(stored):null);
    setConfig(cfg); setSession(sess); if(recovered) localStorage.setItem('teacher-desk-session',JSON.stringify(recovered)); setReady(true);
  },[]);
  useEffect(()=>{ if(!toast)return; const t=setTimeout(()=>setToast(''),3200); return()=>clearTimeout(t);},[toast]);
  useEffect(()=>{ if(!ready)return; if(demo){setData(loadLocal());return;} if(config&&session){setBusy(true);loadCloud(config,session).then(setData).catch(e=>{setToast(e.message);if(String(e.message).includes('JWT')) logout();}).finally(()=>setBusy(false));}},[ready,demo,config,session]);

  const settings=data.class_settings[0]||({id:'',user_id:session?.user.id||'demo-user',class_name:'我的班級',school_year:'',semester:'',teacher_name:'老師'} as ClassSettings);
  const students=data.students.filter(s=>!s.archived).sort((a,b)=>a.student_no-b.student_no);
  const studentName=(id:string|null)=>data.students.find(s=>s.id===id)?.name||'';
  const weekday=((new Date().getDay()+6)%7)+1;
  const todaySchedule=data.schedule.filter(s=>s.weekday===weekday).sort((a,b)=>a.period-b.period);
  const todayAttendance=data.attendance.filter(a=>a.date===today());
  const counts={present:0,late:0,personal:0,sick:0,absent:0}; todayAttendance.forEach(a=>counts[a.status]++);
  const openTasks=data.tasks.filter(t=>!t.completed).sort((a,b)=>a.due_at.localeCompare(b.due_at));
  const followUps=data.student_records.filter(r=>r.follow_up_date&&r.follow_up_date<=new Date(Date.now()+7*86400000).toISOString().slice(0,10)).sort((a,b)=>(a.follow_up_date||'').localeCompare(b.follow_up_date||''));

  function commit(next:AppData){setData(next);if(demo)saveLocal(next);}
  async function mutate(table:keyof AppData,row:Record<string,unknown>,patch?:Record<string,unknown>){
    setBusy(true);try{
      const user_id=session?.user.id||'demo-user';
      if(row.id){const saved=demo?{...row,...patch}:await cloudUpdate(config!,session!,table,row.id as string,patch||row);commit({...data,[table]:data[table].map((x:any)=>x.id===row.id?saved:x)} as AppData);}
      else {const input={...row,id:crypto.randomUUID(),user_id};const saved=demo?input:await cloudInsert(config!,session!,table,input);commit({...data,[table]:[...data[table],saved]} as AppData);}
      setEdit(null);setToast('已同步保存');
    }catch(e){setToast((e as Error).message);}finally{setBusy(false);}
  }
  async function remove(table:keyof AppData,id:string){if(!confirm('確定要刪除這筆資料嗎？此操作無法復原。'))return;setBusy(true);try{if(!demo)await cloudDelete(config!,session!,table,id);commit({...data,[table]:data[table].filter((x:any)=>x.id!==id)} as AppData);setToast('已刪除');}catch(e){setToast((e as Error).message);}finally{setBusy(false);}}
  async function updateAttendance(student:Student,status:Attendance['status']){
    const old=data.attendance.find(a=>a.student_id===student.id&&a.date===attendanceDate);
    if(old)await mutate('attendance',old,{status}); else await mutate('attendance',{student_id:student.id,date:attendanceDate,status,notes:''});
  }
  function logout(){localStorage.removeItem('teacher-desk-session');setSession(null);setData(emptyData);setDemo(false);}
  function startDemo(){setDemo(true);setSession(null);setData(loadLocal());}

  if(!ready)return <div className="loadingPage">正在準備工作台…</div>;
  if(!demo&&(!config||!session))return <AuthScreen config={config} onConfig={cfg=>{localStorage.setItem('teacher-desk-cloud',JSON.stringify(cfg));setConfig(cfg);}} onSession={s=>{localStorage.setItem('teacher-desk-session',JSON.stringify(s));setSession(s);}} onDemo={startDemo}/>;

  const pageProps={data,students,studentName,query,setQuery,setEdit,remove,busy};
  return <main className="shell">
    <aside className="sidebar">
      <div className="brand"><span className="brandMark">班</span><span>班主任工作台</span></div>
      <nav className="nav" aria-label="主要導覽">{(Object.keys(labels) as Page[]).map(p=><button key={p} className={`navItem ${page===p?'active':''}`} onClick={()=>setPage(p)}><span>{icons[p]}</span>{labels[p]}</button>)}</nav>
      <div className="sidebarFoot"><div className="avatar">{settings.teacher_name.slice(0,1)}</div><div><strong>{settings.teacher_name}</strong><small>{settings.class_name}</small></div><button title="登出" onClick={logout}>↗</button></div>
    </aside>
    <section className="workspace">
      <header className="topbar"><div><p>{new Intl.DateTimeFormat('zh-TW',{year:'numeric',month:'long',day:'numeric',weekday:'long'}).format(new Date())}</p><h1>{page==='dashboard'?`早安，${settings.teacher_name}`:labels[page]}</h1></div><div className="topActions"><span className={`syncDot ${demo?'demo':''}`}>{busy?'同步中…':demo?'示範模式':'已同步'}</span><button className="ghostButton" onClick={()=>setPage('settings')}>設定</button><button className="primaryButton" onClick={()=>setEdit({table:'tasks',row:{}})}>＋ 快速新增</button></div></header>
      {demo&&<div className="demoBanner"><strong>示範模式</strong>　資料只保存在這台裝置。設定 Supabase 後即可跨裝置同步。<button onClick={()=>{setDemo(false);setData(emptyData);}}>設定雲端</button></div>}
      <div className="content">
        {page==='dashboard'&&<Dashboard settings={settings} students={students} schedule={todaySchedule} counts={counts} tasks={openTasks} records={followUps} studentName={studentName} onPage={setPage} onEdit={setEdit}/>} 
        {page==='attendance'&&<AttendancePage students={students} records={data.attendance} date={attendanceDate} setDate={setAttendanceDate} update={updateAttendance} markAll={()=>Promise.all(students.map(s=>updateAttendance(s,'present')))}/>} 
        {page==='tasks'&&<TasksPage {...pageProps} tasks={data.tasks} toggle={t=>mutate('tasks',t,{completed:!t.completed})}/>} 
        {page==='students'&&<StudentsPage {...pageProps}/>} 
        {page==='records'&&<RecordsPage {...pageProps} records={data.student_records}/>} 
        {page==='schedule'&&<SchedulePage {...pageProps} schedule={data.schedule}/>} 
        {page==='settings'&&<SettingsPage settings={settings} demo={demo} email={session?.user.email||''} save={row=>mutate('class_settings',row)} exportJson={()=>download(`班主任工作台-${today()}.json`,JSON.stringify(data,null,2))} exportCsv={()=>exportCsv(data)} importClick={()=>importRef.current?.click()} changePassword={async password=>{if(!config||!session)return;await updatePassword(config,session.access_token,password);setToast('密碼已更新');}} logout={logout}/>} 
      </div>
    </section>
    <nav className="mobileNav" aria-label="平板導覽">{(['dashboard','attendance','tasks','students','settings'] as Page[]).map(p=><button key={p} className={page===p?'active':''} onClick={()=>setPage(p)}><span>{icons[p]}</span>{labels[p].replace('今日總覽','今日').replace('待辦事項','待辦').replace('學生名冊','學生').replace('設定與資料','更多')}</button>)}</nav>
    {edit&&<Editor edit={edit} students={students} onClose={()=>setEdit(null)} onSave={(row)=>mutate(edit.table,row)}/>} 
    <input ref={importRef} hidden type="file" accept="application/json" onChange={async e=>{const f=e.target.files?.[0];if(!f)return;try{const imported=JSON.parse(await f.text()) as AppData;if(!tableNames.every(t=>Array.isArray(imported[t])))throw new Error('備份格式不正確');if(!confirm('還原會取代目前所有資料，確定繼續嗎？'))return;setBusy(true);if(demo)saveLocal(imported);else await cloudReplace(config!,session!,imported);setData(demo?imported:await loadCloud(config!,session!));setToast('備份已還原');}catch(err){setToast((err as Error).message);}finally{setBusy(false);e.target.value='';}}}/>
    {toast&&<div className="toast" role="status">{toast}</div>}
  </main>;
}

function AuthScreen({config,onConfig,onSession,onDemo}:{config:CloudConfig|null;onConfig:(c:CloudConfig)=>void;onSession:(s:Session)=>void;onDemo:()=>void}){
  const [mode,setMode]=useState<'login'|'signup'|'reset'|'config'>(config?'login':'config'),[busy,setBusy]=useState(false),[msg,setMsg]=useState('');
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const form=new FormData(e.currentTarget);setBusy(true);setMsg('');try{
    if(mode==='config'){const url=String(form.get('url')).replace(/\/$/,'');const key=String(form.get('key'));if(!url.startsWith('https://')||!key)throw new Error('請輸入有效的 Supabase HTTPS 網址與 Publishable Key');onConfig({url,key});setMode('login');setMsg('雲端連線設定已保存');return;}
    if(!config)throw new Error('請先設定雲端連線');const email=String(form.get('email')),password=String(form.get('password'));
    if(mode==='login')onSession(await signIn(config,email,password));
    if(mode==='signup'){await signUp(config,email,password);setMsg('帳號已建立。若專案要求 Email 驗證，請先到信箱確認。');setMode('login');}
    if(mode==='reset'){await resetPassword(config,email,location.origin);setMsg('密碼重設信已寄出，請查看信箱。');}
  }catch(err){setMsg((err as Error).message);}finally{setBusy(false);}}
  return <main className="authPage"><section className="authIntro"><div className="brand authBrand"><span className="brandMark">班</span><span>班主任工作台</span></div><div><span className="eyebrow">每天，從掌握全班開始</span><h1>課表、出勤、待辦<br/>與學生追蹤，一處完成。</h1><p>為班主任整理每天真正需要處理的資訊，讓平板與電腦保持一致。</p></div><div className="authFeature"><b>今日重點</b><span>快速點名、即將到期的任務、需要回訪的學生。</span></div></section>
    <section className="authFormWrap"><form className="authCard" onSubmit={submit}>
      <span className="eyebrow">SECURE WORKSPACE</span><h2>{mode==='login'?'登入工作台':mode==='signup'?'建立老師帳號':mode==='reset'?'重設密碼':'連接 Supabase'}</h2><p>{mode==='config'?'輸入 Supabase 專案的公開連線資訊；管理員密鑰絕不可填在這裡。':'學生資料只會顯示給已登入的帳號。'}</p>
      {mode==='config'?<><label>Project URL<input name="url" type="url" placeholder="https://xxxxx.supabase.co" required/></label><label>Publishable／Anon Key<textarea name="key" rows={3} required/></label></>:<><label>Email<input name="email" type="email" autoComplete="email" required/></label>{mode!=='reset'&&<label>密碼<input name="password" type="password" minLength={8} autoComplete={mode==='login'?'current-password':'new-password'} required/></label>}</>}
      {msg&&<div className="formMessage">{msg}</div>}<button className="authSubmit" disabled={busy}>{busy?'請稍候…':mode==='login'?'登入':mode==='signup'?'建立帳號':mode==='reset'?'寄送重設信':'保存連線設定'}</button>
      <div className="authLinks">{mode==='login'&&<><button type="button" onClick={()=>setMode('signup')}>建立帳號</button><button type="button" onClick={()=>setMode('reset')}>忘記密碼</button></>}{mode!=='login'&&mode!=='config'&&<button type="button" onClick={()=>setMode('login')}>返回登入</button>}{config&&<button type="button" onClick={()=>setMode('config')}>變更雲端設定</button>}</div>
      <div className="divider"><span>或</span></div><button className="demoButton" type="button" onClick={onDemo}>先試用示範資料</button>
    </form></section>
  </main>;
}

function Dashboard({settings,students,schedule,counts,tasks,records,studentName,onPage,onEdit}:{settings:ClassSettings;students:Student[];schedule:Schedule[];counts:Record<string,number>;tasks:Task[];records:StudentRecord[];studentName:(id:string|null)=>string;onPage:(p:Page)=>void;onEdit:(e:EditState)=>void}){
  const attended=counts.present+counts.late,excused=counts.personal+counts.sick;
  return <><section className="heroCard"><div><span className="eyebrow">今日班級狀況</span><h2>{settings.class_name}</h2><p>{schedule.length?`第一節 ${schedule[0].start_time.slice(0,5)} 開始`:'今天尚未設定課表'}，目前有 {tasks.length} 件待辦需要留意。</p></div><button className="attendanceButton" onClick={()=>onPage('attendance')}>開始點名 <span>→</span></button></section>
    <div className="statGrid">{[['應到',students.length,'ink'],['出席',attended,'green'],['請假',excused,'amber'],['缺席',counts.absent,'red']].map(([l,v,t])=><article className={`statCard ${t}`} key={l}><span>{l}</span><strong>{v}</strong><small>人</small></article>)}</div>
    <div className="dashboardGrid"><section className="panel schedulePanel"><PanelHead eyebrow="TODAY" title="今日課表" action="完整課表" onClick={()=>onPage('schedule')}/><div className="lessonList">{schedule.length?schedule.slice(0,4).map((lesson,i)=><div className={`lesson ${i===0?'active':''}`} key={lesson.id}><time>{lesson.start_time.slice(0,5)}</time><span className="lessonIndex"/><div><strong>{lesson.subject}</strong><small>{lesson.location}</small></div>{i===0&&<em>下一節</em>}</div>):<Empty text="尚未設定今天的課表"/>}</div></section>
      <section className="panel taskPanel"><PanelHead eyebrow="ACTION" title="待辦提醒" action="全部待辦" onClick={()=>onPage('tasks')} tone="coral"/>{tasks.length?tasks.slice(0,3).map(t=><button className={`task ${t.due_at<new Date().toISOString().slice(0,16)?'urgent':''}`} key={t.id} onClick={()=>onEdit({table:'tasks',row:t as any})}><span className="check"/><div><strong>{t.title}</strong><small>{formatDateTime(t.due_at)}・{t.category}</small></div><b>{t.due_at.slice(0,10)<today()?'逾期':t.due_at.slice(0,10)===today()?'今天':'近期'}</b></button>):<Empty text="今天沒有待辦事項"/>}</section>
      <section className="panel followPanel"><PanelHead eyebrow="FOLLOW UP" title="學生追蹤" action="查看紀錄" onClick={()=>onPage('records')} tone="blue"/>{records.length?records.slice(0,4).map((r,i)=><button className="studentRow" key={r.id} onClick={()=>onEdit({table:'student_records',row:r as any})}><span className={`studentAvatar ${i%2?'mint':'lavender'}`}>{dataNo(students,r.student_id)}</span><div><strong>{studentName(r.student_id)}</strong><small>{r.record_type}・{r.follow_up_date===today()?'今天':formatDate(r.follow_up_date||'')}</small></div><span className="arrow">→</span></button>):<Empty text="近期沒有需要追蹤的學生"/>}</section></div></>;
}
function PanelHead({eyebrow,title,action,onClick,tone='' }:{eyebrow:string;title:string;action:string;onClick:()=>void;tone?:string}){return <div className="panelHead"><div><span className={`eyebrow ${tone}`}>{eyebrow}</span><h3>{title}</h3></div><button onClick={onClick}>{action}</button></div>}
function Empty({text}:{text:string}){return <div className="empty">{text}</div>}
function dataNo(students:Student[],id:string){return String(students.find(s=>s.id===id)?.student_no||'—').padStart(2,'0')}

function AttendancePage({students,records,date,setDate,update,markAll}:{students:Student[];records:Attendance[];date:string;setDate:(d:string)=>void;update:(s:Student,v:Attendance['status'])=>void;markAll:()=>void}){
  const byStudent=(id:string)=>records.find(a=>a.student_id===id&&a.date===date);
  const counts=Object.fromEntries(Object.keys(statusLabels).map(k=>[k,students.filter(s=>(byStudent(s.id)?.status||'present')===k).length]));
  return <section className="pageSection"><div className="sectionTitle"><div><span className="eyebrow">ATTENDANCE</span><h2>每日點名</h2><p>一鍵標記全班出席，再調整個別學生狀態。</p></div><div className="sectionActions"><input type="date" value={date} onChange={e=>setDate(e.target.value)}/><button className="primaryButton" onClick={markAll}>全班出席</button></div></div>
    <div className="miniStats">{Object.entries(statusLabels).map(([k,l])=><span key={k} className={k}><b>{counts[k]}</b>{l}</span>)}</div>
    <div className="attendanceList"><div className="tableHead"><span>座號</span><span>學生</span><span>出勤狀態</span></div>{students.map(s=><div className="attendanceRow" key={s.id}><b>{String(s.student_no).padStart(2,'0')}</b><strong>{s.name}</strong><div className="statusPicker">{Object.entries(statusLabels).map(([v,l])=><button key={v} className={(byStudent(s.id)?.status||'present')===v?v:''} onClick={()=>update(s,v as Attendance['status'])}>{l}</button>)}</div></div>)}</div>
  </section>;
}

type CommonProps={data:AppData;students:Student[];studentName:(id:string|null)=>string;query:string;setQuery:(s:string)=>void;setEdit:(e:EditState)=>void;remove:(t:keyof AppData,id:string)=>void;busy:boolean};
function PageHeader({eyebrow,title,description,search,onAdd,addLabel='新增'}:{eyebrow:string;title:string;description:string;search?:{value:string;set:(v:string)=>void};onAdd:()=>void;addLabel?:string}){return <div className="sectionTitle"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{description}</p></div><div className="sectionActions">{search&&<input type="search" placeholder="搜尋…" value={search.value} onChange={e=>search.set(e.target.value)}/>}<button className="primaryButton" onClick={onAdd}>＋ {addLabel}</button></div></div>}
function TasksPage({data,students,studentName,query,setQuery,setEdit,remove,toggle}:CommonProps&{tasks:Task[];toggle:(t:Task)=>void}){const rows=data.tasks.filter(t=>t.title.includes(query)||studentName(t.student_id).includes(query)).sort((a,b)=>Number(a.completed)-Number(b.completed)||a.due_at.localeCompare(b.due_at));return <section className="pageSection"><PageHeader eyebrow="TASKS" title="待辦事項" description="把班級、行政與學生相關工作放在同一份清單。" search={{value:query,set:setQuery}} onAdd={()=>setEdit({table:'tasks',row:{}})} addLabel="新增待辦"/><div className="dataCards">{rows.map(t=><article className={`dataCard taskData ${t.completed?'completed':''}`} key={t.id}><button className="roundCheck" onClick={()=>toggle(t)}>{t.completed?'✓':''}</button><div><div className="tagLine"><span className={`priority ${t.priority}`}>{t.priority==='high'?'高優先':t.priority==='low'?'低優先':'一般'}</span><span>{t.category}</span>{t.student_id&&<span>{studentName(t.student_id)}</span>}</div><h3>{t.title}</h3><p>{formatDateTime(t.due_at)}</p></div><div className="rowActions"><button onClick={()=>setEdit({table:'tasks',row:t as any})}>編輯</button><button className="danger" onClick={()=>remove('tasks',t.id)}>刪除</button></div></article>)}{!rows.length&&<Empty text="沒有符合條件的待辦"/>}</div></section>}
function StudentsPage({students,query,setQuery,setEdit}:CommonProps){const rows=students.filter(s=>s.name.includes(query)||String(s.student_no).includes(query)||s.tags.some(t=>t.includes(query)));return <section className="pageSection"><PageHeader eyebrow="STUDENTS" title="學生名冊" description={`目前共有 ${students.length} 位在班學生。`} search={{value:query,set:setQuery}} onAdd={()=>setEdit({table:'students',row:{}})} addLabel="新增學生"/><div className="studentGrid">{rows.map((s,i)=><article className="studentCard" key={s.id}><div className={`studentAvatar ${i%3===0?'lavender':i%3===1?'mint':'peach'}`}>{String(s.student_no).padStart(2,'0')}</div><div className="studentCardMain"><h3>{s.name}</h3><p>{s.guardian_name||'未填監護人'} · {s.guardian_phone||'未填電話'}</p><div className="tags">{s.tags.map(t=><span key={t}>{t}</span>)}</div></div><button onClick={()=>setEdit({table:'students',row:s as any})}>管理</button></article>)}{!rows.length&&<Empty text="找不到學生"/>}</div></section>}
function RecordsPage({records,students,studentName,query,setQuery,setEdit,remove}:CommonProps&{records:StudentRecord[]}){const rows=records.filter(r=>r.content.includes(query)||r.record_type.includes(query)||studentName(r.student_id).includes(query)).sort((a,b)=>b.record_date.localeCompare(a.record_date));return <section className="pageSection"><PageHeader eyebrow="RECORDS" title="個案紀錄" description="留下談話、家長聯絡與日常觀察，安排下一次追蹤。" search={{value:query,set:setQuery}} onAdd={()=>setEdit({table:'student_records',row:{}})} addLabel="新增紀錄"/><div className="recordTimeline">{rows.map(r=><article className="recordCard" key={r.id}><div className="recordDate"><b>{formatDate(r.record_date)}</b><span>{r.record_type}</span></div><div><h3>{studentName(r.student_id)} <small>座號 {dataNo(students,r.student_id)}</small></h3><p>{r.content}</p>{r.follow_up_date&&<em>追蹤：{formatDate(r.follow_up_date)}</em>}</div><div className="rowActions"><button onClick={()=>setEdit({table:'student_records',row:r as any})}>編輯</button><button className="danger" onClick={()=>remove('student_records',r.id)}>刪除</button></div></article>)}{!rows.length&&<Empty text="尚無個案紀錄"/>}</div></section>}
function SchedulePage({schedule,setEdit,remove}:CommonProps&{schedule:Schedule[]}){return <section className="pageSection"><PageHeader eyebrow="SCHEDULE" title="每週課表" description="設定每一天的節次、時間、科目與上課地點。" onAdd={()=>setEdit({table:'schedule',row:{}})} addLabel="新增課程"/><div className="weekGrid">{weekdays.slice(0,5).map((d,i)=><section className="dayColumn" key={d}><h3>星期{d}</h3>{schedule.filter(s=>s.weekday===i+1).sort((a,b)=>a.period-b.period).map(s=><article key={s.id}><span>第 {s.period} 節 · {s.start_time.slice(0,5)}</span><strong>{s.subject}</strong><small>{s.location}</small><div><button onClick={()=>setEdit({table:'schedule',row:s as any})}>編輯</button><button onClick={()=>remove('schedule',s.id)}>刪除</button></div></article>)}{!schedule.some(s=>s.weekday===i+1)&&<Empty text="尚無課程"/>}</section>)}</div></section>}
function SettingsPage({settings,demo,email,save,exportJson,exportCsv,importClick,changePassword,logout}:{settings:ClassSettings;demo:boolean;email:string;save:(s:Record<string,unknown>)=>void;exportJson:()=>void;exportCsv:()=>void;importClick:()=>void;changePassword:(p:string)=>Promise<void>;logout:()=>void}){const [row,setRow]=useState(settings),[password,setPassword]=useState('');useEffect(()=>setRow(settings),[settings]);return <section className="pageSection"><div className="sectionTitle"><div><span className="eyebrow">SETTINGS</span><h2>設定與資料</h2><p>管理班級資訊、帳號安全與資料備份。</p></div></div><div className="settingsGrid"><form className="settingsCard" onSubmit={e=>{e.preventDefault();save(row as any)}}><h3>班級基本資料</h3><div className="formGrid"><label>班級名稱<input value={row.class_name} onChange={e=>setRow({...row,class_name:e.target.value})}/></label><label>老師名稱<input value={row.teacher_name} onChange={e=>setRow({...row,teacher_name:e.target.value})}/></label><label>學年<input value={row.school_year} onChange={e=>setRow({...row,school_year:e.target.value})}/></label><label>學期<input value={row.semester} onChange={e=>setRow({...row,semester:e.target.value})}/></label></div><button className="primaryButton">保存設定</button></form><section className="settingsCard"><h3>備份與匯出</h3><p>JSON 可完整還原工作台；CSV 適合用試算表查看。</p><div className="buttonStack"><button onClick={exportJson}>匯出完整 JSON</button><button onClick={exportCsv}>匯出 CSV</button><button onClick={importClick}>從 JSON 還原</button></div></section><section className="settingsCard"><h3>帳號安全</h3><p>{demo?'示範模式沒有登入帳號。':email}</p>{!demo&&<form onSubmit={async e=>{e.preventDefault();await changePassword(password);setPassword('')}}><label>新密碼<input type="password" minLength={8} value={password} onChange={e=>setPassword(e.target.value)} required/></label><button>更新密碼</button></form>}<button className="dangerButton" onClick={logout}>{demo?'離開示範模式':'登出工作台'}</button></section></div></section>}

function Editor({edit,students,onClose,onSave}:{edit:NonNullable<EditState>;students:Student[];onClose:()=>void;onSave:(r:Record<string,unknown>)=>void}){
  const row=edit.row as any; const [tags,setTags]=useState((row.tags||[]).join('、'));
  function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const values=Object.fromEntries(new FormData(e.currentTarget));const base={...row,...values};if(edit.table==='students'){base.student_no=Number(base.student_no);base.tags=tags.split(/[、,]/).map((x:string)=>x.trim()).filter(Boolean);base.archived=Boolean(row.archived);}if(edit.table==='schedule'){base.weekday=Number(base.weekday);base.period=Number(base.period);}if(edit.table==='tasks')base.student_id=base.student_id||null;if(edit.table==='student_records')base.follow_up_date=base.follow_up_date||null;onSave(base);}
  const title=edit.table==='students'?'學生資料':edit.table==='tasks'?'待辦事項':edit.table==='student_records'?'個案紀錄':'課程';
  return <div className="modalBack" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><form className="modal" onSubmit={submit}><div className="modalHead"><div><span className="eyebrow">EDITOR</span><h2>{row.id?'編輯':'新增'}{title}</h2></div><button type="button" onClick={onClose}>×</button></div>
    {edit.table==='students'&&<div className="formGrid"><label>座號<input name="student_no" type="number" min="1" defaultValue={row.student_no} required/></label><label>姓名<input name="name" defaultValue={row.name} required/></label><label>監護人<input name="guardian_name" defaultValue={row.guardian_name}/></label><label>聯絡電話<input name="guardian_phone" defaultValue={row.guardian_phone}/></label><label className="wide">標籤（以頓號分隔）<input value={tags} onChange={e=>setTags(e.target.value)}/></label><label className="wide">基本備註<textarea name="notes" rows={4} defaultValue={row.notes}/></label>{row.id&&<label className="wide checkLabel"><input type="checkbox" checked={Boolean(row.archived)} onChange={e=>row.archived=e.target.checked}/> 封存此學生</label>}</div>}
    {edit.table==='tasks'&&<div className="formGrid"><label className="wide">待辦內容<input name="title" defaultValue={row.title} required/></label><label>期限<input name="due_at" type="datetime-local" defaultValue={row.due_at?.slice(0,16)||`${today()}T16:00`} required/></label><label>優先程度<select name="priority" defaultValue={row.priority||'normal'}><option value="low">低</option><option value="normal">一般</option><option value="high">高</option></select></label><label>分類<input name="category" defaultValue={row.category||'班級事務'}/></label><label>關聯學生<select name="student_id" defaultValue={row.student_id||''}><option value="">不指定</option>{students.map(s=><option key={s.id} value={s.id}>{s.student_no}　{s.name}</option>)}</select></label></div>}
    {edit.table==='student_records'&&<div className="formGrid"><label>學生<select name="student_id" defaultValue={row.student_id||''} required><option value="">請選擇</option>{students.map(s=><option key={s.id} value={s.id}>{s.student_no}　{s.name}</option>)}</select></label><label>紀錄日期<input name="record_date" type="date" defaultValue={row.record_date||today()} required/></label><label>紀錄類型<select name="record_type" defaultValue={row.record_type||'日常觀察'}><option>日常觀察</option><option>談話紀錄</option><option>家長聯絡</option><option>學習狀況</option><option>其他事件</option></select></label><label>下次追蹤<input name="follow_up_date" type="date" defaultValue={row.follow_up_date||''}/></label><label className="wide">內容<textarea name="content" rows={6} defaultValue={row.content} required/></label></div>}
    {edit.table==='schedule'&&<div className="formGrid"><label>星期<select name="weekday" defaultValue={row.weekday||1}>{weekdays.slice(0,5).map((d,i)=><option key={d} value={i+1}>星期{d}</option>)}</select></label><label>節次<input name="period" type="number" min="1" defaultValue={row.period||1} required/></label><label>開始時間<input name="start_time" type="time" defaultValue={row.start_time?.slice(0,5)||'08:10'} required/></label><label>科目<input name="subject" defaultValue={row.subject} required/></label><label className="wide">地點<input name="location" defaultValue={row.location||'本班教室'}/></label></div>}
    <div className="modalActions"><button type="button" onClick={onClose}>取消</button><button className="primaryButton">保存並同步</button></div></form></div>;
}

function exportCsv(data:AppData){const q=(v:unknown)=>`"${String(v??'').replace(/"/g,'""')}"`;let csv='類型,日期,座號,學生,狀態或分類,內容\r\n';for(const a of data.attendance){const s=data.students.find(x=>x.id===a.student_id);csv+=['出勤',a.date,s?.student_no,s?.name,statusLabels[a.status],a.notes].map(q).join(',')+'\r\n';}for(const r of data.student_records){const s=data.students.find(x=>x.id===r.student_id);csv+=['個案紀錄',r.record_date,s?.student_no,s?.name,r.record_type,r.content].map(q).join(',')+'\r\n';}download(`班主任資料-${today()}.csv`,'\ufeff'+csv,'text/csv;charset=utf-8');}
