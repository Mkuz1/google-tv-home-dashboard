(function () {
  const C = window.CONFIG;
  const $ = (id) => document.getElementById(id);
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };

  const TV = window.TV || window.MOCK_TV;
  const { hm, ampm, toArabicDigits, PRAYERS, WMO } = window.DASH;
  const icon = window.DASH.weatherIcon;

  /* ---------------- scaling ---------------- */
  // Designed at 1920x1080. Other shapes keep that scale on the short side and give the extra
  // room to the layout: a wide car screen (1920x720) gets a wider stage, a tall one a taller
  // stage, and a portrait screen stacks the panels (body.tall).
  function fit() {
    // Android WebView reports innerWidth in device pixels; clientWidth is the real CSS width.
    const W = document.documentElement.clientWidth || innerWidth;
    const H = document.documentElement.clientHeight || innerHeight;
    const tall = H > W * 0.8;
    const sw = tall ? 1200 : Math.max(1920, Math.round(1080 * W / H));
    const sh = Math.round(sw * H / W);
    const s = W / sw;
    document.body.classList.toggle("tall", tall);
    const el = $("stage");
    el.style.width = sw + "px";
    el.style.height = sh + "px";
    el.style.transform = `scale(${s})`;
    el.style.left = shift.x + "px";
    el.style.top = shift.y + "px";
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
    $("logo").innerHTML = window.DASH.logoHtml(text);
  }

  /* ---------------- silent prayer alert ---------------- */
  const MOSQUE = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5c.3 1.6 1.3 2.6 2.6 3.4C16.4 7 17.5 8.5 17.5 10.5V11h-11v-.5c0-2 1.1-3.5 2.9-4.6 1.3-.8 2.3-1.8 2.6-3.4zM5 12.5h14V21h-4.5v-4a2.5 2.5 0 0 0-5 0v4H5zM2 9.5a1 1 0 0 1 2 0V21H2zm18 0a1 1 0 0 1 2 0V21h-2z"/></svg>';
  const PRAYER_AR = { fajr: "الفجر", dhuhr: "الظهر", asr: "العصر", maghrib: "المغرب", isha: "العشاء" };
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
  let chipsKey = "";
  function renderChips(now) {
    const chips = window.DASH.dayReminders(now, today, C);
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
    const next = window.DASH.nextPrayer(now, today, tomorrow);
    for (const li of $("prList").children) {
      const k = li.dataset.k;
      li.classList.toggle("next", k === next.key);
      li.classList.toggle("past", today[k] <= now && k !== next.key);
    }
    $("prNext").textContent = `${next.name} in ${window.DASH.inMinutes(next.minutes)}`;
  }

  /* ---------------- weather (Open-Meteo) ---------------- */
  async function loadWeather() {
    const url = window.DASH.weatherUrl(C);
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
      const name = window.DASH.dayName(t, i);
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

  /* ---------------- start ---------------- */
  document.documentElement.style.setProperty("--night-dim", C.nightMode.dim);
  window.DASH.checkLocation(C, TV);
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
