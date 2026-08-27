'use client';

import { FormEvent, useState } from 'react';
import { ClassRole, ClassRoleMember, Student } from './data';

type Props = {
  students: Student[];
  roles: ClassRole[];
  members: ClassRoleMember[];
  addRole: (name:string)=>Promise<void>;
  removeRole: (role:ClassRole)=>Promise<void>;
  addMember: (roleId:string,studentId:string)=>Promise<void>;
  removeMember: (id:string)=>void;
};

const today=()=>new Date().toISOString().slice(0,10);
const csvValue=(value:unknown)=>`"${String(value??'').replace(/"/g,'""')}"`;

export default function ClassRolesPage({students,roles,members,addRole,removeRole,addMember,removeMember}:Props){
  const [newRole,setNewRole]=useState('');
  const [selected,setSelected]=useState<Record<string,string>>({});
  const sorted=[...roles].sort((a,b)=>a.sort_order-b.sort_order||a.name.localeCompare(b.name));
  const student=(id:string)=>students.find(item=>item.id===id);

  async function submitRole(e:FormEvent){
    e.preventDefault();
    const name=newRole.trim();
    if(!name||roles.some(role=>role.name===name))return;
    await addRole(name);
    setNewRole('');
  }

  async function assign(roleId:string){
    const studentId=selected[roleId];
    if(!studentId)return;
    await addMember(roleId,studentId);
    setSelected(prev=>({...prev,[roleId]:''}));
  }

  function exportCsv(){
    let csv='崗位,學號,學生\r\n';
    for(const role of sorted){
      const assigned=members.filter(member=>member.role_id===role.id);
      if(!assigned.length)csv+=[role.name,'',''].map(csvValue).join(',')+'\r\n';
      for(const member of assigned){
        const item=student(member.student_id);
        csv+=[role.name,item?.student_no||'',item?.name||'已刪除學生'].map(csvValue).join(',')+'\r\n';
      }
    }
    const link=document.createElement('a');
    link.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));
    link.download=`班幹事-${today()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return <section className="pageSection">
    <div className="sectionTitle"><div><span className="eyebrow">CLASS OFFICERS</span><h2>班幹事</h2><p>每個崗位可安排多名學生，同一名學生亦可擔任不同崗位。</p></div><div className="sectionActions"><button onClick={exportCsv}>匯出名單</button></div></div>
    <form className="roleAdder" onSubmit={submitRole}><input aria-label="新增崗位名稱" value={newRole} onChange={e=>setNewRole(e.target.value)} placeholder="新增崗位"/><button className="primaryButton" disabled={!newRole.trim()}>＋ 新增崗位</button></form>
    <div className="homeworkSubjects">{sorted.map(role=>{
      const assigned=members.filter(member=>member.role_id===role.id);
      const available=students.filter(item=>!assigned.some(member=>member.student_id===item.id));
      return <article className="homeworkSubject" key={role.id}>
        <div className="subjectName"><i aria-hidden="true">•</i><strong>{role.name}</strong><span>{assigned.length} 人</span><button aria-label={`刪除${role.name}崗位`} onClick={()=>removeRole(role)}>×</button></div>
        <div className="subjectAssign"><select aria-label={`選擇${role.name}幹事`} value={selected[role.id]||''} onChange={e=>setSelected(prev=>({...prev,[role.id]:e.target.value}))}><option value="">選擇學生…</option>{available.map(item=><option key={item.id} value={item.id}>{String(item.student_no).padStart(2,'0')}　{item.name}</option>)}</select><button type="button" disabled={!selected[role.id]} onClick={()=>assign(role.id)}>加入</button></div>
        <div className={`owingStudents ${!assigned.length?'emptyOwing':''}`}>{assigned.length?assigned.map(member=>{const item=student(member.student_id);return <span key={member.id}><b>{item?String(item.student_no).padStart(2,'0'):'—'}</b>{item?.name||'已刪除學生'}<button aria-label={`移除${item?.name||'學生'}的${role.name}職務`} onClick={()=>removeMember(member.id)}>×</button></span>}):<em>尚未安排學生</em>}</div>
      </article>;
    })}{!sorted.length&&<div className="empty">尚未設定崗位，請先新增。</div>}</div>
  </section>;
}
