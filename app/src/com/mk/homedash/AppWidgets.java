package com.mk.homedash;

import android.app.Activity;
import android.appwidget.AppWidgetHost;
import android.appwidget.AppWidgetHostView;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProviderInfo;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Outline;
import android.graphics.drawable.Drawable;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Base64;
import android.view.HapticFeedbackConstants;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewConfiguration;
import android.view.ViewOutlineProvider;
import android.webkit.WebView;
import android.widget.FrameLayout;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/**
 * Phone: widgets of other apps (Android app widgets) on the home pages. The page lays out a glass
 * card for each one and tells us where it is; the real widget view sits above the WebView at that
 * spot. When anything covers the page (edit mode, a menu, a sheet, a page turning) the page hides
 * the real views and shows a picture of them instead, so its own animations stay smooth.
 */
final class AppWidgets {
    static AppWidgets instance;

    private static final int HOST_ID = 0x4d4b;
    static final int REQ_BIND = 101, REQ_CONFIG = 102;

    private final Activity act;
    private final WebView web;
    private final FrameLayout layer;
    private final AppWidgetManager mgr;
    private final AppWidgetHost host;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final Map<Integer, Wrap> views = new HashMap<>();
    private int pending = -1;

    AppWidgets(Activity act, WebView web, FrameLayout layer) {
        this.act = act;
        this.web = web;
        this.layer = layer;
        mgr = AppWidgetManager.getInstance(act);
        host = new AppWidgetHost(act.getApplicationContext(), HOST_ID);
    }

    void start() {
        try { host.startListening(); } catch (Exception ignored) { }
    }

    void stop() {
        try { host.stopListening(); } catch (Exception ignored) { }
    }

    private float density() {
        return act.getResources().getDisplayMetrics().density;
    }

    /** Every app widget on the phone: [{prov, label, pkg, app, w, h (dp), cw, ch (cells, or 0)}]. */
    String providers() {
        JSONArray out = new JSONArray();
        PackageManager pm = act.getPackageManager();
        float d = density();
        for (AppWidgetProviderInfo info : mgr.getInstalledProviders()) {
            try {
                JSONObject o = new JSONObject();
                String pkg = info.provider.getPackageName();
                o.put("prov", info.provider.flattenToString());
                o.put("label", info.loadLabel(pm));
                o.put("pkg", pkg);
                o.put("app", pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString());
                o.put("w", Math.round(info.minWidth / d));
                o.put("h", Math.round(info.minHeight / d));
                if (android.os.Build.VERSION.SDK_INT >= 31) {
                    o.put("cw", info.targetCellWidth);
                    o.put("ch", info.targetCellHeight);
                }
                out.put(o);
            } catch (Exception ignored) { }
        }
        return out.toString();
    }

    /** The widget's preview picture (or its icon) as a data URI, "" if it has none. */
    String preview(String prov) {
        try {
            ComponentName cn = ComponentName.unflattenFromString(prov);
            for (AppWidgetProviderInfo info : mgr.getInstalledProviders()) {
                if (!info.provider.equals(cn)) continue;
                Drawable dr = info.loadPreviewImage(act, 0);
                if (dr == null) dr = info.loadIcon(act, 0);
                if (dr == null) return "";
                int w = Math.max(1, dr.getIntrinsicWidth()), h = Math.max(1, dr.getIntrinsicHeight());
                float k = Math.min(1f, 480f / Math.max(w, h));
                Bitmap b = Bitmap.createBitmap(Math.max(1, (int) (w * k)), Math.max(1, (int) (h * k)), Bitmap.Config.ARGB_8888);
                dr.setBounds(0, 0, b.getWidth(), b.getHeight());
                dr.draw(new Canvas(b));
                return uri(b, true);
            }
        } catch (Exception ignored) { }
        return "";
    }

    /**
     * Adds a widget: Android asks the user once to allow this launcher to create widgets, then the
     * widget's own setup screen if it has one. The page hears window.onAppWidgetBound(id, ok).
     */
    void bind(final String prov) {
        main.post(new Runnable() {
            @Override public void run() {
                ComponentName cn = ComponentName.unflattenFromString(prov);
                int id = host.allocateAppWidgetId();
                pending = id;
                boolean ok;
                try { ok = mgr.bindAppWidgetIdIfAllowed(id, cn); } catch (Exception e) { ok = false; }
                if (ok) { configure(id); return; }
                Intent i = new Intent(AppWidgetManager.ACTION_APPWIDGET_BIND)
                        .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id)
                        .putExtra(AppWidgetManager.EXTRA_APPWIDGET_PROVIDER, cn);
                try {
                    act.startActivityForResult(i, REQ_BIND);
                } catch (Exception e) {
                    done(id, false);
                }
            }
        });
    }

    private void configure(int id) {
        AppWidgetProviderInfo info = mgr.getAppWidgetInfo(id);
        if (info != null && info.configure != null) {
            try {
                host.startAppWidgetConfigureActivityForResult(act, id, 0, REQ_CONFIG, null);
                return;
            } catch (Exception ignored) { /* no setup screen we may open: add it as it is */ }
        }
        done(id, true);
    }

    /** From MainActivity.onActivityResult. */
    boolean onResult(int req, int result, Intent data) {
        if (req != REQ_BIND && req != REQ_CONFIG) return false;
        int id = data != null ? data.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, pending) : pending;
        if (id < 0) id = pending;
        if (result != Activity.RESULT_OK) done(id, false);
        else if (req == REQ_BIND) configure(id);
        else done(id, true);
        return true;
    }

    private void done(int id, boolean ok) {
        pending = -1;
        if (!ok && id >= 0) delete(id);
        js("window.onAppWidgetBound && window.onAppWidgetBound(" + id + "," + ok + ")");
    }

    void delete(final int id) {
        main.post(new Runnable() {
            @Override public void run() {
                Wrap w = views.remove(id);
                if (w != null) layer.removeView(w);
                try { host.deleteAppWidgetId(id); } catch (Exception ignored) { }
            }
        });
    }

    /**
     * Where the widgets on screen are: [{id, x, y, w, h, r}] in page pixels (r = corner radius).
     * Widgets not listed are hidden.
     */
    void place(final String json) {
        main.post(new Runnable() {
            @Override public void run() {
                float d = density();
                Set<Integer> shown = new HashSet<>();
                try {
                    JSONArray a = new JSONArray(json);
                    for (int i = 0; i < a.length(); i++) {
                        JSONObject o = a.getJSONObject(i);
                        int id = o.getInt("id");
                        Wrap w = view(id);
                        if (w == null) continue;
                        shown.add(id);
                        int x = Math.round((float) o.getDouble("x") * d), y = Math.round((float) o.getDouble("y") * d);
                        int ww = Math.round((float) o.getDouble("w") * d), hh = Math.round((float) o.getDouble("h") * d);
                        w.radius = (float) o.optDouble("r", 22) * d;
                        FrameLayout.LayoutParams lp = (FrameLayout.LayoutParams) w.getLayoutParams();
                        if (lp.width != ww || lp.height != hh || lp.leftMargin != x || lp.topMargin != y) {
                            boolean resized = lp.width != ww || lp.height != hh;
                            lp.width = ww; lp.height = hh; lp.leftMargin = x; lp.topMargin = y;
                            w.setLayoutParams(lp);
                            w.invalidateOutline();
                            if (resized) {
                                int wd = Math.round(ww / d), hd = Math.round(hh / d);
                                try { w.hv.updateAppWidgetSize(null, wd, hd, wd, hd); } catch (Exception ignored) { }
                            }
                        }
                        w.setVisibility(View.VISIBLE);
                    }
                } catch (Exception ignored) { }
                for (Map.Entry<Integer, Wrap> e : views.entrySet()) {
                    if (!shown.contains(e.getKey())) e.getValue().setVisibility(View.INVISIBLE);
                }
            }
        });
    }

    /** Draws the widget into a picture for the page (window.onAppWidgetShot(id, uri)). */
    void shot(final int id) {
        main.post(new Runnable() {
            @Override public void run() {
                Wrap w = views.get(id);
                if (w == null || w.getWidth() == 0 || w.getHeight() == 0) return;
                try {
                    float k = Math.min(1f, 600f / Math.max(w.getWidth(), w.getHeight()));
                    Bitmap b = Bitmap.createBitmap(Math.max(1, (int) (w.getWidth() * k)), Math.max(1, (int) (w.getHeight() * k)), Bitmap.Config.ARGB_8888);
                    Canvas c = new Canvas(b);
                    c.scale(k, k);
                    w.hv.draw(c);
                    js("window.onAppWidgetShot && window.onAppWidgetShot(" + id + ",'" + uri(b, true) + "')");
                } catch (Exception ignored) { }
            }
        });
    }

    private Wrap view(int id) {
        Wrap w = views.get(id);
        if (w != null) return w;
        AppWidgetProviderInfo info = mgr.getAppWidgetInfo(id);
        if (info == null) return null;
        AppWidgetHostView hv = host.createView(act.getApplicationContext(), id, info);
        hv.setPadding(0, 0, 0, 0);
        w = new Wrap(id, hv);
        layer.addView(w, new FrameLayout.LayoutParams(1, 1));
        views.put(id, w);
        return w;
    }

    private static String uri(Bitmap b, boolean png) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        b.compress(png ? Bitmap.CompressFormat.PNG : Bitmap.CompressFormat.JPEG, 85, out);
        return (png ? "data:image/png;base64," : "data:image/jpeg;base64,") + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
    }

    private void js(final String code) {
        main.post(new Runnable() {
            @Override public void run() { web.evaluateJavascript(code, null); }
        });
    }

    /**
     * One widget, with rounded corners like the page's glass cards. A hold opens the launcher's menu
     * for it, and a sideways swipe goes to the page so it turns the page, like over any other widget.
     */
    private final class Wrap extends FrameLayout {
        final int id;
        final AppWidgetHostView hv;
        float radius = 40;
        private float x0, y0;
        private long down0;
        private boolean forwarding, held;
        private final int slop = ViewConfiguration.get(act).getScaledTouchSlop();
        private final Runnable hold = new Runnable() {
            @Override public void run() {
                held = true;
                performHapticFeedback(HapticFeedbackConstants.LONG_PRESS);
                js("window.onAppWidgetHold && window.onAppWidgetHold(" + id + ")");
            }
        };

        Wrap(int id, AppWidgetHostView hv) {
            super(act);
            this.id = id;
            this.hv = hv;
            addView(hv, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
            setOutlineProvider(new ViewOutlineProvider() {
                @Override public void getOutline(View v, Outline o) {
                    o.setRoundRect(0, 0, v.getWidth(), v.getHeight(), radius);
                }
            });
            setClipToOutline(true);
        }

        @Override
        public boolean onInterceptTouchEvent(MotionEvent ev) {
            switch (ev.getActionMasked()) {
                case MotionEvent.ACTION_DOWN:
                    x0 = ev.getRawX(); y0 = ev.getRawY(); down0 = ev.getDownTime();
                    forwarding = false; held = false;
                    postDelayed(hold, 450);
                    return false;
                case MotionEvent.ACTION_MOVE:
                    float dx = ev.getRawX() - x0, dy = ev.getRawY() - y0;
                    if (Math.hypot(dx, dy) > slop) removeCallbacks(hold);
                    if (!held && Math.abs(dx) > slop * 1.5f && Math.abs(dx) > Math.abs(dy) * 1.2f) {
                        // A page swipe: hand the gesture to the page, starting where the finger went down.
                        forwarding = true;
                        toWeb(MotionEvent.obtain(down0, SystemClock.uptimeMillis(), MotionEvent.ACTION_DOWN, x0, y0, 0), true);
                        return true;
                    }
                    return held;
                case MotionEvent.ACTION_UP:
                case MotionEvent.ACTION_CANCEL:
                    removeCallbacks(hold);
                    return held;
            }
            return held;
        }

        @Override
        public boolean onTouchEvent(MotionEvent ev) {
            if (forwarding) {
                MotionEvent e = MotionEvent.obtain(ev);
                e.setLocation(ev.getRawX(), ev.getRawY());
                toWeb(e, true);
            }
            int a = ev.getActionMasked();
            if (a == MotionEvent.ACTION_UP || a == MotionEvent.ACTION_CANCEL) { forwarding = false; held = false; }
            return true;
        }

        /** e in screen coordinates; moved into the WebView's. */
        private void toWeb(MotionEvent e, boolean recycle) {
            int[] at = new int[2];
            web.getLocationOnScreen(at);
            e.offsetLocation(-at[0], -at[1]);
            web.dispatchTouchEvent(e);
            if (recycle) e.recycle();
        }
    }
}
