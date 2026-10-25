// Stand-in for the Android "TV" bridge when previewing in a desktop browser.
(function () {
  if (window.TV) return;
  const banner = (label, bg, fg = "#fff") => "data:image/svg+xml," + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="${bg}"/><text x="160" y="104" font-family="Helvetica" font-weight="700" font-size="38" fill="${fg}" text-anchor="middle">${label}</text></svg>`);
  let apps = [
    ["com.google.android.youtube.tv", "YouTube", "#FFFFFF", "#FF0033"], ["com.netflix.ninja", "Netflix", "#000", "#E50914"],
    ["com.amazon.amazonvideo.livingroom", "Prime Video", "#0F171E", "#00A8E1"], ["co.learn_quran.tv_mushaf", "Mushaf", "#0E3B2E", "#E2BC74"],
    ["com.digitalseva.iptvplayer", "IPTV", "#1B1B3A"], ["com.google.android.youtube.tvmusic", "YT Music", "#111", "#FF0033"],
    ["com.google.android.videos", "Google TV", "#202124"], ["com.android.vending", "Play Store", "#1F2A2E"],
    ["com.sony.dtv.tvx", "TV", "#101820"], ["com.tcl.browser", "Browser", "#23395B"],
    ["com.lonelycatgames.Xplore", "X-plore", "#2D2D2D", "#F5C66B"], ["com.mushaf.myapp", "Quran", "#163A2F"],
    ["com.sony.dtv.timers", "Timers", "#333"], ["com.mk.homedash", "MK TV & Car Launcher", "#0E2A2B"],
  ].map(([pkg, label, bg, fg]) => ({ pkg, label, banner: true, system: pkg.startsWith("com.sony") || pkg === "com.android.vending", icon: banner(label, bg, fg) }));
  // Car build: square app icons, like the head unit's launcher apps.
  const flavor = /car\.html$/.test(location.pathname) || /flavor=car/.test(location.search) ? "car" : "tv";
  if (flavor === "car") {
    const square = (label, bg, fg = "#fff") => "data:image/svg+xml," + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192"><rect width="192" height="192" fill="${bg}"/><text x="96" y="${label.length > 2 ? 112 : 124}" font-family="Helvetica" font-weight="700" font-size="${label.length > 2 ? 44 : 72}" fill="${fg}" text-anchor="middle">${label}</text></svg>`);
    apps = [
      ["com.google.android.apps.maps", "Maps", "Maps", "#34A853"], ["com.waze", "Waze", "W", "#33CCFF"],
      ["com.spotify.music", "Spotify", "S", "#1DB954", "#000"], ["com.google.android.apps.youtube.music", "YT Music", "▶", "#FF0033"],
      ["com.google.android.dialer", "Phone", "☎", "#34C759"], ["com.google.android.apps.messaging", "Messages", "✉", "#1A73E8"],
      ["com.whatsapp", "WhatsApp", "W", "#25D366"], ["co.learn_quran.mushaf", "Quran", "ق", "#0E3B2E", "#E2BC74"],
      ["com.google.android.apps.podcasts", "Podcasts", "P", "#8E44AD"], ["com.android.chrome", "Chrome", "C", "#FBBC04", "#202124"],
      ["com.android.vending", "Play Store", "▲", "#01875F"], ["com.google.android.youtube", "YouTube", "▶", "#FFFFFF", "#FF0033"],
      ["com.netflix.mediaclient", "Netflix", "N", "#000", "#E50914"], ["com.android.settings", "Settings", "⚙", "#5F6368"],
      ["com.google.android.calendar", "Calendar", "25", "#4285F4"], ["com.android.fmradio", "Radio", "FM", "#C2185B"],
      ["com.audible.application", "Audible", "A", "#F7991C", "#000"], ["com.google.android.apps.photos", "Photos", "✿", "#EA4335"],
      ["com.android.documentsui", "Files", "F", "#1E88E5"], ["com.android.camera2", "Camera", "◉", "#37474F"],
      ["com.mk.carlauncher", "MK TV & Car Launcher", "MK", "#0E2A2B"],
    ].map(([pkg, label, mark, bg, fg]) => ({ pkg, label, banner: false, small: false, system: /android\.(settings|fmradio|camera2|documentsui|vending)/.test(pkg), icon: square(mark, bg, fg) }));
  }
  const q = new URLSearchParams(location.search).get("photos");
  window.MOCK_TV = {
    apps: () => JSON.stringify(apps),
    flavor: () => flavor,
    startScreensaver: () => { location.href = "screensaver.html?flavor=car"; },
    launch: (p) => { console.log("launch", p); return true; },
    uninstall: (p) => { apps = apps.filter((a) => a.pkg !== p); setTimeout(() => window.onTvResume && window.onTvResume(), 300); },
    openSettings: () => console.log("settings"),
    openWifiSettings: () => console.log("wifi settings"),
    network: () => JSON.stringify({ type: "wifi", level: 3 }),
    photos: () => JSON.stringify(q ? q.split(",") : []),
    photoFolder: () => "",
    settings: () => "null",
    location: () => JSON.stringify({ lat: 25.3463, lon: 55.4209, city: "Sharjah", country: "AE", at: Date.now() }),
    locate: () => {},
    promptText: (title, value) => setTimeout(() => window.onPrompt && window.onPrompt(prompt(title, value)), 0),
    albums: () => "[]",
    albumPhotos: () => JSON.stringify({ at: Date.now(), photos: [] }),
    refreshAlbums: () => {},
    getPref: (k) => localStorage.getItem("pref." + k),
    setPref: (k, v) => localStorage.setItem("pref." + k, v),
  };
})();
