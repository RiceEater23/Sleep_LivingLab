package app.nightandmorning.sleep;

import android.Manifest;
import android.app.Activity;
import android.app.AppOpsManager;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.UserManager;
import android.provider.Settings;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.webkit.WebViewAssetLoader;
import org.json.JSONObject;
import java.io.ByteArrayInputStream;
import java.util.Collections;
import java.util.concurrent.atomic.AtomicReference;

public final class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private WebView web;
    private final AtomicReference<String> pending = new AtomicReference<>("{}");

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        SleepReceiver.channels(this);
        accept(getIntent());
        web = new WebView(this);
        web.setOnApplyWindowInsetsListener((v, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets size = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                v.setPadding(size.left, size.top, size.right, size.bottom);
                return WindowInsets.CONSUMED;
            }
            return insets;
        });
        setContentView(web);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.getSettings().setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder().addPathHandler("/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        web.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request){ return !isLocal(request.getUrl()); }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request){
                Uri url=request.getUrl();
                if(!isLocal(url)) return new WebResourceResponse("text/plain","UTF-8",403,"Blocked",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));
                String path=url.getPath();
                if(path==null||path.equals("/")||path.equals("/dashboard")||path.equals("/settings")||path.equals("/checklist")) path="/index.html";
                WebResourceResponse asset=loader.shouldInterceptRequest(url.buildUpon().path("/site"+path).build());
                if(asset!=null){
                    asset.setResponseHeaders(Collections.singletonMap("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; frame-src 'none'; connect-src 'none'; base-uri 'self'"));
                    return asset;
                }
                return new WebResourceResponse("text/plain","UTF-8",404,"Not Found",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));
            }
        });
        web.addJavascriptInterface(new Bridge(), "SleepAndroid");
        web.loadUrl("https://"+HOST+"/");
    }

    private static boolean isLocal(Uri uri) { return "https".equals(uri.getScheme()) && HOST.equals(uri.getHost()) && uri.getPort()==-1; }
    @Override protected void onResume(){super.onResume();refresh();}
    @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);accept(intent);refresh();}
    @Override public void onRequestPermissionsResult(int request, String[] permissions, int[] results){super.onRequestPermissionsResult(request,permissions,results);refresh();}
    @SuppressWarnings("deprecation") @Override public void onBackPressed(){if(web!=null&&web.canGoBack()) web.goBack();else super.onBackPressed();}
    private void refresh(){if(web!=null)web.evaluateJavascript("window.dispatchEvent(new Event('sleep-android-resume'))",null);}
    private void accept(Intent intent){
        Uri uri=intent.getData();
        if(uri==null||!"sleepjournal".equals(uri.getScheme())||!"open".equals(uri.getHost()))return;
        String id=uri.getLastPathSegment();
        if(!SleepReceiver.validId(id)||!SleepReceiver.wasDelivered(this,id))return;
        try{
            String[] parts=id.split(":");
            pending.set(new JSONObject().put("day",parts[0]).put("kind",parts[1]).toString());
            SleepReceiver.opened(this,id);
        } catch(Exception ignored) { }
        intent.setData(null);
    }

    private boolean canUsage(){
        AppOpsManager appOps=getSystemService(AppOpsManager.class);
        int mode=Build.VERSION.SDK_INT>=29 ? appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, android.os.Process.myUid(), getPackageName()) : appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, android.os.Process.myUid(), getPackageName());
        return mode==AppOpsManager.MODE_ALLOWED;
    }

    final class Bridge {
        @JavascriptInterface public String permissions(){
            try{return new JSONObject().put("notifications",SleepReceiver.notifications(MainActivity.this)).put("alarm",SleepReceiver.exact(MainActivity.this)).put("usage",canUsage()).put("alarmChannel",SleepReceiver.channelAllowed(MainActivity.this,true)).put("checklistChannel",SleepReceiver.channelAllowed(MainActivity.this,false)).toString();}
            catch(Exception e){return "{}";}
        }
        @JavascriptInterface public void openPermission(String kind){runOnUiThread(()->{
            try{
                Intent i;
                switch(kind){
                    case "usage": i=new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS); break;
                    case "alarm": if(Build.VERSION.SDK_INT<31)return; i=new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,Uri.parse("package:"+getPackageName()));break;
                    case "notifications":
                        if(Build.VERSION.SDK_INT>=33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED && (!getPreferences(0).getBoolean("notificationPrompt",false)||shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS))){
                            getPreferences(0).edit().putBoolean("notificationPrompt",true).apply();
                            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},29);return;
                        }
                        i=new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,getPackageName()); break;
                    case "alarmChannel": case "checklistChannel":
                        i=new Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,getPackageName()).putExtra(Settings.EXTRA_CHANNEL_ID,kind.equals("alarmChannel")?SleepReceiver.ALARM_CHANNEL:SleepReceiver.CHECK_CHANNEL);break;
                    default:return;
                }
                startActivity(i);
            }catch(Exception ignored){refresh();}
        });}
        @JavascriptInterface public String sync(String slots){return SleepReceiver.sync(MainActivity.this,slots);}
        @JavascriptInterface public String takeAction(){return pending.getAndSet("{}");}
        @JavascriptInterface public String usage(long from,long to){
            long now=System.currentTimeMillis();
            if(!canUsage()||to<=from||to>now+5_000||now-from>72*3_600_000L||!getSystemService(UserManager.class).isUserUnlocked())return "missing";
            try{
                UsageEvents events=((UsageStatsManager)getSystemService(Context.USAGE_STATS_SERVICE)).queryEvents(from+2_000,to);
                if(events==null)return "missing";
                UsageEvents.Event event=new UsageEvents.Event();
                while(events.hasNextEvent()){
                    events.getNextEvent(event);
                    int type=event.getEventType();
                    if(type==UsageEvents.Event.SCREEN_INTERACTIVE || (type==UsageEvents.Event.ACTIVITY_RESUMED&&!getPackageName().equals(event.getPackageName())))return "yes";
                }
                return "no";
            }catch(Exception e){return "missing";}
        }
    }
}
