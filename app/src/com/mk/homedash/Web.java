package com.mk.homedash;

import android.content.Context;
import android.graphics.Color;
import android.util.Log;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** Builds the WebView used by both the home screen and the screensaver. */
final class Web {
    private Web() {
    }

    static WebView create(Context context, String page) {
        WebView web = new WebView(context);
        web.setBackgroundColor(Color.BLACK);
        web.setFocusable(true);
        web.setFocusableInTouchMode(true);
        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage m) {
                Log.i("HomeDash", m.message() + " (" + m.sourceId() + ":" + m.lineNumber() + ")");
                return true;
            }
        });

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);
        s.setMediaPlaybackRequiresUserGesture(false);

        Bridge bridge = new Bridge(context);
        bridge.attach(web);
        web.addJavascriptInterface(bridge, "TV");
        web.loadUrl("file:///android_asset/" + page);
        return web;
    }
}
