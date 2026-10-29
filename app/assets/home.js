(function () {
  const C = window.CONFIG;
  const TV = window.TV || window.MOCK_TV;
  const $ = (id) => document.getElementById(id);
  const COLS = 5;
  const LONG_PRESS_MS = 650;
  // Saved on the TV through Android preferences (the page's localStorage can lose recent writes).
  const store = {
    get(k, d) { try { const v = JSON.parse(TV.getPref(k)); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { TV.setPref(k, JSON.stringify(v)); } catch (e) {} },
  };
  const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  /* ---------------- scaling ---------------- */
  function fit() {
    // Android WebView reports innerWidth in device pixels; clientWidth is the real CSS width.
    const W = document.documentElement.clientWidth || innerWidth;
    const H = document.documentElement.clientHeight || innerHeight;
    const s = Math.min(W / 1920, H / 1080);
    const el = $("stage");
    el.style.transform = `scale(${s})`;
    el.style.left = (W - 1920 * s) / 2 + "px";
    el.style.top = (H - 1080 * s) / 2 + "px";
  }
  addEventListener("resize", fit);

  /* ---------------- clock + Wi-Fi ---------------- */
  function tickClock() {
    const d = new Date();
    $("clock").textContent = (d.getHours() % 12 || 12) + ":" + String(d.getMinutes()).padStart(2, "0");
  }
  function wifiIcon(net) {
    if (net.type === "ethernet") {
      return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 3h10v4h3v8h-4v6H8v-6H4V7h3z"/></svg>';
    }
    if (net.type !== "wifi") {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0"/><circle cx="12" cy="19" r="1.2" fill="currentColor"/><path d="M3 3l18 18"/></svg>';
    }
    // Arcs light up with signal strength (0-4).
    const on = (n) => (net.level >= n ? "currentColor" : "rgba(127,127,127,.45)");
    return `<svg viewBox="0 0 24 24" fill="none" stroke-width="2.4" stroke-linecap="round">
      <path d="M2 8.5a15 15 0 0 1 20 0" stroke="${on(4)}"/><path d="M5.5 12a10 10 0 0 1 13 0" stroke="${on(3)}"/>
      <path d="M9 15.5a5 5 0 0 1 6 0" stroke="${on(2)}"/><circle cx="12" cy="19" r="1.6" fill="${on(1)}" stroke="none"/></svg>`;
  }
  function updateNetwork() {
    let net = { type: "none", level: 0 };
    try { net = JSON.parse(TV.network()); } catch (e) {}
    $("tbWifi").innerHTML = wifiIcon(net);
  }

  /* ---------------- glance: time, dates, next prayer, weather ---------------- */
  // Redrawn once a minute at most, so it costs the TV nothing between minutes.
  const D = window.DASH;
  const glDateFmt = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });
  let glHijriFmt;
  try { glHijriFmt = new Intl.DateTimeFormat("ar-u-ca-islamic-umalqura-nu-latn", { day: "numeric", month: "long", year: "numeric" }); } catch (e) {}
  let glKey = "", glDay = "", glToday = null, glTomorrow = null;

  function tickGlance(force) {
    if (!C.homeGlance) return;
    const now = new Date();
    const key = now.toDateString() + now.getHours() + ":" + now.getMinutes();
    if (key === glKey && !force) return;
    glKey = key;
    if (now.toDateString() !== glDay) {
      glDay = now.toDateString();
      $("glDate").textContent = glDateFmt.format(now);
      $("glHijri").textContent = glHijriFmt ? glHijriFmt.format(now) : "";
      glToday = prayerTimes(now, C);
      const t = new Date(now); t.setDate(t.getDate() + 1);
      glTomorrow = prayerTimes(t, C);
      $("glPrList").innerHTML = D.PRAYERS.filter(([k]) => k !== "sunrise").map(([k, en]) =>
        `<li data-k="${k}"><span class="n">${en}</span><span class="t">${D.hm(glToday[k])}</span></li>`).join("");
    }
    $("glTime").textContent = D.hm(now);
    $("glAmpm").textContent = D.ampm(now);

    const next = D.nextPrayer(now, glToday, glTomorrow);
    $("glPrName").textContent = next.name;
    $("glPrAr").textContent = D.PRAYERS.find((p) => p[0] === next.key)[2];
    $("glPrWhen").innerHTML = `${D.hm(next.time)} ${D.ampm(next.time)} · in <b>${D.inMinutes(next.minutes)}</b>`;
    for (const li of $("glPrList").children) {
      const k = li.dataset.k;
      // After Isha the next prayer is tomorrow's Fajr: show the whole row as done, Fajr lit.
      li.classList.toggle("next", k === next.key);
      li.classList.toggle("past", glToday[k] <= now && k !== next.key);
    }
    $("glChips").innerHTML = D.dayReminders(now, glToday, C).map((c) => `<div class="gl-chip">${c}</div>`).join("");
  }

  // Shares the screensaver's cached forecast, so the two don't each fetch it.
  const weatherCache = {
    get() { try { return JSON.parse(localStorage.getItem("weather")); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem("weather", JSON.stringify(v)); } catch (e) {} },
  };
  function renderGlanceWeather(d, stale) {
    const c = d.current, dd = d.daily;
    $("glWIcon").innerHTML = D.weatherIcon(c.weather_code, c.is_day === 1);
    $("glTemp").textContent = Math.round(c.temperature_2m) + "°";
    $("glCity").textContent = C.city || "Weather";
    $("glCond").textContent = (D.WMO[c.weather_code] || "") + (stale ? " · offline" : "");
    $("glHL").textContent = `H ${Math.round(dd.temperature_2m_max[0])}°  ·  L ${Math.round(dd.temperature_2m_min[0])}°`;
  }
  async function loadGlanceWeather() {
    if (!C.homeGlance) return;
    const cached = weatherCache.get();
    if (cached) renderGlanceWeather(cached.data);
    if (cached && Date.now() - cached.at < C.weatherMinutes * 60000) return;
    try {
      const r = await fetch(D.weatherUrl(C), { cache: "no-store" });
      if (!r.ok) throw new Error(r.status);
      const data = await r.json();
      weatherCache.set({ at: Date.now(), data });
      renderGlanceWeather(data);
    } catch (e) {
      if (cached) renderGlanceWeather(cached.data, true);
    }
  }

  function startGlance() {
    $("glance").hidden = !C.homeGlance;
    document.body.classList.toggle("has-glance", !!C.homeGlance);
    if (!C.homeGlance) return;
    D.checkLocation(C, TV);
    tickGlance(true);
    loadGlanceWeather();
    setInterval(loadGlanceWeather, C.weatherMinutes * 60000);
  }

  /* ---------------- backdrop tinted by the focused app ---------------- */
  // A soft glow in the app's brand colour (its most vivid colour, ignoring white/black/grey).
  let ambFront = "ambA", ambPkg = null, ambTimer = null;
  const ambCache = {};
  function brandColour(img) {
    const cv = document.createElement("canvas");
    cv.width = 24; cv.height = 14;
    const ctx = cv.getContext("2d");
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
    let r = 0, g = 0, b = 0, w = 0;
    for (let i = 0; i < d.length; i += 4) {
      const max = Math.max(d[i], d[i + 1], d[i + 2]), min = Math.min(d[i], d[i + 1], d[i + 2]);
      const sat = max ? (max - min) / max : 0;
      const wt = sat * sat * (max / 255) * (d[i + 3] / 255);
      r += d[i] * wt; g += d[i + 1] * wt; b += d[i + 2] * wt; w += wt;
    }
    return w < 2 ? null : [r / w, g / w, b / w].map(Math.round);
  }
  function glow(c) {
    if (!c) return "radial-gradient(70% 60% at 50% 30%, rgba(140,150,170,0.20), rgba(0,0,0,0) 75%)";
    const [r, g, b] = c;
    return `radial-gradient(75% 65% at 50% 28%, rgba(${r},${g},${b},0.42) 0%, rgba(${r},${g},${b},0.12) 50%, rgba(0,0,0,0) 80%)`;
  }
  function ambient(app) {
    if (!app || !app.icon || app.pkg === ambPkg) return;
    clearTimeout(ambTimer);
    ambTimer = setTimeout(() => {
      ambPkg = app.pkg;
      const show = (bg) => {
        const back = ambFront === "ambA" ? "ambB" : "ambA";
        $(back).style.background = bg;
        $(back).classList.add("show");
        $(ambFront).classList.remove("show");
        ambFront = back;
      };
      if (ambCache[app.pkg]) return show(ambCache[app.pkg]);
      const img = new Image();
      img.onload = () => {
        let c = null;
        try { c = brandColour(img); } catch (e) {}
        ambCache[app.pkg] = glow(c);
        show(ambCache[app.pkg]);
      };
      img.src = app.icon;
    }, 160);
  }

  /* ---------------- apps, folders and their saved layout ---------------- */
  // layout (saved): entries are an app package, or a folder {id, name, apps: [packages]}.
  // items (shown): {type: "app", app} or {type: "folder", f, apps: [app]} — hidden/uninstalled apps left out.
  let installed = [], layout = [], items = [];
  function loadApps() {
    try { installed = JSON.parse(TV.apps()) || []; } catch (e) { installed = []; }
    const hidden = new Set(store.get("home.hidden", []));
    const exclude = new Set(C.homeExclude);
    const visible = installed.filter((a) => !exclude.has(a.pkg) && !hidden.has(a.pkg));
    const byPkg = Object.fromEntries(visible.map((a) => [a.pkg, a]));
    layout = store.get("home.layout", null) || (store.get("home.order", null) || C.homeOrder).slice();
    const used = new Set();
    items = [];
    for (const e of layout) {
      if (typeof e === "string") {
        if (byPkg[e] && !used.has(e)) { used.add(e); items.push({ type: "app", app: byPkg[e] }); }
      } else if (e && Array.isArray(e.apps)) {
        const apps = e.apps.filter((p) => byPkg[p] && !used.has(p)).map((p) => byPkg[p]);
        apps.forEach((a) => used.add(a.pkg));
        if (apps.length) items.push({ type: "folder", f: e, apps });
      }
    }
    visible.filter((a) => !used.has(a.pkg)).sort((a, b) => a.label.localeCompare(b.label))
      .forEach((a) => items.push({ type: "app", app: a }));
  }
  // Save what is on screen, then rebuild from the saved layout (empty folders disappear).
  function commit() {
    layout = items.map((it) => (it.type === "app" ? it.app.pkg : it.f));
    store.set("home.layout", layout);
    const openId = openItem && openItem.f.id;
    loadApps();
    renderGrid();
    if (openId) {
      openItem = items.find((it) => it.type === "folder" && it.f.id === openId) || null;
      if (openItem) renderFolder(); else closeFolder();
    }
  }

  // Apple TV names a new folder after what's in it.
  const CATEGORY_NAMES = { 0: "Games", 1: "Music", 2: "Entertainment", 3: "Photos", 4: "Social", 5: "News", 6: "Travel", 7: "Productivity" };
  function folderNameFor(apps) {
    const vendor = (p) => p.split(".").slice(0, 2).join(".");
    if (apps.every((a) => vendor(a.pkg) === "com.sony")) return "Sony";
    if (apps.every((a) => vendor(a.pkg) === "com.google")) return "Google";
    const name = CATEGORY_NAMES[apps[0].category];
    return name || "Folder";
  }

  function artHtml(a) {
    if (!a.icon) return `<div class="art iconic"></div>`;
    return a.banner ? `<div class="art"><img src="${a.icon}" alt=""></div>`
                    : `<div class="art iconic"><img src="${a.icon}" alt=""></div>`;
  }
  function tileHtml(it) {
    if (it.type === "app") return `<div class="app">${artHtml(it.app)}<div class="name">${escapeHtml(it.app.label)}</div></div>`;
    const minis = it.apps.slice(0, 9).map((a) => `<div class="mini">${a.icon ? `<img class="${a.banner ? "" : "icon"}" src="${a.icon}" alt="">` : ""}</div>`).join("");
    return `<div class="app folder"><div class="art"><div class="minis">${minis}</div></div><div class="name">${escapeHtml(it.f.name)}</div></div>`;
  }
  function renderGrid() {
    $("grid").innerHTML = items.map(tileHtml).join("");
    view.main.idx = Math.min(view.main.idx, Math.max(0, items.length - 1));
    renderFocus();
  }

  /* ---------------- folder overlay ---------------- */
  let openItem = null;
  const folderList = () => openItem.apps.map((a) => ({ type: "app", app: a }));
  function renderFolder() {
    $("fdTitle").textContent = openItem.f.name;
    $("fdGrid").innerHTML = folderList().map(tileHtml).join("");
    view.folder.idx = Math.min(view.folder.idx, Math.max(0, openItem.apps.length - 1));
    renderFocus();
  }
  function openFolder(it) {
    openItem = it;
    ctx = "folder";
    view.folder.idx = 0;
    renderFolder();
    document.body.classList.add("folder-open");
  }
  function closeFolder() {
    ctx = "main";
    openItem = null;
    document.body.classList.remove("folder-open");
    renderFocus();
  }

  /* ---------------- focus + scrolling ---------------- */
  // ctx: which grid has focus ("main" or the open "folder").
  // zone: "grid" | "top" (Wi-Fi/Settings) | "pop" (long-press menu) | "move" | "prompt" (rename dialog open)
  let ctx = "main", zone = "grid", topIdx = 0, popIdx = 0, popActions = [];
  const view = { main: { idx: 0 }, folder: { idx: 0 } };
  const cur = () => view[ctx];
  const list = () => (ctx === "main" ? items : folderList());
  const TOP = ["tbWifi", "tbSettings"];
  const ROW_H = 169 + 96, COL_W = 300 + 52, GRID_LEFT = 106;
  const GRID_TOP = 620, FOLDER_TOP = 310;

  // Main grid: the top row sits low with room above; lower rows scroll up to y=340.
  // Folder: three rows fit; further rows scroll up.
  function shiftFor(c, idx) {
    const row = Math.floor(idx / COLS);
    if (c === "folder") return row > 2 ? -(row - 2) * ROW_H : 0;
    return zone !== "top" && row > 0 ? -(GRID_TOP + row * ROW_H - 340) : 0;
  }

  function renderFocus() {
    const tiles = $("grid").children, ftiles = $("fdGrid").children;
    const active = zone === "grid" || zone === "pop" || zone === "prompt";
    for (let i = 0; i < tiles.length; i++) {
      tiles[i].classList.toggle("focused", ctx === "main" && active && i === view.main.idx);
      tiles[i].classList.toggle("moving", ctx === "main" && zone === "move" && i === view.main.idx);
    }
    for (let i = 0; i < ftiles.length; i++) {
      ftiles[i].classList.toggle("focused", ctx === "folder" && active && i === view.folder.idx);
      ftiles[i].classList.toggle("moving", ctx === "folder" && zone === "move" && i === view.folder.idx);
    }
    TOP.forEach((id, i) => $(id).classList.toggle("focused", zone === "top" && i === topIdx));
    [...$("popItems").querySelectorAll(".pop-item")].forEach((b, i) => b.classList.toggle("focused", i === popIdx));

    const mainShift = shiftFor("main", view.main.idx);
    document.body.classList.toggle("scrolled", mainShift !== 0);
    $("grid").style.transform = `translateY(${mainShift}px)`;
    $("fdGrid").style.transform = `translateY(${shiftFor("folder", view.folder.idx)}px)`;

    const it = list()[cur().idx];
    if (zone !== "top" && it) ambient(it.type === "app" ? it.app : it.apps[0]);
    if (zone === "pop" || zone === "move") placePop();
  }

  function move(dir) {
    const n = list().length;
    if (!n) return;
    const v = cur(), col = v.idx % COLS;
    if (dir === "left" && col > 0) v.idx--;
    else if (dir === "right" && col < COLS - 1 && v.idx + 1 < n) v.idx++;
    else if (dir === "down" && v.idx + COLS < n) v.idx += COLS;
    else if (dir === "down" && Math.floor(v.idx / COLS) < Math.floor((n - 1) / COLS)) v.idx = n - 1;
    else if (dir === "up" && v.idx - COLS >= 0) v.idx -= COLS;
    else if (dir === "up" && ctx === "main") { zone = "top"; topIdx = 0; }
  }

  // Move mode: shift the focused app/folder one place within its grid.
  function moveItem(dir) {
    const arr = ctx === "main" ? items : openItem.apps;
    const v = cur(), n = arr.length;
    let to = v.idx;
    if (dir === "left") to = v.idx - 1;
    else if (dir === "right") to = v.idx + 1;
    else if (dir === "up") to = v.idx - COLS;
    else if (dir === "down") to = Math.min(n - 1, v.idx + COLS);
    if (to < 0 || to >= n || to === v.idx) return;
    const [x] = arr.splice(v.idx, 1);
    arr.splice(to, 0, x);
    v.idx = to;
    if (ctx === "main") {
      $("grid").innerHTML = items.map(tileHtml).join("");
    } else {
      // Keep any hidden apps in the folder after the visible ones.
      const shown = new Set(openItem.apps.map((a) => a.pkg));
      openItem.f.apps = openItem.apps.map((a) => a.pkg).concat(openItem.f.apps.filter((p) => !shown.has(p)));
      $("fdGrid").innerHTML = folderList().map(tileHtml).join("");
    }
  }

  /* ---------------- popover above the app (long press) ---------------- */
  const ICON = {
    move: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7l-4 5 4 5M17 7l4 5-4 5M3 12h18"/></svg>',
    hide: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18M10.6 5.1A10.4 10.4 0 0 1 12 5c6 0 10 7 10 7a17.6 17.6 0 0 1-3.2 3.9M6.6 6.6C3.9 8.4 2 12 2 12s4 7 10 7a9.9 9.9 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
    show: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>',
    ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>',
    folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    out: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>',
    rename: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4"/></svg>',
    ungroup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/><path d="M14 4h6v6M10 20H4v-6"/></svg>',
  };

  function placePop() {
    const pop = $("pop"), v = cur();
    const col = v.idx % COLS, row = Math.floor(v.idx / COLS);
    const cx = GRID_LEFT + col * COL_W + 150;
    const top = ctx === "main" ? GRID_TOP : FOLDER_TOP;
    const tileTop = top + row * ROW_H + shiftFor(ctx, v.idx) - 18; // focused tile is lifted and scaled
    const w = pop.offsetWidth, h = pop.offsetHeight;
    const left = Math.max(40, Math.min(1880 - w, cx - w / 2));
    pop.style.left = left + "px";
    pop.style.top = tileTop - 24 - h + "px";
    pop.querySelector(".pop-tail").style.left = cx - left + "px";
  }

  function showPop(actions) {
    popActions = actions;
    $("popItems").innerHTML = actions.map(([t, icon, , cls]) =>
      `<div class="pop-item ${cls || ""}">${icon}<span>${escapeHtml(t)}</span></div>`).join("");
    popIdx = 0;
    zone = "pop";
    renderFocus();
    $("pop").hidden = false;
  }
  function closePop() {
    $("pop").hidden = true;
    zone = "grid";
    renderFocus();
  }
  function startMove() {
    zone = "move";
    $("popItems").innerHTML = `<div class="pop-hint">${ICON.move}<span>Move with the arrows</span>${ICON.ok}<span>OK</span></div>`;
    renderFocus();
  }

  function hideApp(a) {
    store.set("home.hidden", store.get("home.hidden", []).concat(a.pkg));
    closePop();
    commit();
  }
  function showHidden() {
    store.set("home.hidden", []);
    closePop();
    commit();
  }

  function openPop() {
    const it = list()[cur().idx];
    if (!it) return;
    const hiddenCount = store.get("home.hidden", []).length;
    const actions = [];
    if (it.type === "folder") {
      actions.push(["Rename", ICON.rename, () => startRename(it)]);
      actions.push(["Move", ICON.move, startMove]);
      actions.push(["Remove Folder", ICON.ungroup, () => ungroup(it)]);
    } else if (ctx === "main") {
      const a = it.app;
      actions.push(["Move", ICON.move, startMove]);
      actions.push(["Add to Folder", ICON.folder, () => folderChoices(a)]);
      actions.push(["Hide", ICON.hide, () => hideApp(a)]);
      if (!a.system) actions.push(["Delete", ICON.trash, () => { closePop(); TV.uninstall(a.pkg); }, "danger"]);
    } else {
      const a = it.app;
      actions.push(["Move", ICON.move, startMove]);
      actions.push(["Move Out", ICON.out, () => moveOut(a)]);
      actions.push(["Hide", ICON.hide, () => hideApp(a)]);
      if (!a.system) actions.push(["Delete", ICON.trash, () => { closePop(); TV.uninstall(a.pkg); }, "danger"]);
    }
    if (hiddenCount && it.type === "app") actions.push([`Show ${hiddenCount} hidden`, ICON.show, showHidden]);
    showPop(actions);
  }

  // "Add to Folder": a new folder in this app's place, or any existing folder.
  function folderChoices(a) {
    const folders = items.filter((x) => x.type === "folder");
    showPop([
      ["New Folder", ICON.plus, () => newFolder(a)],
      ...folders.map((f) => [f.f.name, ICON.folder, () => addToFolder(a, f)]),
    ]);
  }
  function newFolder(a) {
    const i = items.findIndex((x) => x.type === "app" && x.app.pkg === a.pkg);
    const f = { id: "f" + Date.now().toString(36), name: folderNameFor([a]), apps: [a.pkg] };
    items[i] = { type: "folder", f, apps: [a] };
    closePop();
    commit();
  }
  function addToFolder(a, folder) {
    items = items.filter((x) => !(x.type === "app" && x.app.pkg === a.pkg));
    folder.f.apps = folder.f.apps.filter((p) => p !== a.pkg).concat(a.pkg);
    view.main.idx = Math.max(0, items.indexOf(folder));
    closePop();
    commit();
  }
  function moveOut(a) {
    const folder = openItem;
    folder.f.apps = folder.f.apps.filter((p) => p !== a.pkg);
    const at = items.indexOf(folder) + 1;
    items.splice(at, 0, { type: "app", app: a });
    closePop();
    commit();
  }
  function ungroup(folder) {
    const at = items.indexOf(folder);
    items.splice(at, 1, ...folder.apps.map((a) => ({ type: "app", app: a })));
    closePop();
    commit();
  }

  // Rename: one-click names in the popover, or "Type a Name…" for the TV keyboard.
  const NAME_IDEAS = ["Entertainment", "Islamic", "Kids", "Music", "Sony", "Tools"];
  const KEYBOARD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M18 13h.01M9 15.5h6"/></svg>';
  function startRename(folder) {
    const rename = (name) => { folder.f.name = name; closePop(); commit(); };
    showPop([
      ["Type a Name…", KEYBOARD, () => {
        closePop();
        zone = "prompt"; // the native dialog has the keys until it closes
        window.onPrompt = (text) => {
          zone = "grid";
          if (text && text.trim()) { folder.f.name = text.trim().slice(0, 24); commit(); } else renderFocus();
        };
        TV.promptText("Folder name", folder.f.name);
      }],
      ...NAME_IDEAS.filter((n) => n !== folder.f.name).map((n) => [n, ICON.rename, () => rename(n)]),
    ]);
  }

  /* ---------------- keys ---------------- */
  const KEYS = {
    37: "left", 38: "up", 39: "right", 40: "down", 13: "ok", 23: "ok", 66: "ok",
    27: "back", 8: "back", 4: "back", 179: "options", 85: "options", 82: "options", 93: "options",
  };
  const NAMED = { ArrowLeft: "left", ArrowUp: "up", ArrowRight: "right", ArrowDown: "down", Enter: "ok", Escape: "back", GoBack: "back", MediaPlayPause: "options", ContextMenu: "options" };
  let okDownAt = 0, longTimer = null, longFired = false, lastArrow = 0;
  const ARROW_REPEAT_MS = 140; // holding an arrow glides instead of skipping frames

  document.addEventListener("keydown", (e) => {
    if (zone === "prompt") return;
    const k = NAMED[e.key] || KEYS[e.keyCode];
    if (!k) return;
    e.preventDefault();
    if (k === "left" || k === "right" || k === "up" || k === "down") {
      const now = Date.now();
      if (e.repeat && now - lastArrow < ARROW_REPEAT_MS) return;
      lastArrow = now;
    }
    if (k === "ok") {
      // Long press OK opens the options popover (like holding the touch surface on Apple TV).
      // Android repeats key-down while OK is held; the first repeat (~0.4 s) means a long press.
      if (okDownAt) {
        if (!longFired && zone === "grid" && Date.now() - okDownAt > 300) { clearTimeout(longTimer); longFired = true; openPop(); }
        return;
      }
      okDownAt = Date.now();
      longFired = false;
      if (zone === "grid") longTimer = setTimeout(() => { longFired = true; openPop(); }, LONG_PRESS_MS);
      return;
    }
    handle(k);
  });
  document.addEventListener("keyup", (e) => {
    if (zone === "prompt") return;
    const k = NAMED[e.key] || KEYS[e.keyCode];
    if (k !== "ok") return;
    e.preventDefault();
    if (!okDownAt) return; // release of a press we didn't see start (e.g. Enter that closed rename)
    clearTimeout(longTimer);
    const wasLong = longFired;
    okDownAt = 0;
    longFired = false;
    if (!wasLong) handle("ok");
  });

  function openTop(id) {
    try { if (id === "tbWifi") TV.openWifiSettings(); else TV.openSettings(); } catch (e) {}
  }
  // A remote with a pointer, or a touch screen, clicks the buttons directly.
  TOP.forEach((id) => $(id).addEventListener("click", () => openTop(id)));

  function handle(k) {
    if (zone === "grid") {
      const it = list()[cur().idx];
      if (k === "ok" && it) { if (it.type === "folder") openFolder(it); else TV.launch(it.app.pkg); }
      else if (k === "options") openPop();
      else if (k === "back") { if (ctx === "folder") return closeFolder(); view.main.idx = 0; }
      else move(k);
    } else if (zone === "top") {
      if (k === "left") topIdx = Math.max(0, topIdx - 1);
      else if (k === "right") topIdx = Math.min(TOP.length - 1, topIdx + 1);
      else if (k === "down" || k === "back") zone = "grid";
      // Called on TV itself: a bridge method taken off its object can't be called.
      else if (k === "ok") openTop(TOP[topIdx]);
    } else if (zone === "pop") {
      if (k === "left") popIdx = Math.max(0, popIdx - 1);
      else if (k === "right") popIdx = Math.min(popActions.length - 1, popIdx + 1);
      else if (k === "back" || k === "down") return closePop();
      else if (k === "ok") return popActions[popIdx][2]();
    } else if (zone === "move") {
      if (k === "ok" || k === "back" || k === "options") { closePop(); return commit(); }
      moveItem(k);
    }
    renderFocus();
  }

  // Called from MainActivity.
  window.onTvBack = () => handle("back");
  window.onTvHome = () => {
    if (zone === "move") commit();
    $("pop").hidden = true;
    zone = "grid";
    if (ctx === "folder") closeFolder();
    view.main.idx = 0;
    renderFocus();
  };
  window.onTvResume = () => {
    if (zone === "prompt") return;
    const it = items[view.main.idx];
    const key = it && (it.type === "app" ? it.app.pkg : it.f.id);
    commit();
    const i = items.findIndex((x) => (x.type === "app" ? x.app.pkg : x.f.id) === key);
    if (i >= 0) { view.main.idx = i; renderFocus(); }
    updateNetwork();
    tickClock();
    tickGlance(true);
    loadGlanceWeather();
  };

  /* ---------------- start ---------------- */
  fit();
  tickClock();
  startGlance();
  setInterval(() => { tickClock(); tickGlance(); }, 5000);
  updateNetwork();
  setInterval(updateNetwork, 15000);
  loadApps();
  renderGrid();
})();
