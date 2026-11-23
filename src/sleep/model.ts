export type Phase = 'before' | 'after';
export type Answer = number | 'unknown' | 'na';
export type Goals = { hours: number | ''; bed: string; wake: string; tolerance: number };
export type Profile = { age: string; gender: string; job: string; schedule: 'regular' | 'irregular'; bed: string; wake: string; goals: Goals; medBefore: boolean; medAfter: boolean; reminders: boolean; alarm: boolean; usage: boolean; prompt: string; retry: number };
export type Checklist = { answers: Record<number, Answer>; begun?: number; completed?: number; skipped?: number; med?: { value: string; at: number } };
export type Night = { day: string; goals: Goals; before: Checklist; after: Checklist; tags: string[]; bed?: number; wake?: number; bedTap?: number; wakeTap?: number; plan?: string; planAt?: number; planSkipped?: boolean; usageFrom?: number; usage?: 'yes' | 'no' | 'missing' };
export type Store = { profile?: Profile; nights: Record<string,Night> };
export const defaults: Profile = { age:'', gender:'', job:'', schedule:'regular', bed:'23:30', wake:'07:30', goals:{hours:8,bed:'23:30',wake:'07:30',tolerance:30}, medBefore:false, medAfter:false, reminders:false, alarm:false, usage:false, prompt:'17:00', retry:30 };
export const key = 'night-and-morning.v1';
export function load(): Store { try { return JSON.parse(localStorage.getItem(key) || 'null') || {nights:{}}; } catch { return {nights:{}}; } }
const pad = (n:number) => String(n).padStart(2,'0');
export function dayKey(date = new Date()) { return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`; }
export function moveDay(day:string, n:number) { const d=new Date(`${day}T12:00`); d.setDate(d.getDate()+n); return dayKey(d); }
export function nightToday(d=new Date()) { return d.getHours()<12 ? moveDay(dayKey(d),-1) : dayKey(d); }
export function newNight(day:string, profile?: Profile): Night { return {day,goals:{...(profile?.goals ?? {hours:'',bed:'',wake:'',tolerance:30})},before:{answers:{}},after:{answers:{}},tags:[]}; }
export function scheduleDay(day:string, time:string, wake=false) { if (!time) return undefined; return atTime(wake || time < '12:00' ? moveDay(day,1) : day,time); }
export function atTime(day:string,time:string) { const value=new Date(`${day}T${time}`).getTime(); return Number.isFinite(value) ? value : undefined; }
export function clock(t?:number) { if (t===undefined) return '—'; const d=new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
export function localInput(t?:number) { return t===undefined ? '' : `${dayKey(new Date(t))}T${clock(t)}`; }
export function minutes(time:string) { const [h,m]=time.split(':').map(Number); return h*60+m; }
export function cyclicDelta(a:number,b:number) { return ((a-b+2160)%1440)-720; }
export function meanClock(times:number[]) { if (!times.length) return '—'; const values=times.map(t=>minutes(clock(t))); const base=values[0]; const m=(Math.round(base+values.reduce((s,v)=>s+cyclicDelta(v,base),0)/values.length)+1440)%1440; return `${pad(Math.floor(m/60))}:${pad(m%60)}`; }
export function latencyBand(n:number) { return n<=15 ? 1 : n<=30 ? 2 : n<=60 ? 3 : 4; }
export function metrics(r?:Night) { const m=r?.after.answers[0]; const onset=r?.bed!==undefined && typeof m==='number' ? r.bed+m*60_000 : undefined; const gap=onset!==undefined && r?.wake!==undefined && r.wake>=onset ? (r.wake-onset)/60_000 : undefined; return {onset,gap}; }
export function prettyDuration(m?:number) { if (m===undefined) return '—'; const n=Math.round(m); return `${Math.floor(n/60)}시간 ${n%60}분`; }
export function status(c:Checklist) { return c.completed ? '완료' : c.skipped ? '건너뜀' : c.begun ? '작성 중' : '미작성'; }
export function daysBetween(from:string,to:string) { const out:string[]=[]; if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return out; for(let d=from; d<=to && out.length<366;d=moveDay(d,1)) out.push(d); return out; }
