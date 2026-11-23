import { useState } from 'react';
import { ArrowLeft, Check, Moon, Sun } from 'lucide-react';
import { behaviors, before, after, scale } from './questions';
import { clock, latencyBand, type Answer, type Night, type Phase, type Profile } from './model';

export default function ChecklistPanel({night,phase,profile,update,done,close}:{night:Night;phase:Phase;profile?:Profile;update:(fn:(r:Night)=>Night)=>void;done:(skip:boolean)=>void;close:()=>void}) {
 const c=night[phase]; const [other,setOther]=useState(typeof c.answers[0]==='number' && ![10,20,30,60].includes(c.answers[0]));
 const questions=phase==='before'?before:after;
 const noAwake=phase==='after' && c.answers[1]===1;
 const total=noAwake?14:15;
 const count=questions.filter((_,i)=>!(noAwake&&i===2)&&c.answers[i]!==undefined).length;
 function answer(i:number,v?:Answer) { update(r=>{const answers={...r[phase].answers};if(v===undefined || answers[i]===v) delete answers[i];else answers[i]=v;if(phase==='after'&&i===1&&answers[1]===1) delete answers[2];return {...r,[phase]:{...r[phase],answers}};}); }
 function custom(v:string) { update(r=>{const answers={...r.after.answers};if(v==='') delete answers[0];else if(/^\d+$/.test(v)&&Number(v)<=1440) answers[0]=Number(v);return {...r,after:{...r.after,answers}};}); }
 const chip=(text:string,v:Answer,i:number,chosen=c.answers[i]===v)=><button key={v} type="button" aria-pressed={chosen} className="chip" onClick={()=>{if(phase==='after'&&i===0)setOther(false);answer(i,v);}}>{text}</button>;
 const med=phase==='before'?profile?.medBefore:profile?.medAfter;
 return <div className="stack">
  <div className="page-title"><button className="back" onClick={close}><ArrowLeft size={18}/> 홈으로</button><h1>{phase==='before'?'수면 전':'수면 후'} 체크리스트</h1><p>{night.day} 밤 · {phase==='before'?'잠을 청하기 직전':'최종 기상 후 가급적 30분 이내'}</p></div>
  <section className="paper panel progress-panel"><div>{phase==='before'?<Moon size={19}/>:<Sun size={19}/>} <b>응답 {count} / {total}</b> <small>{c.completed?'완료된 기록 · 수정 가능':'선택할 때마다 임시 저장돼요'}</small></div><progress aria-label="응답 진행률" value={count} max={total}/><p>시간 구간은 응답을 쉽게 하는 기준이지 건강상의 정상·비정상 기준은 아니에요.</p></section>
  {questions.map((q,i)=>noAwake&&i===2?<div key={q.label} className="inline-info"><Check size={16}/> 각성이 0회여서 (재입면 어려움)은 건너뛰었어요.</div>:<section className="paper panel question" key={q.label} aria-labelledby={`question-${i}`}><span className="question-label">({q.label})</span><h2 id={`question-${i}`}>{i+1}. {q.text}</h2>{q.note&&<p>{q.note}</p>}
   {phase==='after'&&i===0?<><div className="button-group">{[10,20,30,60].map(t=>chip(`${t}분`,t,i,!other&&c.answers[i]===t))}<button className="chip" aria-pressed={other} onClick={()=>{setOther(!other);if(!other)custom('');}}>기타</button>{chip('모르겠음','unknown',i)}{chip('해당 없음','na',i)}</div>{other&&<label className="custom-input">잠들기까지 걸린 시간 (분)<input type="number" min="0" max="1440" step="1" inputMode="numeric" value={typeof c.answers[i]==='number'?c.answers[i]:''} onChange={e=>custom(e.target.value)}/></label>}{typeof c.answers[i]==='number'&&<p>분류: {['① 0~15분','② 16~30분','③ 31~60분','④ 61분 이상'][latencyBand(c.answers[i] as number)-1]}</p>}</>:<><div className="answers">{(q.options??scale).map((v,j)=>chip(`${'①②③④'[j]} ${v}`,j+1,i))}</div><div className="button-group minor">{chip('모르겠음','unknown',i)}{chip('해당 없음','na',i)}</div></>}
  </section>)}
  {phase==='before'&&<section className="paper panel"><h2>새로 시도한 행동</h2><p>전과 다르게 시도한 것이 있으면 선택해 주세요.</p><div className="button-group">{behaviors.map(tag=><button key={tag} className="chip" aria-pressed={night.tags.includes(tag)} onClick={()=>update(r=>({...r,tags:r.tags.includes(tag)?r.tags.filter(t=>t!==tag):[...r.tags,tag]}))}>{tag}</button>)}</div></section>}
  {med&&<section className="paper panel"><h2>약 복용 체크</h2><p>설문 점수와 별도로 저장돼요. 응답하지 않아도 미복용으로 처리하지 않아요.</p><div className="button-group">{['복용함','아직 안 함','오늘 해당 없음'].map(value=><button key={value} className="chip" aria-pressed={c.med?.value===value} onClick={()=>update(r=>({...r,[phase]:{...r[phase],med:r[phase].med?.value===value?undefined:{value,at:Date.now()}}}))}>{value}</button>)}</div>{c.med&&<p>체크 시각 {clock(c.med.at)}</p>}</section>}
  <div className="check-actions paper"><button className="text-button" onClick={()=>done(true)}>오늘 건너뛰기</button><button className="secondary" onClick={close}>임시 저장하고 닫기</button><button className="primary" onClick={()=>done(false)}><Check size={18}/> {c.completed?'수정 완료':'체크리스트 완료'}</button></div>
 </div>;
}
