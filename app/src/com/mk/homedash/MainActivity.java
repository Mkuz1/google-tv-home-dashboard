package com.mk.homedash;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;

/** Home screen: a full-screen WebView showing assets/home.html (TV) or assets/car.html (car). */
public class MainActivity extends Activity {

    private WebView web;
    private CarLocation location; // car only: GPS for prayer times
    private boolean car;
    private long unsplitAt;

    // App installed, removed or updated: the page re-reads the app list next time it shows.
    private final BroadcastReceiver packages = new BroadcastReceiver() {
        @Override public void onReceive(Context c, Intent i) {
            Bridge.appsStamp++;
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        IntentFilter f = new IntentFilter();
        f.addAction(Intent.ACTION_PACKAGE_ADDED);
        f.addAction(Intent.ACTION_PACKAGE_REMOVED);
        f.addAction(Intent.ACTION_PACKAGE_CHANGED);
        f.addAction(Intent.ACTION_PACKAGE_REPLACED);
        f.addDataScheme("package");
        registerReceiver(packages, f);
        // No FLAG_KEEP_SCREEN_ON here: the screensaver must be able to start on top of Home.
        web = Web.create(this, "car".equals(Bridge.flavor(this)) ? "car.html" : "home.html");
        setContentView(web);
        hideSystemUi();
        web.requestFocus();
        car = "car".equals(Bridge.flavor(this));
        if (car) {
            location = new CarLocation(this);
            location.start();
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        if (requestCode == CarLocation.PERMISSION_REQUEST && location != null) location.permissionResult();
    }

    @Override
    protected void onResume() {
        super.onResume();
        leaveSplit();
        // Again once laid out, for the width check.
        getWindow().getDecorView().postDelayed(new Runnable() {
            @Override public void run() { leaveSplit(); }
        }, 400);
        PrayerAlert.homeVisible = true;
        hideSystemUi();
        if (web != null) {
            web.requestFocus();
            js("window.onTvResume && window.onTvResume()");
        }
    }

    @Override
    protected void onPause() {
        PrayerAlert.homeVisible = false;
        js("window.onTvPause && window.onTvPause()");
        super.onPause();
    }

    @Override
    public void onMultiWindowModeChanged(boolean inMultiWindow) {
        super.onMultiWindowModeChanged(inMultiWindow);
        leaveSplit();
    }

    /**
     * Home pressed while two apps were side by side: Android keeps the split and shows Home squeezed
     * next to a strip of the first app. With the MK Split Screen helper on, close the split and come
     * back full screen. Not while a split pair is being opened (Home briefly shows beside the first app).
     */
    private void leaveSplit() {
        if (!car || !inSplit() || !Bridge.splitHelperOn(this)) return;
        long now = System.currentTimeMillis();
        if (now - Bridge.splitLaunchAt < 6000 || now - unsplitAt < 4000) return;
        unsplitAt = now;
        Bridge.toggleSplit(this);
        // Leaving split brings the first app to full screen; put Home back in front of it.
        getWindow().getDecorView().postDelayed(new Runnable() {
            @Override public void run() {
                startActivity(new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
                        .setPackage(getPackageName()).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            }
        }, 700);
    }

    /** In split screen, or (on firmwares that don't say so) drawn much narrower than the screen. */
    private boolean inSplit() {
        if (isInMultiWindowMode()) return true;
        android.graphics.Point screen = new android.graphics.Point();
        getWindowManager().getDefaultDisplay().getRealSize(screen);
        int w = getWindow().getDecorView().getWidth();
        return screen.x > screen.y && w > 0 && w < screen.x * 0.85;
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // Home pressed while already home: jump back to the top row.
        js("window.onTvHome && window.onTvHome()");
    }

    @Override
    public void onBackPressed() {
        // This is the home screen; Back only closes menus inside the page.
        js("window.onTvBack && window.onTvBack()");
    }

    @Override
    protected void onDestroy() {
        unregisterReceiver(packages);
        if (location != null) location.stop();
        super.onDestroy();
    }

    private void js(String code) {
        if (web != null) web.evaluateJavascript(code, null);
    }

    private void hideSystemUi() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }
}
