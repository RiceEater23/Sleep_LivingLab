import { Bell, CircleHelp, LockKeyhole } from 'lucide-react';
import { useState } from 'react';
import { defaults, type Profile } from './model';
import { native, type NativeStatus } from './native';

export default function SettingsPanel({profile,save,access}:{profile?:Profile;save:(p:Profile)=>void;access?:NativeStatus}) {
 const [p,set]=useState<Profile>(profile||defaults);
 const change=<K extends keyof Profile>(k:K,v:Profile[K])=>set(a=>({...a,[k]:v}));
 const goal=<K extends keyof Profile['goals']>(k:K,v:Profile['goals'][K])=>set(a=>({...a,goals:{...a.goals,[k]:v}}));
 const options=(values:string[])=>values.map(v=><option key={v}>{v}</option>);
 return <form className="stack" autoComplete="off" onSubmit={e=>{e.preventDefault();save(p);}}>
  <section className="paper panel"><h2>나의 기본 정보</h2><p>수면 일지를 시작하기 전에 알려 주세요.</p><div className="fields three">
   <label htmlFor="age">연령대 *<select id="age" name="age" aria-label="연령대" required value={p.age} onChange={e=>change('age',e.target.value)}><option value="">선택해 주세요</option>{options(['10대 이하','20대','30대','40대','50대','60대','70대 이상'])}</select></label>
   <label htmlFor="gender">성별 (선택)<select id="gender" name="gender" aria-label="성별 (선택)" value={p.gender} onChange={e=>change('gender',e.target.value)}><option value="">선택 안 함</option>{options(['여성','남성','기타','응답하지 않음'])}</select></label>
   <label htmlFor="job">직업군 (선택)<select id="job" name="job" aria-label="직업군 (선택)" value={p.job} onChange={e=>change('job',e.target.value)}><option value="">선택 안 함</option>{options(['학생','사무직','교대 근무','서비스·현장직','프리랜서·자영업','해당 없음','기타'])}</select></label>
  </div></section>
  <section className="paper panel"><h2>평소 수면 일정</h2><div className="button-group" aria-label="평소 수면 일정">{(['regular','irregular'] as const).map((s,i)=><button key={s} type="button" className="chip" aria-pressed={p.schedule===s} onClick={()=>change('schedule',s)}>{i?'불규칙적':'규칙적'}</button>)}</div>{p.schedule==='regular'?<div className="fields"><label>평소 취침 시각<input required type="time" value={p.bed} onChange={e=>change('bed',e.target.value)}/></label><label>평소 기상 시각<input required type="time" value={p.wake} onChange={e=>change('wake',e.target.value)}/></label></div>:<p>홈에서 그날의 예정 취침 시각을 입력하거나 건너뛸 수 있어요.</p>}</section>
  <section className="paper panel"><h2>수면 목표</h2><p>변경한 목표는 새로 시작하는 기록에만 적용돼요.</p><div className="fields three"><label>목표 수면시간 (시간)<input type="number" min="0.5" max="24" step="0.5" value={p.goals.hours} onChange={e=>goal('hours',e.target.value===''?'':Number(e.target.value))}/></label><label>목표 취침 시각<input type="time" value={p.goals.bed} onChange={e=>goal('bed',e.target.value)}/></label><label>목표 기상 시각<input type="time" value={p.goals.wake} onChange={e=>goal('wake',e.target.value)}/></label><label>시각 목표 허용 오차 (분)<input required type="number" min="0" max="120" value={p.goals.tolerance} onChange={e=>goal('tolerance',e.target.valueAsNumber)}/></label></div>{!native&&<p className="inline-info"><CircleHelp size={17}/> 기상 알람은 iPhone 시계 앱에서 설정해 주세요.</p>}</section>
  <section className="paper panel"><h2>약 복용 체크</h2><p>선택한 체크리스트에만 표시돼요. 설문 점수에는 포함되지 않아요.</p><div className="check-row"><label><input type="checkbox" checked={p.medBefore} onChange={e=>change('medBefore',e.target.checked)}/> 수면 전</label><label><input type="checkbox" checked={p.medAfter} onChange={e=>change('medAfter',e.target.checked)}/> 수면 후</label></div></section>
  {native&&<section className="paper panel"><h2><Bell size={20}/> 안드로이드 알람 및 알림</h2>
   <div className="check-row"><label><input type="checkbox" checked={p.alarm} onChange={e=>change('alarm',e.target.checked)}/> 기상 알람</label><label><input type="checkbox" checked={p.reminders} onChange={e=>change('reminders',e.target.checked)}/> 체크리스트 알림</label></div>
   <div className="button-group"><button type="button" className="chip" onClick={()=>native?.openPermission('alarm')}>정확한 알람 권한 · {access?.alarm?'허용됨':'비허용'}</button><button type="button" className="chip" onClick={()=>native?.openPermission('notifications')}>알림 권한 · {access?.notifications?'허용됨':'비허용'}</button>{access?.notifications&&!access.alarmChannel&&<button type="button" className="chip" onClick={()=>native?.openPermission('alarmChannel')}>기상 알람 채널 설정</button>}{access?.notifications&&!access.checklistChannel&&<button type="button" className="chip" onClick={()=>native?.openPermission('checklistChannel')}>체크리스트 채널 설정</button>}</div>
   <p>기상 알람은 정확한 알람 권한과 알림 권한이 모두 필요해요. 체크리스트 알림은 예정 취침 15분 전과 예정 기상 15분 후에 따로 예약해요. 권한 없이도 홈에서 직접 기록할 수 있어요.</p>
   <div className="fields">{p.schedule==='irregular'&&<label>오늘 일정 질문을 받을 오후 시각<input required type="time" min="12:00" value={p.prompt} onChange={e=>change('prompt',e.target.value)}/></label>}<label>한 번 더 알릴 간격 (분)<input type="number" required min="5" max="240" value={p.retry} onChange={e=>change('retry',e.target.valueAsNumber)}/></label></div>
   <div className="check-row"><label><input type="checkbox" checked={p.usage} onChange={e=>change('usage',e.target.checked)}/> 취침 기록 이후 휴대폰 사용 감지</label></div>
   <button type="button" className="chip" onClick={()=>native?.openPermission('usage')}>사용 정보 접근 권한 · {access?.usage?'허용됨':'비허용'}</button><p>두 버튼 사이의 사용 신호만 확인해요. 앱 이름이나 사용 내용은 저장하지 않아요.</p>
  </section>}
  <p className="inline-info"><LockKeyhole size={16}/> 기록은 이 기기에만 저장돼요. 다른 기기와 동기화되지 않으며 앱 데이터를 지우면 사라질 수 있어요.</p>
  <button className="primary form-save">설정 저장</button>
 </form>;
}
