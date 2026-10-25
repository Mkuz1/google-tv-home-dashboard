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
    }

    @Override
    protected void onResume() {
        super.onResume();
        hideSystemUi();
        if (web != null) {
            web.requestFocus();
            js("window.onTvResume && window.onTvResume()");
        }
    }

    @Override
    protected void onPause() {
        js("window.onTvPause && window.onTvPause()");
        super.onPause();
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
