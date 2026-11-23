import { atTime, dayKey, localInput, moveDay, scheduleDay, type Store } from './model';

type Native = { permissions(): string; openPermission(kind:string):void; sync(slots:string):string; usage(start:number,end:number):string; takeAction():string };
declare global { interface Window { SleepAndroid?: Native } }
export const native = window.SleepAndroid;
export type NativeStatus = { notifications:boolean; alarm:boolean; usage:boolean; alarmChannel:boolean; checklistChannel:boolean };
export function permissions(): NativeStatus | undefined { try { return native && JSON.parse(native.permissions()); } catch { return undefined; } }
export type Slot = { id:string; day:string; kind:string; at:number; local?:string; delay?:number; fixed?:boolean };
export function slots(store:Store, now = Date.now()): Slot[] {
  const p=store.profile;
  if(!p) return [];
  const today=dayKey(new Date(now));
  const days=Array.from({length:15},(_,i)=>moveDay(today,i-1));
  const out:Slot[]=[];
  for(const day of days) {
    const r=store.nights[day];
    const add=(kind:string,at?:number,fixed=false)=>{ if(at!==undefined && at>now-(kind==='alarm'?20:180)*60_000) out.push({id:`${day}:${kind}`,day,kind,at,local:localInput(at),fixed,delay:kind.endsWith('Retry')?p.retry*60_000:undefined}); };
    const bed=scheduleDay(day,r?.plan || (p.schedule==='regular' ? p.bed : ''));
    const wake=scheduleDay(day,p.schedule==='regular'?p.wake:p.goals.wake,true);
    const retry=p.retry*60_000;
    if(p.reminders && p.schedule==='irregular' && !r?.plan && !r?.planSkipped && !r?.bed && !r?.wake) add('prompt',atTime(day,p.prompt));
    if(p.reminders && bed && !r?.planSkipped && !r?.bed && !r?.wake && !r?.before.completed && !r?.before.skipped) {
      const before=r?.planAt&&r.planAt<bed?Math.min(bed,Math.max(bed-15*60_000,r.planAt+2_000)):bed-15*60_000;
      add('before',before); add('beforeRetry',before+retry);
    }
    if(p.alarm && !r?.wake) add('alarm',wake);
    const after=r?.wakeTap || r?.wake || (wake && wake+15*60_000);
    if(p.reminders && after && !r?.after.completed && !r?.after.skipped) { if(!r?.wake) add('after',after); add('afterRetry',after+retry,Boolean(r?.wake)); }
  }
  return out;
}
export function sync(store:Store) { try { return native ? JSON.parse(native.sync(JSON.stringify(slots(store)))) as Slot[] : []; } catch { return []; } }
