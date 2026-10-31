// Default settings. Any of these can be overridden per TV without rebuilding:
// put the keys you want to change in a settings.json and run ./tv.sh settings settings.json
// (see settings.example.json). Changing this file needs ./build.sh && ./tv.sh install.
window.CONFIG = {
  // Location. "auto": the TV's own time zone, its city looked up from the internet connection
  // (once a day) and the official prayer method for that country. Setting latitude/longitude
  // in settings.json switches to that fixed place instead.
  location: "auto",
  city: "",
  latitude: 21.4225, // used only until the first lookup succeeds
  longitude: 39.8262,
  timezone: "auto",  // "auto" = the TV's time zone setting

  // Prayer method. Picked from the detected country unless set here or in settings.json.
  // fajrAngle/ishaAngle in degrees, ishaMinutes = fixed time after Maghrib,
  // asrFactor 1 = Shafi'i/Maliki/Hanbali, 2 = Hanafi, offsets in minutes.
  prayer: { fajrAngle: 18, ishaAngle: 17, asrFactor: 1, offsets: {} },

  // Screensaver extras.
  logoText: "M&D", // text at the top centre ("&" is drawn in gold); "" hides it
  worldClocks: [], // e.g. [{ "city": "London", "zone": "Europe/London" }] (up to 2 fit)
  prayerAlert: { enabled: true, minutesBefore: 10, minutesAfter: 15 }, // silent banner, screensaver only
  nightMode: { enabled: true, dim: 0.45 },                              // dims from Isha until Fajr
  reminders: { kahf: true, whiteDays: true },                           // Friday Al-Kahf, Hijri 13–15 fasting

  // Azkar schedule (24h clock, start hour inclusive).
  azkar: { morningFrom: 4, generalFrom: 12, eveningFrom: 17 },

  // Home screen: a glance panel above the apps (time, Hijri date, next prayer, weather).
  homeGlance: true,

  // Home screen: starting order (top row first). Reorder, group into folders or hide on
  // the TV by long-pressing OK on an app; those changes are remembered on the TV.
  homeOrder: [
    "com.google.android.youtube.tv",
    "com.netflix.ninja",
    "com.amazon.amazonvideo.livingroom",
  ],
  // Apps that never appear on the home screen (other launchers, this app).
  homeExclude: [
    "com.mk.homedash", "com.mk.carlauncher", "com.mk.phonelauncher", "com.spocky.projengmenu", "com.overdevs.at4k", "com.luegete28.appsdrawerfree",
    "com.google.android.apps.tv.launcherx", "com.google.android.tvlauncher",
  ],

  // Screensaver backgrounds. Shared Google Photos albums are added with
  // ./tv.sh albums add <link>; mixScenes keeps the nature scenes in the rotation too.
  scenes: Array.from({ length: 10 }, (_, i) => `scenes/scene${String(i + 1).padStart(2, "0")}.jpg`),
  useAlbums: true,
  mixScenes: true,
  albumRefreshHours: 6, // how often the TV re-reads the albums for new photos

  photoSeconds: 45,   // how long each screensaver photo stays
  weatherMinutes: 30, // weather refresh interval
};

// Car build (car/AndroidManifest.xml): what differs from the TV defaults above.
// settings.json overrides these the same way.
window.CAR_CONFIG = {
  // Prayer times follow the car's GPS, with the official method of the country it is in.
  // Until the first GPS fix (or without GPS): Sharjah, UAE Awqaf method. Setting latitude/longitude
  // (and prayer) in settings.json fixes the place instead.
  location: "gps",
  city: "Sharjah",
  latitude: 25.3463,
  longitude: 55.4209,
  timezone: "auto", // the head unit's time zone
  prayerCountry: "AE",
  dockMax: 4, // apps kept in the sidebar
  nightAuto: true, // night mode by itself from Maghrib to sunrise (a tap on Day overrides it until then)
  nightLevel: 2,   // 1 = eye comfort, 2 = night
  homeOrder: [
    "com.google.android.apps.maps", "com.waze", "com.spotify.music",
    "com.google.android.apps.youtube.music", "com.google.android.dialer", "com.android.dialer",
  ],
};

// Phone build (phone/AndroidManifest.xml): on top of the car settings above.
window.PHONE_CONFIG = {
  homeOrder: [],
  dockApps: ["com.google.android.dialer", "com.android.dialer", "com.google.android.apps.messaging", "com.whatsapp",
    "com.android.chrome", "com.google.android.apps.maps", "com.android.camera2", "com.google.android.GoogleCamera"],
};

// Official calculation per country (as used by the national religious authorities).
window.PRAYER_METHODS = (function () {
  const m = (fajrAngle, isha, extra) => Object.assign(
    { fajrAngle, asrFactor: 1, offsets: {} },
    typeof isha === "string" ? { ishaMinutes: parseInt(isha, 10) } : { ishaAngle: isha },
    extra || {});
  const egypt = m(19.5, 17.5), karachi = m(18, 18, { asrFactor: 2 }), gulf = m(19.5, "90"), sea = m(20, 18);
  return {
    AE: m(18.2, 18.2, { offsets: { dhuhr: 3, maghrib: 3 } }), // UAE Awqaf
    SA: m(18.5, "90"), QA: m(18, "90"), BH: gulf, OM: gulf, YE: gulf, // Umm al-Qura / Gulf
    KW: m(18, 17.5), JO: m(18, 18), TR: m(18, 17), TN: m(18, 18), DZ: m(18, 17), MA: m(19, 17),
    EG: egypt, SD: egypt, LY: egypt, LB: egypt, SY: egypt, PS: egypt, IQ: egypt,
    PK: karachi, IN: karachi, BD: karachi, AF: karachi,
    MY: sea, ID: sea, SG: sea, BN: sea,
    FR: m(12, 12), US: m(15, 15), CA: m(15, 15), RU: m(16, 15), IR: m(17.7, 14),
  };
})();

// Car: use a GPS position {lat, lon, city, country}; the prayer method follows the country
// unless settings.json fixes it. Returns true when the prayer times need recomputing.
window.applyCarLocation = function (C, loc) {
  const moved = Math.abs(loc.lat - C.latitude) + Math.abs(loc.lon - C.longitude) > 0.02; // ~2 km
  const method = !C.prayerFixed && loc.country && window.PRAYER_METHODS[loc.country];
  const changed = moved || (loc.city && loc.city !== C.city) || (method && loc.country !== C.country);
  C.latitude = loc.lat;
  C.longitude = loc.lon;
  if (loc.city) C.city = loc.city;
  if (method) { C.prayer = JSON.parse(JSON.stringify(method)); C.country = loc.country; }
  C.located = true;
  return changed;
};

// Per-TV overrides from settings.json (pushed with ./tv.sh settings), then the location.
(function () {
  const C = window.CONFIG;
  const TV = window.TV || window.MOCK_TV; // MOCK_TV: previewing in a desktop browser (bridge-mock.js)
  // "tv" or "car", from the app's manifest (app/ or car/AndroidManifest.xml).
  try { C.flavor = TV.flavor(); } catch (e) { C.flavor = "tv"; }
  if (C.flavor === "car" || C.flavor === "phone") {
    Object.assign(C, window.CAR_CONFIG, C.flavor === "phone" ? window.PHONE_CONFIG : {});
    C.prayer = JSON.parse(JSON.stringify(window.PRAYER_METHODS[C.prayerCountry]));
    C.country = C.prayerCountry;
  }
  let overrides = null;
  try { overrides = TV && JSON.parse(TV.settings()); } catch (e) {}
  if (overrides) {
    const merge = (base, extra) => {
      for (const k of Object.keys(extra)) {
        const b = base[k], v = extra[k];
        base[k] = b && v && typeof b === "object" && typeof v === "object" && !Array.isArray(b) && !Array.isArray(v)
          ? merge(b, v) : v;
      }
      return base;
    };
    merge(C, overrides);
    if ("latitude" in overrides || "longitude" in overrides) C.location = "manual";
  }
  const own = (k) => overrides && k in overrides;
  C.prayerFixed = own("prayer");

  if (C.timezone === "auto") {
    try { C.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch (e) { C.timezone = "UTC"; }
  }
  if (C.location === "gps") {
    let loc = null;
    try { loc = TV && JSON.parse(TV.carLocation()); } catch (e) {}
    if (loc) window.applyCarLocation(C, loc);
  }
  if (C.location === "auto") {
    let loc = null;
    try { loc = TV && JSON.parse(TV.location()); } catch (e) {}
    C.located = !!loc;
    C.locationAt = loc ? loc.at : 0;
    if (loc) {
      C.latitude = loc.lat;
      C.longitude = loc.lon;
      if (!own("city")) C.city = loc.city || "";
      if (!own("prayer")) C.prayer = window.PRAYER_METHODS[loc.country] || C.prayer;
      C.country = loc.country;
    }
  }
})();
