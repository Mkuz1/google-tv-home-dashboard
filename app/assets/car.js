// Car home screen (car/AndroidManifest.xml): CarPlay-style dock and pages of app icons, plus a
// Dashboard with time, weather and prayer times. Touch first; steering-wheel / rotary keys work too.
// Same features as the TV home screen: folders, move, hide, delete, rename.
(function () {
  const C = window.CONFIG;
  const D = window.DASH;
  const TV = window.TV || window.MOCK_TV;
  const $ = (id) => document.getElementById(id);
  const LONG_PRESS_MS = 520;
  // Saved through Android preferences (the page's localStorage can lose recent writes).
  const store = {
    get(k, d) { try { const v = JSON.parse(TV.getPref(k)); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { TV.setPref(k, JSON.stringify(v)); } catch (e) {} },
  };
  // Weather is cached in localStorage, shared with the screensaver.
  const local = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };
  const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  /* ---------------- scaling ---------------- */
  // Designed 720 units tall on a landscape screen (any width: 1920x720, 1280x720, 1024x600...),
  // 720 units wide on a portrait one (the dock moves to the bottom).
  let S = 1, SW = 1920, SH = 720;
  function fit() {
    // Android WebView reports innerWidth in device pixels; clientWidth is the real CSS width.
    const W = document.documentElement.clientWidth || innerWidth;
    const H = document.documentElement.clientHeight || innerHeight;
    const portrait = H > W;
    S = portrait ? W / 720 : H / 720;
    SW = Math.round(W / S); SH = Math.round(H / S);
    document.body.classList.toggle("portrait", portrait);
    document.body.classList.toggle("narrow", !portrait && SW < 1500);
    const el = $("stage");
    el.style.width = SW + "px";
    el.style.height = SH + "px";
    el.style.transform = `scale(${S})`;
    measure();
    renderGrid();
    if (openItem) renderFolder();
  }
  addEventListener("resize", fit);

  /* ---------------- wallpaper ---------------- */
  function wallpaper() {
    const day = Math.floor(Date.now() / 86400000);
    const url = C.scenes[day % C.scenes.length];
    const img = new Image();
    img.onload = () => { $("wallImg").style.backgroundImage = `url("${url}")`; $("wallImg").classList.add("show"); };
    img.src = url;
  }

  /* ---------------- dock: clock, Wi-Fi, recent apps ---------------- */
  function tickClock() {
    const d = new Date();
    $("clock").textContent = D.hm(d);
    $("clockAmpm").textContent = D.ampm(d);
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
    $("dkWifi").innerHTML = wifiIcon(net);
  }

  // Like CarPlay, the dock shows the apps used last.
  const RECENT_COUNT = 3;
  function recentApps() {
    const byPkg = Object.fromEntries(installed.map((a) => [a.pkg, a]));
    const recent = store.get("car.recent", []).filter((p) => byPkg[p]).map((p) => byPkg[p]);
    for (const it of items) {
      if (recent.length >= RECENT_COUNT) break;
      if (it.type === "app" && !recent.includes(it.app)) recent.push(it.app);
    }
    return recent.slice(0, RECENT_COUNT);
  }
  function renderDock() {
    const apps = recentApps();
    $("dkRecents").innerHTML = apps.map((a) =>
      `<button class="recent" data-pkg="${escapeHtml(a.pkg)}" aria-label="${escapeHtml(a.label)}">${a.icon ? `<img src="${a.icon}" alt="">` : ""}</button>`).join("");
    $("dkView").innerHTML = document.body.classList.contains("dashboard") ? ICON.grid : ICON.dash;
  }
  function launch(a) {
    TV.launch(a.pkg);
    store.set("car.recent", [a.pkg].concat(store.get("car.recent", []).filter((p) => p !== a.pkg)).slice(0, 8));
    setTimeout(renderDock, 400);
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
    layout = store.get("home.layout", null) || C.homeOrder.slice();
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
    renderDock();
    if (openId) {
      openItem = items.find((it) => it.type === "folder" && it.f.id === openId) || null;
      if (openItem) renderFolder(); else closeFolder();
    }
  }

  const CATEGORY_NAMES = { 0: "Games", 1: "Music", 2: "Entertainment", 3: "Photos", 4: "Social", 5: "News", 6: "Navigation", 7: "Productivity" };
  function folderNameFor(apps) {
    const vendor = (p) => p.split(".").slice(0, 2).join(".");
    if (apps.every((a) => vendor(a.pkg) === "com.google")) return "Google";
    return CATEGORY_NAMES[apps[0].category] || "Folder";
  }

  /* ---------------- pages of icons ---------------- */
  // Geometry in stage units, from the size of the main area.
  const G = { vw: 0, vh: 0, cols: 5, rows: 2, per: 10, icon: 120, cellW: 180, cellH: 170, pages: 1 };
  function measure() {
    const vp = $("viewport");
    G.vw = vp.offsetWidth; G.vh = vp.offsetHeight;
    G.rows = Math.max(1, Math.min(4, Math.floor(G.vh / 250)));
    G.icon = Math.round(Math.max(76, Math.min(124, (G.vh / G.rows) * 0.56)));
    G.cellW = Math.round(G.icon * 1.5);
    G.cellH = G.icon + 12 + 28;
    G.cols = Math.max(2, Math.min(10, Math.floor(G.vw / (G.icon * 1.62))));
    G.per = G.cols * G.rows;
    document.documentElement.style.setProperty("--icon", G.icon + "px");
  }

  function artHtml(a) {
    if (!a.icon) return `<div class="art"></div>`;
    // Older apps without an adaptive icon: shown smaller on the grey square, not stretched.
    return `<div class="art${a.small ? " small" : ""}"><img src="${a.icon}" alt=""></div>`;
  }
  function tileHtml(it, i) {
    if (it.type === "app") return `<div class="app" data-i="${i}">${artHtml(it.app)}<div class="name">${escapeHtml(it.app.label)}</div></div>`;
    const minis = it.apps.slice(0, 9).map((a) => `<div class="mini">${a.icon ? `<img src="${a.icon}" alt="">` : ""}</div>`).join("");
    return `<div class="app folder" data-i="${i}"><div class="art"><div class="minis">${minis}</div></div><div class="name">${escapeHtml(it.f.name)}</div></div>`;
  }

  let page = 0;
  function renderGrid() {
    G.pages = Math.max(1, Math.ceil(items.length / G.per));
    let html = "";
    for (let p = 0; p < G.pages; p++) {
      const tiles = items.slice(p * G.per, (p + 1) * G.per).map((it, k) => tileHtml(it, p * G.per + k)).join("");
      html += `<div class="page" style="left:${p * G.vw}px;width:${G.vw}px;` +
        `grid-template-columns:repeat(${G.cols},${G.cellW}px);grid-template-rows:repeat(${G.rows},${G.cellH}px)">${tiles}</div>`;
    }
    $("pages").innerHTML = html;
    $("dots").innerHTML = Array.from({ length: G.pages }, (_, p) => `<button class="dot" data-p="${p}"></button>`).join("");
    $("dots").classList.toggle("one", G.pages < 2);
    view.main.idx = Math.min(view.main.idx, Math.max(0, items.length - 1));
    goPage(Math.min(page, G.pages - 1), false);
    renderFocus();
  }
  function setTrack(offset) {
    $("pages").style.transform = `translateX(${-page * G.vw + offset}px)`;
  }
  function goPage(p, glide = true) {
    page = Math.max(0, Math.min(G.pages - 1, p));
    $("pages").classList.toggle("glide", glide);
    setTrack(0);
    [...$("dots").children].forEach((d, i) => d.classList.toggle("on", i === page));
  }

  /* ---------------- folder ---------------- */
  let openItem = null;
  const folderList = () => openItem.apps.map((a) => ({ type: "app", app: a }));
  let fcols = 4;
  function renderFolder() {
    // A glass platter over the main area, three rows tall; more rows scroll.
    const main = $("main");
    fcols = Math.max(2, Math.min(G.cols - 1, Math.ceil(Math.sqrt(openItem.apps.length * 1.6))));
    const w = Math.min(main.offsetWidth - 60, fcols * G.cellW + (fcols + 1) * 30 + 40);
    const h = Math.min(main.offsetHeight - 30, 110 + Math.min(3, Math.ceil(openItem.apps.length / fcols)) * (G.cellH + 22) + 30);
    const pl = document.querySelector(".fd-platter");
    pl.style.width = w + "px";
    pl.style.height = h + "px";
    pl.style.left = main.offsetLeft + (main.offsetWidth - w) / 2 + "px";
    pl.style.top = main.offsetTop + (main.offsetHeight - h) / 2 + "px";
    $("fdTitle").textContent = openItem.f.name;
    const g = $("fdGrid");
    g.style.gridTemplateColumns = `repeat(${fcols},${G.cellW}px)`;
    g.style.gridAutoRows = G.cellH + "px";
    g.innerHTML = folderList().map(tileHtml).join("");
    view.folder.idx = Math.min(view.folder.idx, Math.max(0, openItem.apps.length - 1));
    renderFocus();
  }
  function openFolder(it) {
    openItem = it;
    ctx = "folder";
    view.folder.idx = 0;
    renderFolder();
    $("fdScroll").scrollTop = 0;
    document.body.classList.add("folder-open");
  }
  function closeFolder() {
    ctx = "main";
    openItem = null;
    document.body.classList.remove("folder-open");
    renderFocus();
  }

  /* ---------------- views: Home (app pages) and Dashboard ---------------- */
  function setView(v) {
    document.body.classList.toggle("dashboard", v === "dashboard");
    if (v === "dashboard") renderDashboard(true);
    renderDock();
  }
  const isDash = () => document.body.classList.contains("dashboard");

  /* ---------------- focus (keys) ---------------- */
  // ctx: which grid has focus ("main" or the open "folder").
  // zone: "grid" | "dock" | "pop" (long-press menu) | "move" | "prompt" (rename dialog open)
  let ctx = "main", zone = "grid", popIdx = 0, popActions = [], dockIdx = 0;
  const view = { main: { idx: 0 }, folder: { idx: 0 } };
  const cur = () => view[ctx];
  const list = () => (ctx === "main" ? items : folderList());
  const tileEl = (c, i) => (c === "main" ? $("pages") : $("fdGrid")).querySelector(`.app[data-i="${i}"]`);
  const dockEls = () => [$("dkClock"), $("dkWifi"), ...$("dkRecents").children, $("dkSettings"), $("dkView")];

  function renderFocus() {
    document.querySelectorAll(".app.focused, .app.moving, #dock .focused").forEach((e) => e.classList.remove("focused", "moving"));
    const active = zone === "grid" || zone === "pop" || zone === "prompt";
    const el = tileEl(ctx, cur().idx);
    if (el && active && !(ctx === "main" && isDash())) el.classList.add("focused");
    if (el && zone === "move") el.classList.add("moving");
    if (zone === "dock") { const d = dockEls()[dockIdx]; if (d) d.classList.add("focused"); }
    [...$("popItems").children].forEach((b, i) => b.classList.toggle("focused", i === popIdx && document.body.classList.contains("keys")));
    document.body.classList.toggle("moving", zone === "move");
    $("moveBar").hidden = zone !== "move";
    if (ctx === "main" && Math.floor(cur().idx / G.per) !== page && document.body.classList.contains("keys")) goPage(Math.floor(cur().idx / G.per));
    if (ctx === "folder" && el && document.body.classList.contains("keys")) el.scrollIntoView({ block: "nearest" });
  }

  function moveFocus(dir) {
    const n = list().length;
    if (!n) return;
    const v = cur();
    if (ctx === "folder") {
      const col = v.idx % fcols;
      if (dir === "left" && col > 0) v.idx--;
      else if (dir === "right" && col < fcols - 1 && v.idx + 1 < n) v.idx++;
      else if (dir === "down" && v.idx + fcols < n) v.idx += fcols;
      else if (dir === "up" && v.idx - fcols >= 0) v.idx -= fcols;
      return;
    }
    const p = Math.floor(v.idx / G.per), k = v.idx % G.per, col = k % G.cols, row = Math.floor(k / G.cols);
    if (dir === "left") {
      if (col > 0) v.idx--;
      else if (p > 0) v.idx = (p - 1) * G.per + row * G.cols + G.cols - 1;
      else { zone = "dock"; dockIdx = Math.min(dockIdx, dockEls().length - 1); }
    } else if (dir === "right") {
      if (col < G.cols - 1 && v.idx + 1 < n) v.idx++;
      else if (p < G.pages - 1) v.idx = Math.min(n - 1, (p + 1) * G.per + row * G.cols);
    } else if (dir === "down") {
      if (row < G.rows - 1 && v.idx + G.cols < n) v.idx += G.cols;
      else if (row < G.rows - 1 && Math.floor((n - 1 - p * G.per) / G.cols) > row) v.idx = n - 1;
    } else if (dir === "up" && row > 0) v.idx -= G.cols;
  }

  // Move mode: shift the app/folder being moved to another place within its grid.
  function moveTo(to) {
    const arr = ctx === "main" ? items : openItem.apps;
    const v = cur(), n = arr.length;
    to = Math.max(0, Math.min(n - 1, to));
    if (to === v.idx) return;
    const [x] = arr.splice(v.idx, 1);
    arr.splice(to, 0, x);
    v.idx = to;
    if (ctx === "main") {
      renderGrid();
      goPage(Math.floor(to / G.per));
    } else {
      // Keep any hidden apps in the folder after the visible ones.
      const shown = new Set(openItem.apps.map((a) => a.pkg));
      openItem.f.apps = openItem.apps.map((a) => a.pkg).concat(openItem.f.apps.filter((p) => !shown.has(p)));
      renderFolder();
    }
    renderFocus();
  }
  function moveByKey(dir) {
    const v = cur(), cols = ctx === "main" ? G.cols : fcols;
    const d = { left: -1, right: 1, up: -cols, down: cols }[dir];
    if (d) moveTo(v.idx + d);
  }
  function endMove() {
    zone = "grid";
    renderFocus();
    commit();
  }

  /* ---------------- long-press menu ---------------- */
  const ICON = {
    move: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7l-4 5 4 5M17 7l4 5-4 5M3 12h18"/></svg>',
    hide: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18M10.6 5.1A10.4 10.4 0 0 1 12 5c6 0 10 7 10 7a17.6 17.6 0 0 1-3.2 3.9M6.6 6.6C3.9 8.4 2 12 2 12s4 7 10 7a9.9 9.9 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
    show: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>',
    folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    out: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>',
    rename: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4"/></svg>',
    ungroup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/><path d="M14 4h6v6M10 20H4v-6"/></svg>',
    keyboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M18 13h.01M9 15.5h6"/></svg>',
    // Dock button: shows the other view, like CarPlay's.
    grid: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="5" height="5" rx="1.4"/><rect x="9.5" y="3" width="5" height="5" rx="1.4"/><rect x="16" y="3" width="5" height="5" rx="1.4"/><rect x="3" y="9.5" width="5" height="5" rx="1.4"/><rect x="9.5" y="9.5" width="5" height="5" rx="1.4"/><rect x="16" y="9.5" width="5" height="5" rx="1.4"/><rect x="3" y="16" width="5" height="5" rx="1.4"/><rect x="9.5" y="16" width="5" height="5" rx="1.4"/><rect x="16" y="16" width="5" height="5" rx="1.4"/></svg>',
    dash: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2.5" y="3" width="9" height="18" rx="2.4"/><rect x="13" y="3" width="8.5" height="8.2" rx="2.4"/><rect x="13" y="12.8" width="8.5" height="8.2" rx="2.4"/></svg>',
  };

  function placePop() {
    const el = tileEl(ctx, cur().idx);
    if (!el) return;
    const pop = $("pop"), st = $("stage").getBoundingClientRect(), r = el.querySelector(".art").getBoundingClientRect();
    const cx = (r.left + r.width / 2 - st.left) / S;
    const top = (r.top - st.top) / S, bottom = (r.bottom - st.top) / S;
    const w = pop.offsetWidth, h = pop.offsetHeight;
    const left = Math.max(20, Math.min(SW - 20 - w, cx - w / 2));
    const below = top - 22 - h < 10;
    pop.classList.toggle("below", below);
    pop.style.left = left + "px";
    pop.style.top = (below ? bottom + 22 : top - 22 - h) + "px";
    pop.querySelector(".pop-tail").style.left = cx - left + "px";
  }
  function showPop(actions) {
    popActions = actions;
    $("popItems").innerHTML = actions.map(([t, icon, , cls]) =>
      `<button class="pop-item ${cls || ""}">${icon}<span>${escapeHtml(t)}</span></button>`).join("");
    popIdx = 0;
    zone = "pop";
    document.body.classList.add("popping");
    renderFocus();
    placePop();
    $("pop").hidden = false;
  }
  function closePop() {
    $("pop").hidden = true;
    document.body.classList.remove("popping");
    if (zone === "pop") zone = "grid";
    renderFocus();
  }
  function startMove() {
    closePop();
    zone = "move";
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
  function del(a) {
    closePop();
    TV.uninstall(a.pkg);
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
      if (!a.system) actions.push(["Delete", ICON.trash, () => del(a), "danger"]);
    } else {
      const a = it.app;
      actions.push(["Move", ICON.move, startMove]);
      actions.push(["Move Out", ICON.out, () => moveOut(a)]);
      actions.push(["Hide", ICON.hide, () => hideApp(a)]);
      if (!a.system) actions.push(["Delete", ICON.trash, () => del(a), "danger"]);
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
    items.splice(items.indexOf(folder) + 1, 0, { type: "app", app: a });
    closePop();
    commit();
  }
  function ungroup(folder) {
    items.splice(items.indexOf(folder), 1, ...folder.apps.map((a) => ({ type: "app", app: a })));
    closePop();
    commit();
  }

  // Rename: one-tap names in the menu, or "Type a Name…" for the keyboard.
  const NAME_IDEAS = ["Navigation", "Music", "Islamic", "Phone", "Entertainment", "Tools"];
  function startRename(folder) {
    const rename = (name) => { folder.f.name = name; closePop(); commit(); };
    showPop([
      ["Type a Name…", ICON.keyboard, () => {
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

  /* ---------------- touch ---------------- */
  // Tap opens, hold opens the menu, swipe sideways turns the page. In move mode, drag the
  // lifted app (to an edge to change page) or tap where it should go.
  let press = null, edgeTimer = null;
  function keysOff() { document.body.classList.remove("keys"); }

  function nearestTile(c, x, y, skip) {
    let best = null, bestD = Infinity;
    const root = c === "main" ? $("pages").children[page] : $("fdGrid");
    if (!root) return null;
    for (const el of root.querySelectorAll(".app")) {
      if (el === skip) continue;
      const r = el.getBoundingClientRect();
      const d = Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y);
      if (d < bestD) { bestD = d; best = el; }
    }
    return best;
  }

  function onDown(e, c) {
    if (e.button > 0 || zone === "prompt") return;
    keysOff();
    const el = e.target.closest(".app");
    const i = el ? +el.dataset.i : -1;
    press = { c, el, i, x0: e.clientX, y0: e.clientY, t0: Date.now(), mode: null, long: false, id: e.pointerId };
    if (zone === "move") {
      if (el && c === ctx && i === cur().idx) { press.mode = "drag"; el.classList.add("lifted"); }
      return;
    }
    if (!el) return;
    el.classList.add("pressed");
    press.timer = setTimeout(() => {
      if (!press || press.el !== el) return;
      press.long = true;
      el.classList.remove("pressed");
      ctx = c; cur().idx = i;
      openPop();
    }, LONG_PRESS_MS);
  }

  function onMove(e) {
    if (!press || e.pointerId !== press.id) return;
    const dx = (e.clientX - press.x0) / S, dy = (e.clientY - press.y0) / S;
    if (press.mode === "drag") {
      press.el.style.transform = `translate(${dx}px, ${dy}px) scale(1.12)`;
      dragEdge(e);
      return;
    }
    if (!press.mode && Math.hypot(dx, dy) > 12) {
      clearTimeout(press.timer);
      if (press.el) press.el.classList.remove("pressed");
      if (press.long) return;
      press.mode = press.c === "main" && Math.abs(dx) > Math.abs(dy) ? "swipe" : "scroll";
      if (press.mode === "swipe") $("pages").classList.remove("glide");
    }
    if (press.mode === "swipe") {
      const atEnd = (page === 0 && dx > 0) || (page === G.pages - 1 && dx < 0);
      setTrack(atEnd ? dx / 3 : dx);
    }
  }

  function onUp(e) {
    if (!press || e.pointerId !== press.id) return;
    const p = press;
    press = null;
    clearTimeout(p.timer);
    clearTimeout(edgeTimer); edgeTimer = null;
    if (p.el) p.el.classList.remove("pressed");
    const dx = (e.clientX - p.x0) / S;
    if (p.mode === "swipe") {
      const v = dx / Math.max(1, Date.now() - p.t0);
      let to = page;
      if ((dx < -G.vw * 0.15 || v < -0.45) && page < G.pages - 1) to++;
      else if ((dx > G.vw * 0.15 || v > 0.45) && page > 0) to--;
      goPage(to);
      return;
    }
    if (p.mode === "drag") {
      p.el.classList.remove("lifted");
      p.el.style.transform = "";
      const target = nearestTile(p.c, e.clientX, e.clientY, p.el);
      if (target && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) > 20) moveTo(+target.dataset.i);
      return;
    }
    if (p.long || p.mode) return;
    if (e.type === "pointercancel") return;
    if (zone === "move") {
      // Tap a place (or an app) in the same grid to move the lifted app there.
      if (p.c !== ctx) return;
      const target = p.el || nearestTile(p.c, e.clientX, e.clientY);
      if (target) moveTo(+target.dataset.i);
      return;
    }
    if (!p.el) return;
    ctx = p.c; cur().idx = p.i;
    activate();
  }

  // Dragging the lifted app to the left/right edge for a moment turns the page and takes it along.
  function dragEdge(e) {
    if (press.c !== "main") return;
    const r = $("viewport").getBoundingClientRect();
    const edge = 60 * S;
    const dir = e.clientX < r.left + edge ? -1 : e.clientX > r.right - edge ? 1 : 0;
    if (!dir) { clearTimeout(edgeTimer); edgeTimer = null; return; }
    if (edgeTimer) return;
    edgeTimer = setTimeout(() => {
      edgeTimer = null;
      const to = page + dir;
      if (!press || press.mode !== "drag" || to < 0) return;
      press = null;
      // Last page full: a new page starts after the last item.
      moveTo(dir > 0 ? Math.min(items.length - 1, to * G.per) : to * G.per + G.per - 1);
    }, 650);
  }

  function activate() {
    const it = list()[cur().idx];
    if (!it) return;
    if (it.type === "folder") openFolder(it);
    else launch(it.app);
  }

  function bindGrid(el, c) {
    el.addEventListener("pointerdown", (e) => onDown(e, c));
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
  }
  bindGrid($("viewport"), "main");
  bindGrid($("fdGrid"), "folder");
  // Releases outside the grid (finger slid onto the dock) still end the press.
  addEventListener("pointerup", (e) => press && onUp(e));

  // Tap outside the folder platter closes it; tap outside the menu closes the menu.
  $("folder").addEventListener("pointerdown", (e) => {
    if (e.target === $("folder") && zone !== "prompt") { if (zone === "move") endMove(); closeFolder(); }
  });
  $("scrim").addEventListener("pointerdown", (e) => { e.preventDefault(); closePop(); });
  $("popItems").addEventListener("click", (e) => {
    const b = e.target.closest(".pop-item");
    if (!b) return;
    const i = [...$("popItems").children].indexOf(b);
    if (popActions[i]) popActions[i][2]();
  });
  $("moveDone").addEventListener("click", endMove);
  $("dots").addEventListener("click", (e) => { const d = e.target.closest(".dot"); if (d) goPage(+d.dataset.p); });

  // Dock
  $("dkRecents").addEventListener("click", (e) => {
    const b = e.target.closest(".recent");
    const a = b && installed.find((x) => x.pkg === b.dataset.pkg);
    if (a) launch(a);
  });
  $("dkWifi").addEventListener("click", () => TV.openWifiSettings());
  $("dkSettings").addEventListener("click", () => TV.openSettings());
  $("dkView").addEventListener("click", () => {
    if (zone === "move") endMove();
    if (openItem) closeFolder();
    setView(isDash() ? "apps" : "dashboard");
  });
  $("dkClock").addEventListener("click", startScreensaver);
  $("cClock").addEventListener("click", startScreensaver);
  document.addEventListener("pointerdown", () => { bump(); keysOff(); }, true);

  /* ---------------- keys: steering-wheel buttons, rotary knob, keyboard ---------------- */
  const KEYS = {
    37: "left", 38: "up", 39: "right", 40: "down", 13: "ok", 23: "ok", 66: "ok",
    27: "back", 8: "back", 4: "back", 82: "options", 93: "options",
  };
  const NAMED = { ArrowLeft: "left", ArrowUp: "up", ArrowRight: "right", ArrowDown: "down", Enter: "ok", Escape: "back", GoBack: "back", ContextMenu: "options" };
  let okDownAt = 0, longTimer = null, longFired = false;

  document.addEventListener("keydown", (e) => {
    bump();
    if (zone === "prompt") return;
    const k = NAMED[e.key] || KEYS[e.keyCode];
    if (!k) return;
    e.preventDefault();
    document.body.classList.add("keys");
    if (k === "ok") {
      // Holding OK opens the menu, like holding a finger on the icon.
      if (okDownAt) {
        if (!longFired && zone === "grid" && Date.now() - okDownAt > 300) { clearTimeout(longTimer); longFired = true; openPop(); }
        return;
      }
      okDownAt = Date.now();
      longFired = false;
      if (zone === "grid" && !(ctx === "main" && isDash())) longTimer = setTimeout(() => { longFired = true; openPop(); }, LONG_PRESS_MS + 130);
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

  function handle(k) {
    if (zone === "grid") {
      if (ctx === "main" && isDash()) {
        if (k === "left" || k === "back") { zone = "dock"; if (k === "back") { setView("apps"); zone = "grid"; } }
      } else if (k === "ok") activate();
      else if (k === "options") openPop();
      else if (k === "back") {
        if (ctx === "folder") return closeFolder();
        view.main.idx = 0; goPage(0);
      } else moveFocus(k);
    } else if (zone === "dock") {
      const els = dockEls(), portrait = document.body.classList.contains("portrait");
      const prev = portrait ? "left" : "up", next = portrait ? "right" : "down", out = portrait ? "up" : "right";
      if (k === prev) dockIdx = Math.max(0, dockIdx - 1);
      else if (k === next) dockIdx = Math.min(els.length - 1, dockIdx + 1);
      else if (k === out || k === "back") zone = "grid";
      else if (k === "ok" && els[dockIdx]) els[dockIdx].click();
    } else if (zone === "pop") {
      if (k === "left" || k === "up") popIdx = Math.max(0, popIdx - 1);
      else if (k === "right" || k === "down") popIdx = Math.min(popActions.length - 1, popIdx + 1);
      else if (k === "back") return closePop();
      else if (k === "ok") return popActions[popIdx][2]();
    } else if (zone === "move") {
      if (k === "ok" || k === "back" || k === "options") return endMove();
      moveByKey(k);
    }
    renderFocus();
  }

  /* ---------------- dashboard: time, weather, prayer times ---------------- */
  const dateFmt = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  let hijriFmt;
  try { hijriFmt = new Intl.DateTimeFormat("ar-u-ca-islamic-umalqura-nu-latn", { day: "numeric", month: "long", year: "numeric" }); } catch (e) {}
  let today = null, tomorrow = null, lastDay = -1, lastMinute = -1;

  function renderDashboard(force) {
    const now = new Date(Date.now() + (C.previewShiftMinutes || 0) * 60000);
    if (now.getDate() !== lastDay) {
      lastDay = now.getDate();
      today = prayerTimes(now, C);
      const t = new Date(now); t.setDate(t.getDate() + 1);
      tomorrow = prayerTimes(t, C);
      $("dDate").textContent = dateFmt.format(now);
      $("dHijri").textContent = hijriFmt ? hijriFmt.format(now) : "";
      $("prList").innerHTML = D.PRAYERS.map(([k, en, ar]) =>
        `<li data-k="${k}"><span class="en">${en}</span><span class="ar">${ar}</span><span class="tm">${D.hm(today[k])} <small>${D.ampm(today[k])}</small></span></li>`).join("");
    }
    if (!force && now.getMinutes() === lastMinute) return;
    lastMinute = now.getMinutes();
    $("dTime").textContent = D.hm(now);
    $("dAmpm").textContent = D.ampm(now);
    const next = D.nextPrayer(now, today, tomorrow);
    for (const li of $("prList").children) {
      const k = li.dataset.k;
      li.classList.toggle("next", k === next.key);
      li.classList.toggle("past", today[k] <= now && k !== next.key);
    }
    $("prNext").textContent = `${next.name} in ${D.inMinutes(next.minutes)}`;
    $("dChips").innerHTML = D.dayReminders(now, today, C).map((c) => `<div class="chip">${c}</div>`).join("");
  }

  async function loadWeather() {
    try {
      const r = await fetch(D.weatherUrl(C), { cache: "no-store" });
      if (!r.ok) throw new Error(r.status);
      const data = await r.json();
      local.set("weather", { at: Date.now(), data });
      renderWeather(data);
    } catch (e) {
      const cached = local.get("weather");
      if (cached) renderWeather(cached.data, true);
    }
  }
  function renderWeather(d, stale) {
    const c = d.current;
    $("wIcon").innerHTML = D.weatherIcon(c.weather_code, c.is_day === 1);
    $("wTemp").textContent = Math.round(c.temperature_2m) + "°";
    $("wCity").textContent = C.city;
    $("wCond").textContent = D.WMO[c.weather_code] || "";
    $("wExtra").textContent = `Feels ${Math.round(c.apparent_temperature)}° · Humidity ${c.relative_humidity_2m}%` + (stale ? " · offline" : "");
    const dd = d.daily;
    $("wDays").innerHTML = dd.time.map((t, i) =>
      `<div class="day${i === 0 ? " today" : ""}"><div class="dn">${D.dayName(t, i)}</div>${D.weatherIcon(dd.weather_code[i])}` +
      `<div class="hl">${Math.round(dd.temperature_2m_max[i])}°<span>${Math.round(dd.temperature_2m_min[i])}°</span></div></div>`).join("");
  }
  function refreshWeather() {
    const cached = local.get("weather");
    if (cached) renderWeather(cached.data, true);
    if (!cached || Date.now() - cached.at > C.weatherMinutes * 60000) loadWeather();
  }

  // Look the car's city up once a day (from its internet connection); on the first lookup, reload.
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

  /* ---------------- screensaver after a few idle minutes ---------------- */
  // Head units rarely have a screensaver setting, so the home screen opens it itself.
  let lastInput = Date.now(), visible = true;
  function bump() { lastInput = Date.now(); }
  function startScreensaver() {
    bump();
    try { TV.startScreensaver(); } catch (e) {}
  }
  setInterval(() => {
    const mins = C.screensaverMinutes;
    if (!mins || !visible || document.hidden || zone === "prompt" || zone === "move") return;
    if (Date.now() - lastInput > mins * 60000) startScreensaver();
  }, 10000);

  // Called from MainActivity.
  window.onTvPause = () => { visible = false; };
  window.onTvBack = () => handle("back");
  window.onTvHome = () => {
    if (zone === "move") endMove();
    closePop();
    zone = "grid";
    if (ctx === "folder") closeFolder();
    view.main.idx = 0;
    setView(C.homeView);
    goPage(0);
    renderFocus();
  };
  window.onTvResume = () => {
    visible = true;
    bump();
    if (zone === "prompt") return;
    const it = items[view.main.idx];
    const key = it && (it.type === "app" ? it.app.pkg : it.f.id);
    commit();
    const i = items.findIndex((x) => (x.type === "app" ? x.app.pkg : x.f.id) === key);
    if (i >= 0) { view.main.idx = i; renderFocus(); }
    updateNetwork();
    tickClock();
    renderDashboard(true);
    refreshWeather();
  };

  /* ---------------- start ---------------- */
  const logo = (C.logoText || "").trim();
  $("dLogo").hidden = !logo;
  $("dLogo").innerHTML = D.logoHtml(logo);
  checkLocation();
  loadApps();
  fit();
  setView(C.homeView);
  wallpaper();
  tickClock();
  setInterval(tickClock, 5000);
  updateNetwork();
  setInterval(updateNetwork, 15000);
  renderDashboard(true);
  setInterval(() => renderDashboard(false), 5000);
  refreshWeather();
  setInterval(loadWeather, C.weatherMinutes * 60000);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measure(); renderGrid(); });
})();
