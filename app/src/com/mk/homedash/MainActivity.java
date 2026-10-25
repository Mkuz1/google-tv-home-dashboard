package com.mk.homedash;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;

/** Home screen: a full-screen WebView showing assets/home.html (TV) or assets/car.html (car). */
public class MainActivity extends Activity {

    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
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
        // Another app is in front: the car home screen stops counting idle time for its screensaver.
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
