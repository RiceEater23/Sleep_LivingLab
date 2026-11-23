import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ArrowRight, CalendarDays, ChartNoAxesColumnIncreasing, Check, ChevronRight, ClipboardList, Clock3, House, Info, LockKeyhole, Moon, Pencil, Settings, Smartphone, Sparkles, Sun } from 'lucide-react';
import { clock, dayKey, key, load, localInput, moveDay, newNight, nightToday, scheduleDay, status, type Night, type Phase, type Profile, type Store } from '../sleep/model';
import { native, permissions, sync, type Slot } from '../sleep/native';
import SettingsPanel from '../sleep/SettingsPanel';
import ChecklistPanel from '../sleep/ChecklistPanel';
import Dashboard from '../sleep/Dashboard';
import '../sleep/sleep.css';

const links=[{path:'/',name:'오늘의 기록',Icon:House},{path:'/dashboard',name:'대시보드',Icon:ChartNoAxesColumnIncreasing},{path:'/settings',name:'설정',Icon:Settings}];
function MoonArt(){return <svg viewBox="0 0 470 240" className="moon-art" aria-hidden="true"><defs><linearGradient id="crescent" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#e8e1ff"/><stop offset="1" stopColor="#8a73f3"/></linearGradient><radialGradient id="halo"><stop stopColor="#6852c5" stopOpacity=".52"/><stop offset="1" stopColor="#6852c5" stopOpacity="0"/></radialGradient></defs><ellipse cx="281" cy="119" rx="177" ry="130" fill="url(#halo)"/><g stroke="#a693ff" fill="none" opacity=".28"><circle cx="281" cy="120" r="87"/><circle cx="281" cy="120" r="105"/><circle cx="281" cy="120" r="124"/><ellipse cx="280" cy="125" rx="177" ry="33" transform="rotate(-19 280 125)" strokeDasharray="3 6"/></g><path fill="url(#crescent)" d="M309 56a66 66 0 1 0 36 99 60 60 0 0 1-36-99Z"/><g fill="#e1d8ff"><path d="M167 61l2 6 6 2-6 2-2 6-2-6-6-2 6-2zM360 83l3 8 8 3-8 3-3 8-3-8-8-3 8-3zM388 155l2 5 5 2-5 2-2 5-2-5-5-2 5-2zM206 175l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/><circle cx="215" cy="42" r="2"/><circle cx="141" cy="135" r="2"/><circle cx="400" cy="51" r="2"/><circle cx="329" cy="198" r="2"/><circle cx="427" cy="120" r="1.5"/></g></svg>;}

export default function Home() {
 const [store,setStore]=useState(load); const current=useRef(store);
 const [now,setNow]=useState(Date.now); const [selected,setSelected]=useState<string>();
 const [plan,setPlan]=useState(''); const [showPlan,setShowPlan]=useState(false);
 const [edit,setEdit]=useState(false); const [editError,setEditError]=useState('');
 const [message,setMessage]=useState(''); const [saveError,setSaveError]=useState(false);
 const [access,setAccess]=useState(permissions); const [reserved,setReserved]=useState<Slot[]>([]);
 const navigate=useNavigate(); const {pathname,search}=useLocation();
 const profile=store.profile; const today=nightToday(new Date(now)); const calendar=dayKey(new Date(now));
 const params=new URLSearchParams(search); const urlDay=params.get('night'); const urlPhase=params.get('phase');
 const phase:Phase|undefined=pathname==='/checklist'&&(urlPhase==='before'||urlPhase==='after')&&urlDay&&store.nights[urlDay]?urlPhase:undefined;
 const day=(phase&&urlDay)||selected||today;
 const r=store.nights[day]??newNight(day,profile);
 const older=Object.keys(store.nights).filter(d=>d<day&&d>=moveDay(day,-2)).map(d=>store.nights[d]).reverse().find(a=> (a.bed!==undefined&&a.wake===undefined)||(a.before.begun&&!a.before.completed&&!a.before.skipped)||(a.after.begun&&!a.after.completed&&!a.after.skipped));
 const pending=useRef<{day:string;phase?:Phase}|null>(null);
 const go=useCallback((path:string)=>{navigate(path);window.scrollTo(0,0);},[navigate]);
 function persist(fn:(s:Store)=>Store){ try {const next=fn(current.current);localStorage.setItem(key,JSON.stringify(next)); current.current=next; setStore(next);setSaveError(false);if(native)setReserved(sync(next)); return true;} catch{setSaveError(true);return false;} }
 function update(target:string,fn:(r:Night)=>Night){return persist(s=>({...s,nights:{...s.nights,[target]:fn(s.nights[target]??newNight(target,s.profile))}}));}
 function open(p:Phase,target=day){if(!profile){pending.current={day:target,phase:p};go('/settings');return;} if(update(target,a=>({...a,[p]:{...a[p],begun:a[p].begun??Date.now()}}))){setSelected(target);go(`/checklist?night=${target}&phase=${p}`);}}
 function switchDay(d:string){setSelected(d);setPlan('');setShowPlan(false);setEdit(false);setMessage('');}
 function showDay(d:string){switchDay(d);go('/');}
 useEffect(()=>{const refresh=()=>setNow(Date.now());const timer=window.setInterval(refresh,30000);window.addEventListener('focus',refresh);return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);};},[]);
 useEffect(()=>{
  const bridge=native;
  if(!bridge)return;
  const refresh=()=>{
   setAccess(permissions());setReserved(sync(current.current));
   try{const a=JSON.parse(bridge.takeAction()) as {day?:string;kind?:string};if(!a.day||!a.kind)return;
    const target=a.day,kind=a.kind;
    setSelected(target);setEdit(false);setMessage('');
    if(kind==='prompt'){setShowPlan(true);setPlan(current.current.nights[target]?.plan||'');go('/');}
    else if(kind==='alarm'){go('/');}
    else {const p:Phase=kind.startsWith('before')?'before':'after';if(update(target,n=>({...n,[p]:{...n[p],begun:n[p].begun??Date.now()}})))go(`/checklist?night=${target}&phase=${p}`);}
   }catch{/* no pending action */}
  };
  refresh(); window.addEventListener('sleep-android-resume',refresh);return()=>window.removeEventListener('sleep-android-resume',refresh);
 },[go]);
 function saveProfile(p:Profile){if(!persist(s=>({...s,profile:p})))return;const next=pending.current;pending.current=null; if(next?.phase){const q=next.phase;if(update(next.day,a=>({...a,[q]:{...a[q],begun:a[q].begun??Date.now()}}))){setSelected(next.day);go(`/checklist?night=${next.day}&phase=${q}`);}}else{setMessage('설정을 저장했어요.');go('/');}}
 function recordBed(){if(!profile){go('/settings');return;}const t=Date.now();if(r.wake!==undefined&&t>r.wake){setEdit(true);return;}if(update(day,a=>({...a,bed:t,bedTap:t,usageFrom:profile.usage&&permissions()?.usage?t:undefined,usage:'missing'})))setMessage('잠을 청한 시각을 기록했어요. 실제 입면 시각은 아니에요.');}
 function recordWake(){if(!profile){go('/settings');return;}const t=Date.now();if(r.bed!==undefined&&t<r.bed){setEdit(true);return;} let signal:Night['usage']='missing';try{if(profile.usage&&permissions()?.usage&&r.usageFrom&&native){const v=native.usage(r.usageFrom,t);if(v==='yes'||v==='no')signal=v;}}catch{/* permission changed */} if(update(day,a=>({...a,wake:t,wakeTap:t,usage:signal,after:{...a.after,begun:a.after.begun??t}}))){setSelected(day);go(`/checklist?night=${day}&phase=after`);}}
 const active=pathname==='/dashboard'?'/dashboard':pathname==='/settings'?'/settings':'/';
 const dateTitle=new Date(`${day}T12:00`).toLocaleDateString('ko-KR',{month:'long',day:'numeric',weekday:'long'});
 const planTime=r.plan || (profile?.schedule==='regular'?profile.bed:'');
 const wakeTime=profile?.schedule==='regular'?profile.wake:profile?.goals.wake;
 const planVisible=showPlan||profile?.schedule==='irregular';
 const planDay=selected??calendar;
 const planned=store.nights[planDay];
 const initLabel=profile?'내 수면 목표':'처음 사용하시나요?';
 return <div className="sleep-app"><a className="skip-content" href="#sleep-main">본문으로 이동</a>
  <aside className="side"><button className="brand" onClick={()=>{setSelected(undefined);setEdit(false);setShowPlan(false);go('/');}}><span className="brand-icon"><Moon size={22}/><i/></span><span><strong>밤과 아침</strong><small>나의 수면 일지</small></span></button><div className="side-rule"/><span className="side-label">수면 일지</span><nav aria-label="메인 메뉴">{links.map(({path,name,Icon})=><button key={path} aria-current={active===path?'page':undefined} onClick={()=>{if(path==='/'){setSelected(undefined);setEdit(false);setShowPlan(false);}go(path);}}><Icon size={20}/><span>{name}</span>{active===path&&<ChevronRight className="nav-chevron" size={16}/>}</button>)}</nav><div className="side-note"><LockKeyhole size={16}/><div><b>이 기기에만 저장돼요</b><span>기기 간에 동기화되지 않아요.</span></div></div></aside>
  <div className="workspace"><header className="topbar"><span className="mobile-brand"><span className="brand-icon"><Moon size={19}/><i/></span> 밤과 아침</span><span className="breadcrumb">수면 일지 <ChevronRight size={14}/> <b>{pathname==='/checklist'?'체크리스트':links.find(l=>l.path===active)?.name}</b></span><span className="top-date"><CalendarDays size={17}/>{new Date(now).toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'long'})}</span></header>
  <main id="sleep-main" className="sleep-main">
  {saveError&&<p role="alert" className="error">이 기기에 저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.</p>}
  {pathname==='/settings'?<><div className="page-title spaced"><h1>{profile?'설정':'나의 수면 일지 시작하기'}</h1><p>평소 수면 일정과 나만의 목표를 설정해요.</p></div><SettingsPanel profile={profile} save={saveProfile} access={access}/></>:
   pathname==='/dashboard'?<Dashboard nights={store.nights} end={calendar} edit={showDay}/>:
   pathname==='/checklist'&&phase?<ChecklistPanel key={`${day}:${phase}`} night={r} phase={phase} profile={profile} update={fn=>update(day,fn)} close={()=>go('/')} done={skip=>{if(update(day,a=>({...a,[phase]:{...a[phase],completed:skip?undefined:Date.now(),skipped:skip?Date.now():undefined}}))){setMessage(skip?'체크리스트를 건너뛰었어요.':'체크리스트를 저장했어요.');go('/');}}}/>:
   <>
    <div className="home-heading page-title"><div><div className="section-kicker"><span/> 나의 수면 일지</div><h1>오늘의 수면 기록</h1><p>잠을 청한 밤부터 눈을 뜬 아침까지, 한 쌍으로 기록해요.</p></div><label className="date-picker"><CalendarDays size={17}/><span>{dateTitle} 밤</span><input type="date" aria-label="기록 날짜 선택" value={day} max={calendar} onChange={e=>{if(e.target.value)switchDay(e.target.value);}}/></label></div>
    <section className="night-hero"><MoonArt/><div className="hero-copy"><div className="hero-caption"><Moon size={15}/> 밤과 아침을 잇는 루틴</div><h2>밤의 끝, 아침의 시작.</h2><p>오늘의 상태를 가볍게 살피고,<br/>내일의 나에게 지난밤을 남겨요.</p></div><div className="hero-index"><i/> 밤 <span/> <i/> 아침</div></section>
    {message&&<p className="inline-info home-message" role="status"><Check size={17}/>{message}</p>}
    {older&&<div className="callout home-message"><Clock3 size={20}/><p><b>{older.day} 밤에 이어 쓸 기록이 있어요.</b></p><button className="text-button" onClick={()=>showDay(older.day)}>지난 기록 열기 <ArrowRight size={16}/></button></div>}
    {planVisible&&<section className="paper panel home-message"><h2>{planned?.planSkipped?'이 밤의 일정은 건너뛰었어요':'오늘 몇 시쯤 잠을 청할 예정인가요?'}</h2><p>{planDay} 밤 · {planned?.plan?`예정 취침 ${planned.plan}`:'답하지 않으면 예정 취침 시각을 정하지 않아요.'}</p><form className="plan-form" autoComplete="off" onSubmit={e=>{e.preventDefault();const value=String(new FormData(e.currentTarget).get('plan')||'');if(value&&update(planDay,a=>({...a,plan:value,planAt:Date.now(),planSkipped:false})))setMessage('예정 취침 시각을 저장했어요.');}}><label>예정 취침 시각<input name="plan" type="time" required value={plan||planned?.plan||''} onChange={e=>setPlan(e.target.value)}/></label><button className="secondary">일정 저장</button><button type="button" className="text-button" onClick={()=>{if(update(planDay,a=>({...a,plan:undefined,planAt:undefined,planSkipped:true})))setPlan('');}}>오늘 일정 건너뛰기</button></form></section>}
    <div className="section-heading"><div><h2>수면 체크리스트</h2><p>수면 전과 후, 두 번의 짧은 체크인</p></div><button className="text-button edit-link" onClick={()=>{if(!profile){go('/settings');return;}setEdit(!edit);setEditError('');}}><Pencil size={16}/> 시각 입력·수정</button></div>
    {edit&&<form className="paper panel time-edit" key={day} onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);const read=(k:string)=>f.get(k)?new Date(String(f.get(k))).getTime():undefined;const bed=read('bed'),wake=read('wake');if((bed!==undefined&&!Number.isFinite(bed))||(wake!==undefined&&!Number.isFinite(wake))||(bed!==undefined&&wake!==undefined&&wake<bed)){setEditError('기상 시각이 잠을 청한 시각보다 앞설 수 없어요. 날짜도 확인해 주세요.');return;}if(update(day,a=>({...a,bed,wake}))){setEdit(false);setMessage('기록 시각을 저장했어요.');}}}>
     <h2>기록 시각 입력·수정</h2><p>{day} 밤 기록에 연결돼요. 자정을 넘겼다면 다음 날 날짜를 입력해 주세요. 빈 칸은 미기록으로 저장돼요.</p><div className="fields"><label>잠을 청한 날짜와 시각<input name="bed" type="datetime-local" defaultValue={localInput(r.bed)}/></label><label>일어난 날짜와 시각<input name="wake" type="datetime-local" defaultValue={localInput(r.wake)}/></label></div>{editError&&<p className="error" role="alert">{editError}</p>}<button className="primary">기록 시각 저장</button></form>}
    <div className="flow-grid">{([{p:'before',Icon:Moon,label:'수면 전',pill:'잠들기 전',note:'잠을 청하기 직전, 오늘 하루와 지금의 상태를 살펴봐요.',time:r.bed,tap:'이제 잠을 청할게요',timeLabel:'잠을 청한 시각',plan:planTime,act:recordBed},{p:'after',Icon:Sun,label:'수면 후',pill:'일어난 뒤',note:'일어난 뒤, 지난밤의 수면과 지금의 기분을 살펴봐요.',time:r.wake,tap:'일어났어요',timeLabel:'일어난 시각',plan:wakeTime,act:recordWake}] as const).map(({p,Icon,label,pill,note,time,tap,timeLabel,plan,act})=>{
     const c=r[p];const s=status(c);return <article className={`paper flow-card ${p}`} key={p}><div className="flow-top"><span className="phase-icon"><Icon size={24}/></span><span className="status" data-status={s}><i/>{s}</span></div><span className="flow-eyebrow">{pill}</span><h3>{label} 체크리스트</h3><p>{note}</p><div className="flow-time"><span><Clock3 size={15}/>{timeLabel}</span><b>{time!==undefined?clock(time):'미기록'}</b>{plan&&<small>{p==='after'&&profile?.schedule==='irregular'?'목표':'예정'} {clock(scheduleDay(day,plan,p==='after'))}</small>}</div><button className={p==='before'?'primary flow-open':'secondary flow-open'} onClick={()=>open(p)}><ClipboardList size={18}/>{c.completed?'체크리스트 열기':c.begun?'체크리스트 이어쓰기':'체크리스트 시작하기'}<ChevronRight size={18}/></button><button className="tap" onClick={time===undefined?act:p==='after'?()=>open('after'):()=>setEdit(true)}>{time===undefined?tap:p==='after'?'수면 후 기록 열기':'잠을 청한 시각 수정'}<ArrowRight size={15}/></button></article>;})}</div>
    {native&&profile&&(profile.alarm||profile.reminders)&&<div className="callout home-message"><Info size={19}/><p>{profile.alarm&&`기상 알람: ${reserved.some(s=>s.day===day&&s.kind==='alarm')?'예약됨':'예약되지 않음'}. `}{profile.reminders&&`체크리스트 알림: ${reserved.some(s=>s.day===day&&s.kind!=='alarm')?'예약됨':'예약되지 않음'}. `}예약이 없으면 권한과 시각을 확인하거나 직접 기록해 주세요.</p><button className="text-button" onClick={()=>go('/settings')}>설정 열기</button></div>}
    <div className="callout goal-callout"><span className="tip-icon"><Sparkles size={20}/></span><div><b>{initLabel}</b><p>{profile?`수면시간 ${profile.goals.hours===''?'미설정':`${profile.goals.hours}시간`} · 취침 ${profile.goals.bed||'미설정'} · 기상 ${profile.goals.wake||'미설정'}`:'평소 수면 일정과 나만의 목표를 설정하고 첫 기록을 남겨 보세요.'}</p></div><button className="text-button" onClick={()=>go('/settings')}>{profile?'목표 수정':'처음 설정하기'} <ChevronRight size={17}/></button></div>
    {!native&&<details className="install"><summary><Smartphone size={17}/> iPhone 홈 화면에 추가하기</summary><p>Safari에서 공유 버튼을 누르고 ‘홈 화면에 추가’를 선택해 주세요. 기상 알람은 iPhone 시계 앱에서 설정해 주세요. 이 버전은 웹 푸시, 백그라운드 재알림, 다른 앱 사용 감지를 지원하지 않아요.</p><p>기록은 이 기기에만 남아요. 다른 기기에 동기화되지 않으며 앱 데이터를 지우면 기록이 사라질 수 있어요.</p></details>}
   </>}
  </main></div>
 </div>;
}
