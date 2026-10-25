package com.mk.homedash;

import android.service.dreams.DreamService;
import android.webkit.WebView;

/** Screensaver: the dashboard (clock, weather, prayer times, azkar) over nature scenes. */
public class DashboardDream extends DreamService {

    private WebView web;

    @Override
    public void onAttachedToWindow() {
        super.onAttachedToWindow();
        setInteractive(false); // any button press wakes the TV back to what was on screen
        setFullscreen(true);
        setScreenBright(true);
        web = Web.create(this, "screensaver.html");
        setContentView(web);
    }

    @Override
    public void onDetachedFromWindow() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDetachedFromWindow();
    }
}
