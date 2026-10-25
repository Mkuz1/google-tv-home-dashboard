(function () {
  const C = window.CONFIG;
  const $ = (id) => document.getElementById(id);
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };

  const TV = window.TV || window.MOCK_TV;

  /* ---------------- scaling ---------------- */
  function fit() {
    // Android WebView reports innerWidth in device pixels; clientWidth is the real CSS width.
    const W = document.documentElement.clientWidth || innerWidth;
    const H = document.documentElement.clientHeight || innerHeight;
    const s = Math.min(W / 1920, H / 1080);
    const el = $("stage");
    el.style.transform = `scale(${s})`;
    el.style.left = (W - 1920 * s) / 2 + shift.x + "px";
    el.style.top = (H - 1080 * s) / 2 + shift.y + "px";
    fitAzkarText();
  }
  addEventListener("resize", fit);

  // Nudge the layout a few pixels every few minutes so nothing sits still on the panel for hours.
  const shift = { x: 0, y: 0 };
  setInterval(() => {
    shift.x = Math.round(Math.random() * 24 - 12);
    shift.y = Math.round(Math.random() * 16 - 8);
    fit();
  }, 4 * 60000);

  /* ---------------- clock ---------------- */
  const dateFmt = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  let hijriFmt;
  try { hijriFmt = new Intl.DateTimeFormat("ar-u-ca-islamic-umalqura-nu-latn", { day: "numeric", month: "long", year: "numeric" }); } catch (e) {}

  function hm(d) {
    let h = d.getHours() % 12 || 12;
    return h + ":" + String(d.getMinutes()).padStart(2, "0");
  }
  const ampm = (d) => (d.getHours() < 12 ? "AM" : "PM");

  let lastDay = -1;
  function tick() {
    // previewShiftMinutes (settings.json) shows the screensaver at another time, for testing.
    const now = new Date(Date.now() + (C.previewShiftMinutes || 0) * 60000);
    $("time").textContent = hm(now);
    $("ampm").textContent = ampm(now);
    if (now.getDate() !== lastDay) {
      lastDay = now.getDate();
      $("date").textContent = dateFmt.format(now);
      $("hijri").textContent = hijriFmt ? hijriFmt.format(now) : "";
      computePrayers(now);
    }
    renderPrayers(now);
    checkAzkarPeriod(now);
    renderAzProgress();
    renderWorld(now);
    renderAlert(now);
    renderChips(now);
    document.body.classList.toggle("night", C.nightMode.enabled && (now >= today.isha || now < today.fajr));
  }

  /* ---------------- logo ---------------- */
  function renderLogo() {
    const text = (C.logoText || "").trim();
    $("logo").hidden = !text;
    const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    const mono = text.split("&").map(esc).join("<em>&amp;</em>");
    $("logo").innerHTML = `<span class="rule"></span><span class="mono">${mono}</span><span class="rule"></span>`;
  }

  /* ---------------- silent prayer alert ---------------- */
  const MOSQUE = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5c.3 1.6 1.3 2.6 2.6 3.4C16.4 7 17.5 8.5 17.5 10.5V11h-11v-.5c0-2 1.1-3.5 2.9-4.6 1.3-.8 2.3-1.8 2.6-3.4zM5 12.5h14V21h-4.5v-4a2.5 2.5 0 0 0-5 0v4H5zM2 9.5a1 1 0 0 1 2 0V21H2zm18 0a1 1 0 0 1 2 0V21h-2z"/></svg>';
  const PRAYER_AR = { fajr: "الفجر", dhuhr: "الظهر", asr: "العصر", maghrib: "المغرب", isha: "العشاء" };
  const toArabicDigits = (n) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);
  const arMinutes = (n) => n === 1 ? "دقيقة واحدة" : n === 2 ? "دقيقتان"
    : `${toArabicDigits(n)} ${n <= 10 ? "دقائق" : "دقيقة"}`;
  let alertKey = "";
  function renderAlert(now) {
    const before = C.prayerAlert.minutesBefore * 60000, after = C.prayerAlert.minutesAfter * 60000;
    let html = "", mode = "", key = "";
    for (const [k, en] of PRAYERS) {
      if (!PRAYER_AR[k]) continue;
      const t = today[k], diff = t - now;
      if (diff > 0 && diff <= before) {
        const mins = Math.ceil(diff / 60000);
        mode = "soon"; key = k + mins;
        html = `<div class="al-text"><div class="al-ar">باقٍ ${arMinutes(mins)} على صلاة ${PRAYER_AR[k]}</div>` +
          `<div class="al-en">${en} in ${mins} minute${mins === 1 ? "" : "s"} · ${hm(t)} ${ampm(t)}</div></div>`;
      } else if (diff <= 0 && -diff < after) {
        mode = "now"; key = k + "now";
        html = `<div class="al-text"><div class="al-ar">حان الآن موعد صلاة ${PRAYER_AR[k]}</div>` +
          `<div class="al-en">It's time for ${en} prayer · ${hm(t)} ${ampm(t)}</div></div>`;
      }
    }
    const el = $("alert");
    if (!C.prayerAlert.enabled || !html) { el.hidden = true; alertKey = ""; return; }
    if (key === alertKey) return;
    alertKey = key;
    el.className = "glass" + (mode === "now" ? " now" : "");
    el.innerHTML = `<div class="al-icon">${MOSQUE}</div>${html}`;
    el.hidden = false;
  }

  /* ---------------- day reminders: Friday (Al-Kahf) and the white days ---------------- */
  const BOOK = '<svg viewBox="0 0 24 24" fill="none" stroke="#FFE0A6" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6c-2-1.5-5-2-8-1.5v14C7 18 10 18.5 12 20c2-1.5 5-2 8-1.5v-14C17 4 14 4.5 12 6zM12 6v14"/></svg>';
  const MOON = '<svg viewBox="0 0 24 24" fill="#FFE0A6"><path d="M14.5 3a9 9 0 1 0 6.5 15.2A7.5 7.5 0 0 1 14.5 3z"/></svg>';
  let hijriDayFmt, hijriMonthFmt;
  try {
    hijriDayFmt = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", { day: "numeric" });
    hijriMonthFmt = new Intl.DateTimeFormat("ar-u-ca-islamic-umalqura", { month: "long" });
  } catch (e) {}
  let chipsKey = "";
  function renderChips(now) {
    const chips = [];
    // Friday runs from Thursday's Maghrib to Friday's Maghrib.
    const dow = now.getDay();
    if (C.reminders.kahf && ((dow === 4 && now >= today.maghrib) || (dow === 5 && now < today.maghrib))) {
      chips.push(`${BOOK}<span class="ar">الجمعة · سورة الكهف</span><span class="dot"></span><span class="en">Read Surat Al-Kahf</span>`);
    }
    if (C.reminders.whiteDays && hijriDayFmt) {
      const d = parseInt(hijriDayFmt.format(now), 10);
      const month = hijriMonthFmt.format(now);
      if (d >= 13 && d <= 15) {
        chips.push(`${MOON}<span class="ar">الأيام البيض · ${toArabicDigits(d)} ${month}</span><span class="dot"></span><span class="en">White Day fast (${d}th)</span>`);
      } else if (d === 12) {
        chips.push(`${MOON}<span class="ar">الأيام البيض تبدأ غداً</span><span class="dot"></span><span class="en">White Days fast starts tomorrow</span>`);
      }
    }
    const key = chips.join("|");
    if (key === chipsKey) return;
    chipsKey = key;
    $("chips").innerHTML = chips.map((c) => `<div class="chip glass">${c}</div>`).join("");
  }

  /* ---------------- world clock ---------------- */
  // Wall-clock time in a zone, as a Date whose local fields read that zone's time.
  function zoned(now, zone) {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
      timeZone: zone, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    }).formatToParts(now).map((x) => [x.type, x.value]));
    return new Date(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute);
  }
  let worldMinute = -1;
  function renderWorld(now) {
    if (now.getMinutes() === worldMinute) return;
    worldMinute = now.getMinutes();
    const none = !C.worldClocks.length;
    $("world").hidden = none;
    $("worldDivider").hidden = none;
    if (none) return;
    const home = zoned(now, C.timezone);
    $("world").innerHTML = C.worldClocks.map(({ city, zone }) => {
      const t = zoned(now, zone);
      const diffMin = Math.round((t - home) / 60000);
      const h = Math.trunc(Math.abs(diffMin) / 60), m = Math.abs(diffMin) % 60;
      const span = (h ? `${h}h` : "") + (m ? `${m}m` : "") || "0h";
      let diff = diffMin === 0 ? "Same time" : `${span} ${diffMin < 0 ? "behind" : "ahead"}`;
      if (t.getDate() !== home.getDate()) diff += t < home ? " · Yesterday" : " · Tomorrow";
      return `<div class="wc"><div class="wc-city">${city}</div>` +
        `<div class="wc-time">${hm(t)}<span>${ampm(t)}</span></div><div class="wc-diff">${diff}</div></div>`;
    }).join('<div class="wc-sep"></div>');
  }

  /* ---------------- prayer times ---------------- */
  const PRAYERS = [
    ["fajr", "Fajr", "الفجر"], ["sunrise", "Sunrise", "الشروق"], ["dhuhr", "Dhuhr", "الظهر"],
    ["asr", "Asr", "العصر"], ["maghrib", "Maghrib", "المغرب"], ["isha", "Isha", "العشاء"],
  ];
  let today = null, tomorrow = null;
  function computePrayers(now) {
    today = prayerTimes(now, C);
    const t = new Date(now); t.setDate(t.getDate() + 1);
    tomorrow = prayerTimes(t, C);
    $("prList").innerHTML = PRAYERS.map(([k, en, ar]) =>
      `<li data-k="${k}"><span class="en">${en}</span><span class="ar">${ar}</span><span class="tm">${hm(today[k])} <small>${ampm(today[k])}</small></span></li>`
    ).join("");
  }
  function renderPrayers(now) {
    let nextKey = null, nextTime = null;
    for (const [k] of PRAYERS) {
      if (k === "sunrise") continue;
      if (today[k] > now) { nextKey = k; nextTime = today[k]; break; }
    }
    if (!nextKey) { nextKey = "fajr"; nextTime = tomorrow.fajr; }
    for (const li of $("prList").children) {
      const k = li.dataset.k;
      li.classList.toggle("next", k === nextKey);
      li.classList.toggle("past", today[k] <= now && k !== nextKey);
    }
    const mins = Math.max(0, Math.ceil((nextTime - now) / 60000));
    const label = PRAYERS.find((p) => p[0] === nextKey)[1];
    const h = Math.floor(mins / 60), m = mins % 60;
    $("prNext").textContent = `${label} in ${h ? h + "h " : ""}${m}m`;
  }

  /* ---------------- weather (Open-Meteo) ---------------- */
  const WMO = {
    0: "Clear", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Fog",
    51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle", 56: "Freezing drizzle", 57: "Freezing drizzle",
    61: "Light rain", 63: "Rain", 65: "Heavy rain", 66: "Freezing rain", 67: "Freezing rain",
    71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow", 80: "Showers", 81: "Showers", 82: "Heavy showers",
    85: "Snow showers", 86: "Snow showers", 95: "Thunderstorm", 96: "Thunderstorm", 99: "Thunderstorm",
  };
  function icon(code, day = true) {
    const sun = '<circle cx="32" cy="32" r="11" fill="#F5C66B"/><g stroke="#F5C66B" stroke-width="3.5" stroke-linecap="round"><path d="M32 8v6M32 50v6M8 32h6M50 32h6M15 15l4.2 4.2M44.8 44.8 49 49M15 49l4.2-4.2M44.8 19.2 49 15"/></g>';
    const moon = '<path d="M40 12a20 20 0 1 0 12 30A17 17 0 0 1 40 12z" fill="#E9E4D6"/>';
    const cloud = (x = 0, y = 0, c = "#E6EBEE") => `<path transform="translate(${x} ${y})" d="M20 48h26a10 10 0 0 0 0-20 14 14 0 0 0-27-3A11 11 0 0 0 20 48z" fill="${c}"/>`;
    const drops = '<g stroke="#7EC3F2" stroke-width="3.5" stroke-linecap="round"><path d="M24 52l-3 7M34 52l-3 7M44 52l-3 7"/></g>';
    let g;
    if (code === 0 || code === 1) g = day ? sun : moon;
    else if (code === 2) g = `<g transform="translate(-8 -8) scale(.8)">${day ? sun : moon}</g>` + cloud(4, 4);
    else if (code === 3) g = cloud(-6, -6, "#AEB8BE") + cloud(4, 2);
    else if (code === 45 || code === 48) g = '<g stroke="#C9D1D6" stroke-width="4" stroke-linecap="round"><path d="M12 24h40M8 34h48M14 44h36"/></g>';
    else if (code >= 95) g = cloud(0, -6, "#9AA6AD") + '<path d="M34 40l-8 12h7l-4 10 12-15h-7l4-7z" fill="#F5C66B"/>';
    else if ((code >= 71 && code <= 77) || code === 85 || code === 86) g = cloud(0, -6) + '<g fill="#FFFFFF"><circle cx="24" cy="54" r="3"/><circle cx="34" cy="58" r="3"/><circle cx="44" cy="54" r="3"/></g>';
    else g = cloud(0, -6) + drops;
    return `<svg viewBox="0 0 64 64">${g}</svg>`;
  }

  async function loadWeather() {
    const url = "https://api.open-meteo.com/v1/forecast" +
      `?latitude=${C.latitude}&longitude=${C.longitude}&timezone=${encodeURIComponent(C.timezone)}` +
      "&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,wind_speed_10m" +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=5";
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) throw new Error(r.status);
      const data = await r.json();
      store.set("weather", { at: Date.now(), data });
      renderWeather(data);
    } catch (e) {
      const cached = store.get("weather");
      if (cached) renderWeather(cached.data, true);
    }
  }
  function renderWeather(d, stale) {
    const c = d.current;
    $("wIcon").innerHTML = icon(c.weather_code, c.is_day === 1);
    $("wTemp").textContent = Math.round(c.temperature_2m) + "°";
    $("wCity").textContent = C.city;
    $("wCond").textContent = WMO[c.weather_code] || "";
    $("wExtra").textContent = `Feels ${Math.round(c.apparent_temperature)}° · Humidity ${c.relative_humidity_2m}%` + (stale ? " · offline" : "");
    const dd = d.daily;
    $("wDays").innerHTML = dd.time.map((t, i) => {
      const [y, m, day] = t.split("-").map(Number);
      const name = i === 0 ? "Today" : new Date(y, m - 1, day).toLocaleDateString("en-GB", { weekday: "short" });
      return `<div class="day${i === 0 ? " today" : ""}"><div class="dn">${name}</div>${icon(dd.weather_code[i])}` +
        `<div class="hl">${Math.round(dd.temperature_2m_max[i])}°<span>${Math.round(dd.temperature_2m_min[i])}°</span></div></div>`;
    }).join("");
  }

  /* ---------------- azkar ---------------- */
  let azPeriod = null, azIndex = 0, azTimer = null, azStart = 0, azDwell = 0;
  function periodFor(now) {
    const h = now.getHours(), a = C.azkar;
    if (h >= a.morningFrom && h < a.generalFrom) return "morning";
    if (h >= a.generalFrom && h < a.eveningFrom) return "general";
    return "evening";
  }
  const RANGES = () => {
    const a = C.azkar, f = (h) => hm(new Date(2000, 0, 1, h)) + " " + ampm(new Date(2000, 0, 1, h));
    return { morning: `${f(a.morningFrom)} – ${f(a.generalFrom)}`, general: `${f(a.generalFrom)} – ${f(a.eveningFrom)}`, evening: `${f(a.eveningFrom)} – ${f(a.morningFrom)}` };
  };
  function checkAzkarPeriod(now) {
    const p = periodFor(now);
    if (p === azPeriod) return;
    azPeriod = p; azIndex = 0;
    const set = AZKAR[p];
    $("azTitle").textContent = set.title;
    $("azSub").textContent = `${set.subtitle} · ${RANGES()[p]}`;
    showDhikr(false);
  }
  const REPEAT_AR = { 1: "مرة واحدة", 2: "مرتان", 3: "ثلاث مرات", 4: "أربع مرات", 7: "سبع مرات", 10: "عشر مرات", 100: "مائة مرة" };
  function showDhikr(animate = true) {
    const items = AZKAR[azPeriod].items;
    azIndex = (azIndex + items.length) % items.length;
    const item = items[azIndex];
    const body = $("azBody");
    const apply = () => {
      body.textContent = item.t;
      $("azRepeat").textContent = item.n > 1 ? REPEAT_AR[item.n] || `${item.n} مرات` : "";
      $("azCount").textContent = `${azIndex + 1} / ${items.length}`;
      fitAzkarText();
      body.classList.remove("fade");
    };
    if (animate) { body.classList.add("fade"); setTimeout(apply, 600); } else apply();
    azDwell = Math.min(75, Math.max(14, 6 + item.t.length * 0.09)) * 1000;
    azStart = Date.now();
    renderAzProgress();
    clearTimeout(azTimer);
    azTimer = setTimeout(() => { azIndex++; showDhikr(); }, azDwell);
  }
  // Updated once a second from tick(): continuous animation keeps the TV redrawing at 60 fps.
  function renderAzProgress() {
    const pct = azDwell ? Math.min(1, (Date.now() - azStart) / azDwell) : 0;
    $("azBar").style.transform = `scaleX(${pct.toFixed(3)})`;
  }
  function fitAzkarText() {
    const body = $("azBody");
    if (!body.textContent) return;
    let size = 52;
    body.style.fontSize = size + "px";
    while (size > 26 && body.scrollHeight > body.clientHeight + 2) {
      size -= 2;
      body.style.fontSize = size + "px";
    }
  }
  /* ---------------- background photos ---------------- */
  let photos = [], photoIdx = 0, front = "bgA";
  function loadPhotos() {
    // Your shared Google Photos albums, photos pushed from the Mac, and the nature scenes.
    let pushed = [], album = { at: 0, photos: [] };
    try { pushed = JSON.parse(TV.photos()) || []; } catch (e) {}
    if (C.useAlbums) try { album = JSON.parse(TV.albumPhotos()); } catch (e) {}
    const albumUrls = album.photos.map((u) => u + "=w2560-h1440");
    const own = albumUrls.concat(pushed);
    photos = own.length && !C.mixScenes ? own : own.concat(C.scenes);
    for (let i = photos.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [photos[i], photos[j]] = [photos[j], photos[i]]; }
    photoIdx = 0;
    // Album list changed since the last read (e.g. ./tv.sh albums add): read again now.
    let links = "[]";
    try { links = TV.albums(); } catch (e) {}
    albumAt = (album.links || "[]") === links ? album.at : 0;
  }
  let albumAt = 0;
  function refreshAlbumsIfStale() {
    if (Date.now() - albumAt < C.albumRefreshHours * 3600000) return;
    albumAt = Date.now(); // don't ask again while this refresh runs
    try { TV.refreshAlbums(); } catch (e) { return; }
    // The refresh runs in the background on the TV; pick up its result shortly after.
    setTimeout(loadPhotos, 20000);
  }
  function nextPhoto() {
    if (!photos.length) return;
    const url = photos[photoIdx++ % photos.length];
    const img = new Image();
    img.onload = () => {
      const back = front === "bgA" ? "bgB" : "bgA";
      const el = $(back), old = $(front);
      // Crossfade only: a continuous slow zoom keeps the TV redrawing 4K at 60 fps for hours.
      el.style.backgroundImage = `url("${url}")`;
      el.classList.add("show");
      old.classList.remove("show");
      front = back;
    };
    img.onerror = () => setTimeout(nextPhoto, 500);
    img.src = url;
  }

  /* ---------------- location (auto) ---------------- */
  // Look the TV's city up once a day; on the very first lookup, reload to use it.
  function checkLocation() {
    if (C.location !== "auto") return;
    if (C.located && Date.now() - C.locationAt < 24 * 3600000) return;
    try { TV.locate(); } catch (e) { return; }
    if (C.located) return;
    let tries = 0;
    const poll = setInterval(() => {
      let loc = null;
      try { loc = JSON.parse(TV.location()); } catch (e) {}
      if (loc) { clearInterval(poll); location.reload(); }
      else if (++tries > 12) clearInterval(poll);
    }, 5000);
  }

  /* ---------------- start ---------------- */
  document.documentElement.style.setProperty("--night-dim", C.nightMode.dim);
  checkLocation();
  renderLogo();
  fit();
  tick();
  setInterval(tick, 1000);
  const cachedWeather = store.get("weather");
  if (cachedWeather) renderWeather(cachedWeather.data, true);
  loadWeather();
  setInterval(loadWeather, C.weatherMinutes * 60000);
  loadPhotos();
  refreshAlbumsIfStale();
  setInterval(refreshAlbumsIfStale, 30 * 60000);
  nextPhoto();
  setInterval(nextPhoto, C.photoSeconds * 1000);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitAzkarText);

})();
