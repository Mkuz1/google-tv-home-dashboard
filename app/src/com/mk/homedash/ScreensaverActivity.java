package com.mk.homedash;

import android.app.Activity;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebView;

/**
 * The screensaver as a full-screen page, for car head units that have no screensaver setting:
 * the car home screen opens it after a few idle minutes. Any touch or button closes it.
 */
public class ScreensaverActivity extends Activity {

    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        web = Web.create(this, "screensaver.html");
        setContentView(web);
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }

    @Override
    public boolean dispatchTouchEvent(MotionEvent e) {
        if (e.getActionMasked() == MotionEvent.ACTION_UP) finish();
        return true; // the page underneath never sees the touch
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        if (e.getAction() == KeyEvent.ACTION_UP) finish();
        return true;
    }

    @Override
    protected void onStop() {
        super.onStop();
        finish(); // another app took over (navigation, phone call): don't come back to the screensaver
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
