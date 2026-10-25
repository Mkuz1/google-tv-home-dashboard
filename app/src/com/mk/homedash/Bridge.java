package com.mk.homedash;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.ApplicationInfo;
import android.os.Bundle;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.AdaptiveIconDrawable;
import android.graphics.drawable.BitmapDrawable;
import android.graphics.drawable.Drawable;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.net.wifi.WifiManager;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Base64;
import android.util.Log;
import android.app.AlertDialog;
import android.content.DialogInterface;
import android.view.KeyEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.view.inputmethod.EditorInfo;
import android.webkit.WebView;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.TextView;
import android.webkit.JavascriptInterface;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Methods the web pages call as TV.methodName(). Shared by the home screen and the screensaver. */
public class Bridge {

    /** "tv" or "car": the manifest's flavor meta-data (app/ or car/AndroidManifest.xml). */
    static String flavor(Context context) {
        try {
            Bundle meta = context.getPackageManager()
                    .getApplicationInfo(context.getPackageName(), PackageManager.GET_META_DATA).metaData;
            String f = meta == null ? null : meta.getString("flavor");
            return f == null ? "tv" : f;
        } catch (Exception e) {
            return "tv";
        }
    }

    private final Context context;
    private final boolean car;
    private final Handler main = new Handler(Looper.getMainLooper());
    private static final Map<String, String> iconCache = new HashMap<>();

    private View view;

    public Bridge(Context context) {
        this.context = context;
        this.car = "car".equals(flavor(context));
    }

    @JavascriptInterface
    public String flavor() {
        return car ? "car" : "tv";
    }

    /**
     * Screen brightness while the home screen is in front, 0-1, or below 0 for the system's own
     * setting (the car home screen's eye comfort button). Other apps keep the system brightness.
     */
    @JavascriptInterface
    public void setBrightness(final float level) {
        if (!(context instanceof Activity)) return;
        main.post(new Runnable() {
            @Override public void run() {
                Window w = ((Activity) context).getWindow();
                WindowManager.LayoutParams lp = w.getAttributes();
                lp.screenBrightness = level < 0 ? WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE
                        : Math.max(0.02f, Math.min(1f, level));
                w.setAttributes(lp);
            }
        });
    }

    /** The car's last GPS position {lat, lon, at, city, country} (car build), or null. */
    @JavascriptInterface
    public String carLocation() {
        String v = context.getSharedPreferences("home", Context.MODE_PRIVATE).getString("carLocation", null);
        return v == null ? "null" : v;
    }

    /** Silent prayer banners for when another app is in front: [{at, title, text, minutes}]. */
    @JavascriptInterface
    public void schedulePrayerAlerts(String json) {
        PrayerAlert.schedule(context, json);
    }

    /** Direction and speed of the car from its last GPS fix: {bearing (-1 unknown), speed m/s, at}. */
    @JavascriptInterface
    public String carMotion() {
        try {
            return new JSONObject().put("bearing", CarLocation.bearing).put("speed", CarLocation.speed)
                    .put("at", CarLocation.fixAt).toString();
        } catch (Exception e) {
            return "null";
        }
    }

    /** Opens a geo: or google.navigation: link in Google Maps only; false if Maps isn't installed. */
    @JavascriptInterface
    public boolean openMaps(String uri) {
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(uri)).setPackage("com.google.android.apps.maps");
        if (i.resolveActivity(context.getPackageManager()) == null) return false;
        start(i);
        return true;
    }

    /** The travel dua as a silent banner over the navigation app that was just opened. */
    @JavascriptInterface
    public void notifyTravelDua(String title, String text) {
        PrayerAlert.show(context, title, text, 10, 8);
    }

    /** Bumped whenever an app is installed, removed or updated (MainActivity listens). */
    static volatile int appsStamp = 0;

    /** Lets the page skip re-reading every app icon when nothing was installed or removed. */
    @JavascriptInterface
    public int appsStamp() {
        return appsStamp;
    }

    /** The WebView this bridge serves; prompt answers are sent back to it. */
    void attach(View view) {
        this.view = view;
    }

    /**
     * Native text prompt with the TV keyboard (a WebView text field can't get the keyboard
     * when it was focused by script). Calls window.onPrompt(text) in the page, or null if cancelled.
     */
    @JavascriptInterface
    public void promptText(final String title, final String value) {
        main.post(new Runnable() {
            @Override public void run() {
                final EditText input = new EditText(context);
                input.setText(value);
                input.setSingleLine(true);
                input.setSelectAllOnFocus(true);
                input.setImeOptions(EditorInfo.IME_ACTION_DONE);
                FrameLayout box = new FrameLayout(context);
                int pad = Math.round(24 * context.getResources().getDisplayMetrics().density);
                box.setPadding(pad, pad / 2, pad, 0);
                box.addView(input);

                final AlertDialog dialog = new AlertDialog.Builder(context, android.R.style.Theme_DeviceDefault_Dialog_Alert)
                        .setTitle(title)
                        .setView(box)
                        .setPositiveButton("Save", new DialogInterface.OnClickListener() {
                            @Override public void onClick(DialogInterface d, int which) { answer(input.getText().toString()); }
                        })
                        .setNegativeButton("Cancel", new DialogInterface.OnClickListener() {
                            @Override public void onClick(DialogInterface d, int which) { answer(null); }
                        })
                        .setOnCancelListener(new DialogInterface.OnCancelListener() {
                            @Override public void onCancel(DialogInterface d) { answer(null); }
                        })
                        .create();
                input.setOnEditorActionListener(new TextView.OnEditorActionListener() {
                    @Override public boolean onEditorAction(TextView v, int actionId, KeyEvent event) {
                        dialog.dismiss();
                        answer(input.getText().toString());
                        return true;
                    }
                });
                dialog.getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE);
                dialog.show();
                input.requestFocus();
                input.selectAll(); // typing replaces the old name
            }
        });
    }

    private void answer(String text) {
        if (!(view instanceof WebView)) return;
        String arg = text == null ? "null" : JSONObject.quote(text);
        ((WebView) view).evaluateJavascript("window.onPrompt && window.onPrompt(" + arg + ")", null);
    }

    private void start(final Intent i) {
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        main.post(new Runnable() {
            @Override public void run() {
                try {
                    context.startActivity(i);
                } catch (Exception ignored) {
                }
            }
        });
    }

    private String iconFor(ActivityInfo info) {
        String key = info.packageName + "/" + info.name;
        String cached = iconCache.get(key);
        if (cached != null) return cached;
        PackageManager pm = context.getPackageManager();
        // TV: the wide banner when there is one. Car: always the square icon (CarPlay style).
        Drawable d = car ? null : info.loadBanner(pm);
        boolean banner = d != null;
        if (d == null) d = info.loadIcon(pm);
        String uri = "";
        boolean adaptive = car && d instanceof AdaptiveIconDrawable;
        if (adaptive) {
            uri = fullBleed((AdaptiveIconDrawable) d);
        } else if (d != null) {
            int w = banner ? 480 : 192;
            int h = banner ? 270 : 192;
            if (d instanceof BitmapDrawable && ((BitmapDrawable) d).getBitmap() != null) {
                Bitmap src = ((BitmapDrawable) d).getBitmap();
                w = Math.min(src.getWidth(), w);
                h = Math.round(w * (src.getHeight() / (float) src.getWidth()));
            }
            Bitmap bmp = Bitmap.createBitmap(Math.max(w, 1), Math.max(h, 1), Bitmap.Config.ARGB_8888);
            Canvas c = new Canvas(bmp);
            d.setBounds(0, 0, c.getWidth(), c.getHeight());
            d.draw(c);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            bmp.compress(Bitmap.CompressFormat.PNG, 100, out);
            uri = "data:image/png;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
        }
        // B = banner, F = full-bleed square icon, I = any other icon (shown smaller on a tile).
        String result = (banner ? "B" : adaptive ? "F" : "I") + uri;
        iconCache.put(key, result);
        return result;
    }

    /**
     * An adaptive icon's layers without the system mask (circle, teardrop...), so every icon
     * gets the same rounded square in the page. The visible part is the middle 72 of 108 dp.
     */
    private static String fullBleed(AdaptiveIconDrawable d) {
        int size = 192, pad = size / 4;
        Bitmap bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(bmp);
        for (Drawable layer : new Drawable[] {d.getBackground(), d.getForeground()}) {
            if (layer == null) continue;
            layer.setBounds(-pad, -pad, size + pad, size + pad);
            layer.draw(c);
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        bmp.compress(Bitmap.CompressFormat.PNG, 100, out);
        return "data:image/png;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
    }

    /** All launchable TV apps: [{pkg, label, banner, system, icon}]. */
    @JavascriptInterface
    public String apps() {
        PackageManager pm = context.getPackageManager();
        JSONArray arr = new JSONArray();
        Set<String> seen = new HashSet<>();
        String[] categories = car
                ? new String[] {Intent.CATEGORY_LAUNCHER}
                : new String[] {Intent.CATEGORY_LEANBACK_LAUNCHER, Intent.CATEGORY_LAUNCHER};
        for (String cat : categories) {
            Intent q = new Intent(Intent.ACTION_MAIN).addCategory(cat);
            List<ResolveInfo> list = pm.queryIntentActivities(q, 0);
            for (ResolveInfo ri : list) {
                String pkg = ri.activityInfo.packageName;
                if (!seen.add(pkg)) continue;
                try {
                    String icon = iconFor(ri.activityInfo);
                    ApplicationInfo ai = ri.activityInfo.applicationInfo;
                    JSONObject o = new JSONObject();
                    o.put("pkg", pkg);
                    o.put("label", ri.loadLabel(pm).toString());
                    o.put("banner", icon.startsWith("B"));
                    o.put("small", icon.startsWith("I"));
                    o.put("system", (ai.flags & ApplicationInfo.FLAG_SYSTEM) != 0);
                    o.put("category", ai.category); // used to name new folders, like Apple TV does
                    o.put("icon", icon.substring(1));
                    arr.put(o);
                } catch (Exception ignored) {
                }
            }
        }
        return arr.toString();
    }

    @JavascriptInterface
    public boolean launch(String pkg) {
        PackageManager pm = context.getPackageManager();
        Intent i = car ? null : pm.getLeanbackLaunchIntentForPackage(pkg);
        if (i == null) i = pm.getLaunchIntentForPackage(pkg);
        if (i == null) return false;
        start(i);
        return true;
    }

    /* ---------------- TV location (from its internet connection) ---------------- */

    private static volatile boolean locating = false;

    /** Last detected location: {lat, lon, city, country, at}, or null. */
    @JavascriptInterface
    public String location() {
        String v = context.getSharedPreferences("home", Context.MODE_PRIVATE).getString("location", null);
        return v == null ? "null" : v;
    }

    /** Looks the location up in the background (TVs have no GPS); location() has it when done. */
    @JavascriptInterface
    public void locate() {
        if (locating) return;
        locating = true;
        new Thread(new Runnable() {
            @Override public void run() {
                try {
                    JSONObject o = null;
                    try {
                        JSONObject r = new JSONObject(httpGet("https://ipwho.is/?fields=success,city,country_code,latitude,longitude"));
                        if (r.optBoolean("success")) {
                            o = new JSONObject().put("lat", r.getDouble("latitude")).put("lon", r.getDouble("longitude"))
                                    .put("city", r.optString("city")).put("country", r.optString("country_code"));
                        }
                    } catch (Exception e) {
                        Log.w("HomeDash", "ipwho.is failed: " + e);
                    }
                    if (o == null) {
                        JSONObject r = new JSONObject(httpGet("https://ipapi.co/json/"));
                        o = new JSONObject().put("lat", r.getDouble("latitude")).put("lon", r.getDouble("longitude"))
                                .put("city", r.optString("city")).put("country", r.optString("country_code"));
                    }
                    o.put("at", System.currentTimeMillis());
                    setPref("location", o.toString());
                    Log.i("HomeDash", "location: " + o.optString("city") + ", " + o.optString("country"));
                } catch (Exception e) {
                    Log.w("HomeDash", "location lookup failed: " + e);
                } finally {
                    locating = false;
                }
            }
        }).start();
    }

    /* ---------------- Google Photos shared albums ---------------- */

    private static final Pattern ALBUM_PHOTO =
            Pattern.compile("\\[\"(https://lh3\\.googleusercontent\\.com/pw/[A-Za-z0-9_\\-]+)\",(\\d+),(\\d+)");
    private static volatile boolean refreshing = false;

    /** Per-TV settings overrides (settings.json pushed with ./tv.sh settings), or null. */
    @JavascriptInterface
    public String settings() {
        File f = new File(context.getExternalFilesDir(null), "settings.json");
        try {
            return new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return "null";
        }
    }

    /** Album share links, set from the Mac with ./tv.sh albums. */
    @JavascriptInterface
    public String albums() {
        File f = new File(context.getExternalFilesDir(null), "albums.json");
        try {
            return new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return "[]";
        }
    }

    /** Photo URLs found in the albums on the last refresh: {at, photos: [...]}. */
    @JavascriptInterface
    public String albumPhotos() {
        String v = context.getSharedPreferences("home", Context.MODE_PRIVATE).getString("album.photos", null);
        return v == null ? "{\"at\":0,\"photos\":[]}" : v;
    }

    /** Re-reads every album link in the background; albumPhotos() has the result when done. */
    @JavascriptInterface
    public void refreshAlbums() {
        if (refreshing) return;
        refreshing = true;
        new Thread(new Runnable() {
            @Override public void run() {
                try {
                    String linksJson = albums();
                    JSONArray links = new JSONArray(linksJson);
                    Set<String> photos = new LinkedHashSet<>();
                    boolean anyOk = false;
                    for (int i = 0; i < links.length(); i++) {
                        try {
                            Matcher m = ALBUM_PHOTO.matcher(httpGet(links.getString(i)));
                            while (m.find()) {
                                // Skip tiny images (avatars, icons); keep real photos.
                                if (Integer.parseInt(m.group(2)) >= 640) photos.add(m.group(1));
                            }
                            anyOk = true;
                        } catch (Exception e) {
                            Log.w("HomeDash", "album " + i + " failed: " + e);
                        }
                    }
                    if (anyOk || links.length() == 0) {
                        JSONObject o = new JSONObject();
                        o.put("at", System.currentTimeMillis());
                        o.put("links", linksJson);
                        o.put("photos", new JSONArray(photos));
                        setPref("album.photos", o.toString());
                        Log.i("HomeDash", "albums: " + photos.size() + " photos from " + links.length() + " links");
                    }
                } catch (Exception e) {
                    Log.w("HomeDash", "album refresh failed: " + e);
                } finally {
                    refreshing = false;
                }
            }
        }).start();
    }

    private static String httpGet(String url) throws Exception {
        for (int hop = 0; hop < 6; hop++) {
            HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
            c.setInstanceFollowRedirects(false);
            c.setConnectTimeout(15000);
            c.setReadTimeout(30000);
            c.setRequestProperty("User-Agent",
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36");
            c.setRequestProperty("Accept-Language", "en");
            int code = c.getResponseCode();
            if (code >= 300 && code < 400) {
                url = new URL(new URL(url), c.getHeaderField("Location")).toString();
                c.disconnect();
                continue;
            }
            if (code != 200) throw new Exception("HTTP " + code);
            try (InputStream in = c.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                byte[] buf = new byte[16384];
                for (int n; (n = in.read(buf)) > 0; ) out.write(buf, 0, n);
                return out.toString("UTF-8");
            } finally {
                c.disconnect();
            }
        }
        throw new Exception("too many redirects");
    }

    /** Small persistent key/value store (home order, hidden apps), written to disk immediately. */
    @JavascriptInterface
    public String getPref(String key) {
        return context.getSharedPreferences("home", Context.MODE_PRIVATE).getString(key, null);
    }

    @JavascriptInterface
    public void setPref(String key, String value) {
        context.getSharedPreferences("home", Context.MODE_PRIVATE).edit().putString(key, value).commit();
    }

    /** Opens the system "Uninstall this app?" confirmation. */
    @JavascriptInterface
    public void uninstall(String pkg) {
        start(new Intent(Intent.ACTION_DELETE, Uri.parse("package:" + pkg)));
    }

    @JavascriptInterface
    public void openSettings() {
        start(new Intent(Settings.ACTION_SETTINGS));
    }

    @JavascriptInterface
    public void openWifiSettings() {
        start(new Intent(Settings.ACTION_WIFI_SETTINGS));
    }

    /** {type: "wifi" | "ethernet" | "none", level: 0-4}. */
    @JavascriptInterface
    public String network() {
        JSONObject o = new JSONObject();
        try {
            ConnectivityManager cm = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
            Network n = cm.getActiveNetwork();
            NetworkCapabilities caps = n == null ? null : cm.getNetworkCapabilities(n);
            String type = "none";
            int level = 0;
            if (caps != null && caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)) {
                type = "ethernet";
                level = 4;
            } else if (caps != null && caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) {
                type = "wifi";
                WifiManager wm = (WifiManager) context.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
                level = WifiManager.calculateSignalLevel(wm.getConnectionInfo().getRssi(), 5);
            }
            o.put("type", type);
            o.put("level", level);
            o.put("internet", caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED));
        } catch (Exception ignored) {
        }
        return o.toString();
    }

    /** Background photos pushed to the app's photo folder, as file:// URLs. */
    @JavascriptInterface
    public String photos() {
        JSONArray arr = new JSONArray();
        File dir = photoDir();
        File[] files = dir == null ? null : dir.listFiles();
        if (files != null) {
            Arrays.sort(files);
            for (File f : files) {
                String n = f.getName().toLowerCase();
                if (n.endsWith(".jpg") || n.endsWith(".jpeg") || n.endsWith(".png") || n.endsWith(".webp")) {
                    arr.put("file://" + f.getAbsolutePath());
                }
            }
        }
        return arr.toString();
    }

    @JavascriptInterface
    public String photoFolder() {
        File dir = photoDir();
        return dir == null ? "" : dir.getAbsolutePath();
    }

    private File photoDir() {
        File dir = context.getExternalFilesDir("photos");
        if (dir != null && !dir.exists()) dir.mkdirs();
        return dir;
    }
}
