/* HRC Investigative Mandates — Workspace: collect paragraphs, resolutions and
   mechanisms while browsing, then export just that selection (citations, text,
   CSV) or share it as a link. Kept in this browser's localStorage only.
   Original code for this project (2026). */
(function () {
  "use strict";
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const $ = (sel, root) => (root || document).querySelector(sel);
  const STORE = "hrc-workspace-v1";
  const TYPE_LABEL = { p: "Paragraphs", r: "Resolutions", m: "Mechanisms" };
  const TYPE_ORDER = ["p", "r", "m"];
  const siteUrl = () => location.origin + location.pathname;

  /* ---------- state ---------- */
  let items = [];          // [{key, t, ...payload, note, added}]
  const providers = {};    // type -> (id) => item payload | null
  function load() {
    try {
      const raw = localStorage.getItem(STORE);
      const parsed = raw ? JSON.parse(raw) : null;
      items = Array.isArray(parsed && parsed.items) ? parsed.items : [];
    } catch (e) { items = []; }
  }
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify({ items })); } catch (e) { /* private mode / quota */ }
  }
  const has = (key) => items.some(it => it.key === key);
  const count = () => items.length;

  function add(item, opts) {
    if (!item || !item.key || has(item.key)) return false;
    items.push(Object.assign({ note: "", added: new Date().toISOString().slice(0, 10) }, item));
    save(); changed();
    if (!(opts && opts.quiet)) toast("Saved to your workspace", true);
    return true;
  }
  function remove(key) {
    const before = items.length;
    items = items.filter(it => it.key !== key);
    if (items.length !== before) { save(); changed(); }
  }
  function toggle(key) {
    if (has(key)) { remove(key); return false; }
    const t = key.slice(0, 1), id = key.slice(2);
    const make = providers[t];
    const payload = make ? make(id) : null;
    if (!payload) { toast("This item cannot be saved right now — open it first."); return false; }
    return add(Object.assign({ key, t }, payload));
  }
  function clear() { items = []; save(); changed(); }

  function changed() {
    refreshButtons();
    const c = $("#ws-count");
    if (c) { c.textContent = String(count()); c.hidden = !count(); }
    const drawer = $("#ws-drawer");
    if (drawer && !drawer.hidden) renderDrawer();
    document.dispatchEvent(new CustomEvent("hrc-workspace-change", { detail: { count: count() } }));
  }
  function refreshButtons() {
    document.querySelectorAll("[data-ws-key]").forEach(b => {
      const on = has(b.dataset.wsKey);
      b.setAttribute("aria-pressed", String(on));
      b.textContent = on ? (b.dataset.wsOn || "Saved ✓") : (b.dataset.wsOff || "Save");
      b.title = on ? "In your workspace — click to remove" : "Save to your workspace";
    });
  }

  /* ---------- toast ---------- */
  let toastTimer = null;
  function toast(msg, withOpen) {
    let el = $("#ws-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "ws-toast"; el.className = "ws-toast"; el.setAttribute("role", "status");
      document.body.appendChild(el);
      el.addEventListener("click", (e) => { if (e.target.closest(".ws-toast-open")) { open(); el.classList.remove("show"); } });
    }
    el.innerHTML = esc(msg) + (withOpen ? ` <button class="ws-toast-open">Open workspace</button>` : "");
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
  }

  /* ---------- drawer ---------- */
  function ensureDrawer() {
    if ($("#ws-drawer")) return;
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div class="ws-backdrop" id="ws-backdrop" hidden></div>
      <aside class="ws-drawer" id="ws-drawer" role="dialog" aria-label="Workspace" hidden>
        <div class="ws-head">
          <h3>Workspace</h3><span class="count" id="ws-head-count"></span>
          <button class="modal-close" id="ws-close" aria-label="Close">✕</button>
        </div>
        <div class="ws-tools" id="ws-tools"></div>
        <div class="ws-body" id="ws-body"></div>
        <div class="ws-foot">Kept in this browser only (nothing is sent anywhere). Export or copy a link to keep it.</div>
      </aside>`;
    document.body.appendChild(wrap);
    $("#ws-close").addEventListener("click", close);
    $("#ws-backdrop").addEventListener("click", close);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#ws-drawer").hidden) close(); });
    $("#ws-tools").addEventListener("click", onTool);
    $("#ws-body").addEventListener("click", onItemClick);
    $("#ws-body").addEventListener("input", (e) => {
      const inp = e.target.closest("input.ws-note");
      if (!inp) return;
      const it = items.find(x => x.key === inp.closest(".ws-item").dataset.key);
      if (it) { it.note = inp.value; save(); }
    });
  }
  function open() {
    ensureDrawer();
    renderDrawer();
    $("#ws-drawer").hidden = false; $("#ws-backdrop").hidden = false;
    document.body.style.overflow = "hidden";
  }
  function close() {
    const d = $("#ws-drawer");
    if (!d) return;
    d.hidden = true; $("#ws-backdrop").hidden = true;
    document.body.style.overflow = "";
  }
  function renderDrawer() {
    const n = count();
    $("#ws-head-count").textContent = n ? `${n} item${n > 1 ? "s" : ""}` : "";
    $("#ws-tools").innerHTML = n ? `
      <button class="icon-btn" data-tool="cites" title="Copy the citations of all saved paragraphs and resolutions">Copy citations</button>
      <button class="icon-btn" data-tool="txt" title="Download the selection as a text file: verbatim paragraphs with citations, plus your notes">Download text</button>
      <button class="icon-btn" data-tool="csv" title="Download the selection as a spreadsheet">Download CSV</button>
      <button class="icon-btn" data-tool="link" title="Copy a link that opens this selection for anyone">Copy link</button>
      <span class="spacer"></span>
      <button class="icon-btn reset-btn" data-tool="clear">Clear all</button>` : "";
    const body = $("#ws-body");
    if (!n) {
      body.innerHTML = `<div class="ws-empty">
        <p><b>Nothing saved yet.</b></p>
        <p>While you read, click <span class="chip" style="cursor:default">Save</span> on a paragraph in the
        Reports tab, or <span class="chip" style="cursor:default">☆ Save</span> on a resolution or a mechanism.
        Your selection collects here; then export just those items as citations, a text file or a spreadsheet,
        or copy a link to share the selection.</p></div>`;
      return;
    }
    body.innerHTML = TYPE_ORDER.map(t => {
      const group = items.filter(it => it.t === t);
      if (!group.length) return "";
      return `<section class="ws-group"><h4>${TYPE_LABEL[t]} <span class="count">${group.length}</span></h4>
        ${group.map(renderItem).join("")}</section>`;
    }).join("");
  }
  function renderItem(it) {
    let head = "", snippet = "";
    if (it.t === "p") {
      head = `<span class="sym">${esc(it.symbol || it.doc_id || "")}</span> <b>${esc(it.label)}</b>
        <span class="ws-dim">· ${esc(it.body || "")}${it.date ? " · " + esc(it.date) : ""}</span>`;
      snippet = it.text.length > 260 ? it.text.slice(0, 250).trim() + " …" : it.text;
    } else if (it.t === "r") {
      head = `<span class="sym">${esc(it.sym)}</span> <span class="ws-dim">· ${esc(it.date || "")}${it.mode ? " · " + esc(it.mode) : ""}</span>`;
      snippet = `${it.title}${it.tally ? " — " + it.tally : ""}${it.bodies && it.bodies.length ? " — " + it.bodies.join(", ") : ""}`;
    } else {
      head = `<b>${esc(it.name)}</b> <span class="ws-dim">· ${esc(it.country || "")}${it.years ? " · " + esc(it.years) : ""}</span>`;
      snippet = `${it.full_name || ""}${it.verbs ? " — " + it.verbs : ""}`;
    }
    return `<div class="ws-item" data-key="${esc(it.key)}">
      <div class="ws-item-head">${head}
        <span class="spacer"></span>
        <button class="chip ws-open" title="Open">open</button>
        <button class="chip ws-remove" title="Remove from the workspace">✕</button></div>
      <div class="ws-snippet">${esc(snippet)}</div>
      <input class="ws-note" placeholder="Add a note (kept with the export)" value="${esc(it.note || "")}">
    </div>`;
  }
  function onItemClick(e) {
    const row = e.target.closest(".ws-item");
    if (!row) return;
    const it = items.find(x => x.key === row.dataset.key);
    if (!it) return;
    if (e.target.closest(".ws-remove")) { remove(it.key); return; }
    if (e.target.closest(".ws-open")) {
      close();
      const app = window.HRCApp, rep = window.HRCReports;
      if (it.t === "p" && rep) { app.setTab("reports"); rep.openDoc(it.rec_id, it.id); }
      else if (it.t === "r" && app) app.openResolution(it.sym);
      else if (it.t === "m" && app && app.openMechanism) app.openMechanism(it.name);
    }
  }

  /* ---------- export ---------- */
  function copyText(text, okMsg) {
    const done = () => toast(okMsg || "Copied to the clipboard");
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    else fallbackCopy(text, done);
  }
  function fallbackCopy(text, done) {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); done(); } catch (e) { toast("Copy failed — select the text and copy it manually."); }
    ta.remove();
  }
  function paraLink(it) { return `${siteUrl()}#/reports/doc/${encodeURIComponent(it.rec_id)}/${encodeURIComponent(it.id)}`; }
  function resCite(it) {
    return `Human Rights Council, resolution ${it.sym.replace(/^A\/HRC\/RES\//, "")}, "${it.title}", ${it.date || ""}${it.mode ? ` (${it.mode}${it.tally ? ": " + it.tally : ""})` : ""}, UN Doc ${it.sym}.`;
  }
  function allCitations() {
    const lines = [];
    items.filter(it => it.t === "p").forEach(it => lines.push(it.cite));
    items.filter(it => it.t === "r").forEach(it => lines.push(resCite(it)));
    return lines.join("\n");
  }
  function exportText() {
    const today = new Date().toISOString().slice(0, 10);
    const out = [];
    out.push("UN Investigative Mandates — workspace export");
    out.push(`Retrieved ${today} from ${siteUrl()}`);
    out.push("Data: UN Investigative Mandates dataset (Helena Rodríguez-Bronchú Carceller). Paragraph text is verbatim from the UN documents; nothing is generated.");
    out.push("");
    let i = 0;
    const ps = items.filter(it => it.t === "p");
    if (ps.length) {
      out.push(`PARAGRAPHS (${ps.length})`, "=".repeat(60), "");
      ps.forEach(it => {
        i++;
        out.push(`[${i}] ${it.cite}`, "", it.text.replace(/\r?\n/g, "\r\n"), "");
        if (it.note) out.push(`Note: ${it.note}`, "");
        out.push(`Source: ${it.unlink || ""}`.trim(), `Open here: ${paraLink(it)}`, "", "-".repeat(60), "");
      });
    }
    const rs = items.filter(it => it.t === "r");
    if (rs.length) {
      out.push(`RESOLUTIONS (${rs.length})`, "=".repeat(60), "");
      rs.forEach(it => {
        i++;
        out.push(`[${i}] ${resCite(it)}`);
        if (it.bodies && it.bodies.length) out.push(`Mechanism(s): ${it.bodies.join(", ")}`);
        if (it.role) out.push(`Role of the text: ${it.role}`);
        if (it.note) out.push(`Note: ${it.note}`);
        out.push(`Source: ${it.unlink || ""}`, "");
      });
      out.push("-".repeat(60), "");
    }
    const ms = items.filter(it => it.t === "m");
    if (ms.length) {
      out.push(`MECHANISMS (${ms.length})`, "=".repeat(60), "");
      ms.forEach(it => {
        i++;
        out.push(`[${i}] ${it.full_name || it.name} (${it.name})${it.country ? ` — ${it.country}` : ""}${it.years ? `, ${it.years}` : ""}`);
        if (it.verbs) out.push(`Mandate action verbs: ${it.verbs}`);
        if (it.frameworks) out.push(`Mandate legal frameworks: ${it.frameworks}`);
        if (it.note) out.push(`Note: ${it.note}`);
        if (it.link) out.push(`Mandating text: ${it.link}`);
        out.push("");
      });
    }
    downloadBlob("workspace-" + today + ".txt", out.join("\r\n"), "text/plain;charset=utf-8");
  }
  function exportCSV() {
    const app = window.HRCApp;
    const headers = ["Type", "Reference", "Title / mechanism", "Date", "Paragraph", "Text", "Mechanism(s)", "Citation", "Note", "Open here", "UN source"];
    const rows = items.map(it => {
      if (it.t === "p") return ["Paragraph", it.symbol || it.doc_id || "", it.title || "", it.date || "", it.label, it.text, it.body || "", it.cite, it.note || "", paraLink(it), it.unlink || ""];
      if (it.t === "r") return ["Resolution", it.sym, it.title, it.date || "", "", it.tally ? `${it.mode}: ${it.tally}` : (it.mode || ""), (it.bodies || []).join("; "), resCite(it), it.note || "", `${siteUrl()}#/res/${encodeURIComponent(it.sym)}`, it.unlink || ""];
      return ["Mechanism", it.name, it.full_name || "", it.years || "", "", it.verbs || "", it.country || "", "", it.note || "", `${siteUrl()}#/mech/${encodeURIComponent(it.name)}`, it.link || ""];
    });
    if (app && app.downloadCSV) app.downloadCSV("workspace-" + new Date().toISOString().slice(0, 10), headers, rows, `Workspace selection (${items.length} items)`);
  }
  function downloadBlob(name, content, type) {
    const blob = new Blob(["﻿" + content], { type });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  function shareLink() {
    const payload = { p: items.filter(i => i.t === "p").map(i => i.id),
                      r: items.filter(i => i.t === "r").map(i => i.sym),
                      m: items.filter(i => i.t === "m").map(i => i.name) };
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return `${siteUrl()}#/workspace/${b64}`;
  }
  function onTool(e) {
    const b = e.target.closest("[data-tool]");
    if (!b) return;
    const tool = b.dataset.tool;
    if (tool === "cites") copyText(allCitations(), "Citations copied");
    else if (tool === "txt") exportText();
    else if (tool === "csv") exportCSV();
    else if (tool === "link") {
      const url = shareLink();
      if (url.length > 6000) toast("Too many items for one link — export the text or CSV instead.");
      else copyText(url, "Link copied — anyone opening it sees this selection");
    } else if (tool === "clear") {
      if (confirm(`Remove all ${count()} items from the workspace?`)) clear();
    }
  }

  /* ---------- shared-selection links (#/workspace/<payload>) ---------- */
  function handleHash() {
    const m = /^#\/workspace(?:\/([A-Za-z0-9_-]+))?$/.exec(location.hash);
    if (!m) return false;
    if (!m[1]) { open(); return true; }
    let payload = null;
    try {
      const b64 = m[1].replace(/-/g, "+").replace(/_/g, "/");
      payload = JSON.parse(decodeURIComponent(escape(atob(b64))));
    } catch (e) { toast("This workspace link could not be read."); return true; }
    const app = window.HRCApp, rep = window.HRCReports;
    let added = 0;
    (payload.r || []).forEach(sym => { if (providers.r && !has("r:" + sym)) { const it = providers.r(sym); if (it && add(Object.assign({ key: "r:" + sym, t: "r" }, it), { quiet: true })) added++; } });
    (payload.m || []).forEach(name => { if (providers.m && !has("m:" + name)) { const it = providers.m(name); if (it && add(Object.assign({ key: "m:" + name, t: "m" }, it), { quiet: true })) added++; } });
    const pids = (payload.p || []).filter(id => !has("p:" + id));
    const finish = () => {
      open();
      toast(added ? `${added} item${added > 1 ? "s" : ""} added from the shared link` : "Everything in the shared link was already in your workspace");
      history.replaceState(null, "", "#/workspace");
    };
    if (pids.length && rep && rep.loadAll) {
      toast("Loading the shared paragraphs…");
      rep.loadAll().then(() => {
        pids.forEach(id => { const it = providers.p ? providers.p(id) : null; if (it && add(Object.assign({ key: "p:" + id, t: "p" }, it), { quiet: true })) added++; });
        finish();
      });
    } else finish();
    return true;
  }

  /* ---------- wiring ---------- */
  function register(type, fn) { providers[type] = fn; }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-ws-key]");
    if (b) { e.preventDefault(); toggle(b.dataset.wsKey); }
  });
  const toggleBtn = $("#ws-toggle");
  if (toggleBtn) toggleBtn.addEventListener("click", open);

  load();
  // providers exposed by the other modules (they load before this file)
  if (window.HRCApp && window.HRCApp.wsItems) Object.entries(window.HRCApp.wsItems).forEach(([t, fn]) => register(t, fn));
  if (window.HRCReports && window.HRCReports.wsItem) register("p", window.HRCReports.wsItem);
  changed();
  window.addEventListener("load", handleHash);
  window.addEventListener("hashchange", () => { if (/^#\/workspace/.test(location.hash)) handleHash(); });

  window.HRCWorkspace = { add, remove, toggle, has, count, open, close, register, refreshButtons };
})();
