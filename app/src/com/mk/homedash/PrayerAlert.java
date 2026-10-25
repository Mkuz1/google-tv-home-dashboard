package com.mk.homedash;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Silent prayer banners while another app (navigation, music) is in front: "Asr in 10 minutes",
 * then "It's time for Asr". No sound, no vibration; the banner goes away by itself.
 * On the home screen the page shows its own banner instead.
 */
public class PrayerAlert extends BroadcastReceiver {

    private static final String CHANNEL = "prayer";
    private static final int FIRST_CODE = 100, MAX_ALERTS = 24, NOTIFICATION_ID = 7;

    /** True while the home screen is in front (MainActivity onResume/onPause). */
    static volatile boolean homeVisible = false;

    /** Replaces the scheduled alerts with [{at, title, text, minutes}] (at in ms). */
    static void schedule(Context ctx, String json) {
        try {
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            JSONArray list = new JSONArray(json);
            long now = System.currentTimeMillis();
            int n = 0;
            for (int i = 0; i < list.length() && n < MAX_ALERTS; i++) {
                JSONObject a = list.getJSONObject(i);
                long at = a.getLong("at");
                if (at <= now) continue;
                Intent it = new Intent(ctx, PrayerAlert.class)
                        .putExtra("title", a.optString("title"))
                        .putExtra("text", a.optString("text"))
                        .putExtra("minutes", a.optInt("minutes", 10));
                PendingIntent pi = PendingIntent.getBroadcast(ctx, FIRST_CODE + n, it,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                if (Build.VERSION.SDK_INT >= 31) am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
                else am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
                n++;
            }
            for (int i = n; i < MAX_ALERTS; i++) { // cancel what an earlier schedule left
                PendingIntent pi = PendingIntent.getBroadcast(ctx, FIRST_CODE + i, new Intent(ctx, PrayerAlert.class),
                        PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
                if (pi != null) { am.cancel(pi); pi.cancel(); }
            }
        } catch (Exception e) {
            android.util.Log.w("HomeDash", "scheduling prayer alerts failed: " + e);
        }
    }

    @Override
    public void onReceive(Context ctx, Intent intent) {
        if (homeVisible) return; // the home screen shows its own banner
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        // High importance so it shows as a banner over other apps, but without sound or vibration.
        NotificationChannel ch = new NotificationChannel(CHANNEL, "Prayer times", NotificationManager.IMPORTANCE_HIGH);
        ch.setSound(null, null);
        ch.enableVibration(false);
        ch.enableLights(false);
        ch.setShowBadge(false);
        nm.createNotificationChannel(ch);
        PendingIntent open = PendingIntent.getActivity(ctx, 0,
                new Intent(ctx, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification n = new Notification.Builder(ctx, CHANNEL)
                .setSmallIcon(prayerIcon(ctx))
                .setContentTitle(intent.getStringExtra("title"))
                .setContentText(intent.getStringExtra("text"))
                .setCategory(Notification.CATEGORY_REMINDER)
                .setOnlyAlertOnce(true)
                .setAutoCancel(true)
                .setContentIntent(open)
                .setTimeoutAfter(intent.getIntExtra("minutes", 10) * 60000L)
                .build();
        nm.notify(NOTIFICATION_ID, n);
    }

    /** The notification icon, looked up by name: R is generated per build in the flavor's package. */
    private static int prayerIcon(Context ctx) {
        int id = ctx.getResources().getIdentifier("ic_prayer", "drawable", ctx.getPackageName());
        return id != 0 ? id : android.R.drawable.ic_popup_reminder;
    }
}
