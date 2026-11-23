package app.nightandmorning.sleep;

import android.Manifest;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.Iterator;

public final class SleepReceiver extends BroadcastReceiver {
    static final String ALARM_CHANNEL="wake-alarm-v1", CHECK_CHANNEL="sleep-checklist-v1";
    private static final int FLAGS=PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE;
    private static final String FIRE="app.nightandmorning.sleep.FIRE", STOP="app.nightandmorning.sleep.STOP";
    private static SharedPreferences disk(Context c){return c.getSharedPreferences("local_alarms",Context.MODE_PRIVATE);}
    private static AlarmManager alarms(Context c){return c.getSystemService(AlarmManager.class);}
    private static NotificationManager notices(Context c){return c.getSystemService(NotificationManager.class);}
    static boolean exact(Context c){return Build.VERSION.SDK_INT<31||alarms(c).canScheduleExactAlarms();}
    static boolean notifications(Context c){return (Build.VERSION.SDK_INT<33||c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED)&&notices(c).areNotificationsEnabled();}
    static boolean channelAllowed(Context c,boolean wake){
        NotificationChannel channel=notices(c).getNotificationChannel(wake?ALARM_CHANNEL:CHECK_CHANNEL);
        return channel!=null && channel.getImportance()!=NotificationManager.IMPORTANCE_NONE;
    }
    static void channels(Context c){
        NotificationChannel wake=new NotificationChannel(ALARM_CHANNEL,"기상 알람",NotificationManager.IMPORTANCE_HIGH);
        wake.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM),new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build());
        wake.enableVibration(true);
        NotificationChannel list=new NotificationChannel(CHECK_CHANNEL,"수면 체크리스트 및 일정",NotificationManager.IMPORTANCE_DEFAULT);
        notices(c).createNotificationChannel(wake);notices(c).createNotificationChannel(list);
    }
    static boolean validId(String id){return id!=null&&id.matches("\\d{4}-\\d{2}-\\d{2}:(alarm|prompt|before|beforeRetry|after|afterRetry)");}
    static boolean wasDelivered(Context c,String id){return disk(c).contains("sent:"+id);}
    static void opened(Context c,String id){disk(c).edit().putLong("opened:"+id,System.currentTimeMillis()).apply();notices(c).cancel(id,1);}
    private static PendingIntent broadcast(Context c,String id,String action,int flags){
        Intent i=new Intent(c,SleepReceiver.class).setAction(action).setData(new Uri.Builder().scheme("sleepjournal").authority("notify").appendPath(id).build());
        return PendingIntent.getBroadcast(c,0,i,flags);
    }
    private static PendingIntent open(Context c,String id){
        Intent i=new Intent(c,MainActivity.class).setAction(Intent.ACTION_VIEW).setData(new Uri.Builder().scheme("sleepjournal").authority("open").appendPath(id).build()).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(c,0,i,FLAGS);
    }
    private static boolean isWake(JSONObject s){return "alarm".equals(s.optString("kind"));}
    private static boolean eligible(Context c,JSONObject s){return notifications(c)&&channelAllowed(c,isWake(s))&&(!isWake(s)||exact(c));}
    private static boolean reserve(Context c,JSONObject s){
        String id=s.optString("id"); long at=s.optLong("at");
        try {
            PendingIntent p=broadcast(c,id,FIRE,FLAGS);
            if(isWake(s)) alarms(c).setAlarmClock(new AlarmManager.AlarmClockInfo(at,open(c,id)),p);
            else if(exact(c)) alarms(c).setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,p);
            else alarms(c).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,p);
            return true;
        }catch(RuntimeException e){cancel(c,id,false);return false;}
    }
    private static void cancel(Context c,String id,boolean posted){
        PendingIntent p=broadcast(c,id,FIRE,PendingIntent.FLAG_NO_CREATE|PendingIntent.FLAG_IMMUTABLE);
        if(p!=null){alarms(c).cancel(p);p.cancel();}
        if(posted&&!id.endsWith(":alarm"))notices(c).cancel(id,1);
    }
    private static JSONObject jsonObject(String raw){try{return new JSONObject(raw);}catch(Exception e){return new JSONObject();}}
    private static JSONArray jsonArray(String raw){try{return new JSONArray(raw);}catch(Exception e){return new JSONArray();}}

    static synchronized String sync(Context c,String raw){
        SharedPreferences d=disk(c);
        if(raw!=null){
            if(raw.length()>60_000)return "[]";
            d.edit().putString("desired",raw).apply();
        }
        JSONArray desired=jsonArray(d.getString("desired","[]"));
        JSONObject old=jsonObject(d.getString("reserved","{}")), next=new JSONObject();
        JSONArray result=new JSONArray();
        long now=System.currentTimeMillis();
        boolean canExact=exact(c);
        SharedPreferences.Editor changes=d.edit();
        for(int j=0;j<Math.min(128,desired.length());j++){
            JSONObject s=desired.optJSONObject(j);if(s==null)continue;
            String id=s.optString("id");long at=s.optLong("at");
            if(!validId(id)||!id.equals(s.optString("day")+":"+s.optString("kind"))||at<now-3*3_600_000L||at>now+17*86_400_000L||!eligible(c,s)||wasDelivered(c,id))continue;
            if(id.endsWith("Retry")){
                long first=d.getLong("sent:"+id.substring(0,id.length()-5),0);
                if(first!=0){ at=Math.max(at,first+s.optLong("delay"));try{s.put("at",at);}catch(Exception ignored){} }
            }
            // Keep an existing late, inexact reservation; never create a new reservation in the past.
            if(raw==null&&at<=now)continue;
            JSONObject prev=old.optJSONObject(id);
            boolean unchanged=raw!=null&&prev!=null&&prev.optLong("at")==at&&(prev.optBoolean("exact")==canExact||at<=now);
            if(unchanged||(at>now&&reserve(c,s))){try{
                JSONObject slot=new JSONObject(s.toString()).put("exact",canExact);
                if(!unchanged) slot.put("reservedAt",now); else slot.put("reservedAt",prev.optLong("reservedAt",now));
                next.put(id,slot);result.put(slot);
            }catch(Exception ignored){}}
        }
        Iterator<String> keys=old.keys();
        while(keys.hasNext()){String id=keys.next();if(!next.has(id))cancel(c,id,!wasDelivered(c,id));}
        for(String meta:d.getAll().keySet()){
            if((meta.startsWith("sent:")||meta.startsWith("opened:"))&&d.getLong(meta,now)<now-45*86_400_000L)changes.remove(meta);
        }
        changes.putString("reserved",next.toString()).apply();
        return result.toString();
    }

    @Override public void onReceive(Context c,Intent intent){
        String action=intent.getAction();
        if(FIRE.equals(action)||STOP.equals(action)){
            Uri uri=intent.getData();String id=uri==null?null:uri.getLastPathSegment();if(!validId(id))return;
            if(STOP.equals(action)){notices(c).cancel(id,1);return;}
            fire(c,id);
        }else{
            channels(c);
            if(Intent.ACTION_TIMEZONE_CHANGED.equals(action)) shiftToLocalTime(c);
            sync(c,null);
        }
    }

    private static synchronized void shiftToLocalTime(Context c){
        JSONArray slots=jsonArray(disk(c).getString("desired","[]"));
        for(int j=0;j<slots.length();j++)try{
            JSONObject s=slots.getJSONObject(j);
            if(s.optBoolean("fixed"))continue;
            s.put("at",java.time.LocalDateTime.parse(s.getString("local")).atZone(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli());
        }catch(Exception ignored){}
        disk(c).edit().putString("desired",slots.toString()).apply();
    }

    private static synchronized void fire(Context c,String id){
        SharedPreferences d=disk(c);JSONObject live=jsonObject(d.getString("reserved","{}"));JSONObject s=live.optJSONObject(id);
        long now=System.currentTimeMillis();
        if(s==null || wasDelivered(c,id) || !eligible(c,s) || s.optLong("at")-now>1_000)return;
        if(now-s.optLong("at")>(isWake(s)?20:180)*60_000L){live.remove(id);d.edit().putString("reserved",live.toString()).apply();return;}
        String kind=s.optString("kind"),day=s.optString("day");
        if(kind.endsWith("Retry")){
            String base=kind.substring(0,kind.length()-5);long first=d.getLong("sent:"+day+":"+base,0L);
            long later=first+s.optLong("delay");
            if(first>0&&later>now+1_000){try{ s.put("at",later); if(reserve(c,s))d.edit().putString("reserved",live.toString()).apply(); }catch(Exception ignored){}return;}
        }
        String title, body;
        switch(kind){
            case "alarm":title="기상 알람";body="일어났다면 앱에서 ‘일어났어요’를 눌러 주세요.";break;
            case "prompt":title="오늘 몇 시쯤 잠을 청할 예정인가요?";body="앱을 열어 오늘의 예정 취침 시각을 알려 주세요.";break;
            case "before": case "beforeRetry":title=kind.endsWith("Retry")?"수면 전 체크리스트 · 한 번 더":"수면 전 체크리스트";body="잠을 청하기 전 오늘의 상태를 남겨 보세요.";break;
            default:title=kind.endsWith("Retry")?"수면 후 체크리스트 · 한 번 더":"수면 후 체크리스트";body="일어났다면 지난밤 수면을 남겨 보세요.";
        }
        boolean wake=isWake(s);
        Notification.Builder builder=new Notification.Builder(c,wake?ALARM_CHANNEL:CHECK_CHANNEL).setSmallIcon(R.drawable.notification_moon).setContentTitle(title).setContentText(body).setStyle(new Notification.BigTextStyle().bigText(body)).setContentIntent(open(c,id)).setAutoCancel(true).setCategory(wake?Notification.CATEGORY_ALARM:Notification.CATEGORY_REMINDER).setVisibility(Notification.VISIBILITY_PRIVATE);
        if(wake)builder.setTimeoutAfter(120_000).addAction(new Notification.Action.Builder(null,"알람 끄기",broadcast(c,id,STOP,FLAGS)).build());
        Notification n=builder.build();if(wake)n.flags|=Notification.FLAG_INSISTENT;
        try{notices(c).notify(id,1,n);live.remove(id);d.edit().putLong("sent:"+id,now).putLong("scheduled:"+id,s.optLong("reservedAt",now)).putString("reserved",live.toString()).apply();}catch(RuntimeException ignored){}
    }
}
