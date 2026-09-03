/* HRC Investigative Mandates — first-visit tour: six short steps that point at
   the tabs, a mechanism card, the filter bar, the votes matrix, the Ask box and
   the workspace. Runs once (remembered in localStorage); "? Tour" replays it.
   Original code for this project (2026). */
(function () {
  "use strict";
  const $ = (sel, root) => (root || document).querySelector(sel);
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const STORE = "hrc-tour-done-v1";

  const STEPS = [
    { tab: null, sel: ".tabbar", title: "Five views of one dataset",
      text: "Mechanisms, Resolutions, Votes, Reports and About & method. Every figure on the site links back to the UN document it comes from." },
    { tab: "mechs", sel: "#mechs-content .panel", title: "Start with a mechanism",
      text: "Each row is one investigative body. Open it to read its founding mandate verbatim, the resolutions that created and renewed it, how the votes evolved, and its reports." },
    { tab: "res", sel: "#filterbar", title: "Filter the resolutions",
      text: "Narrow by year or mechanism, or search a title. “More filters” adds country, adoption mode, the mandate wording, criminal-accountability language, and gender and children references. The same filter bar follows you to the Votes tab." },
    { tab: "votes", sel: "#votes-content", title: "How states voted",
      text: "The matrix shows every recorded vote — one row per state, one column per resolution. Click a state for its profile and alignments, a column for the resolution, or switch to Sponsorship." },
    { tab: "reports", sel: ".ask-box", title: "Ask the reports",
      text: "Type keywords or a question and you get the matching paragraphs verbatim, with citations — nothing is generated. “Browse documents” opens any report paragraph by paragraph." },
    { tab: null, sel: "#ws-toggle", title: "Collect and export",
      text: "Save paragraphs, resolutions and mechanisms as you go. Your workspace lets you add notes, copy the citations, download the selection as text or CSV, or share it as a link." },
  ];

  let idx = -1, els = null, posTimer = null;

  function mount() {
    if (els) return;
    const back = document.createElement("div"); back.className = "tour-backdrop";
    const spot = document.createElement("div"); spot.className = "tour-spot";
    const pop = document.createElement("div"); pop.className = "tour-pop"; pop.setAttribute("role", "dialog"); pop.setAttribute("aria-label", "Site tour");
    document.body.append(back, spot, pop);
    els = { back, spot, pop };
    pop.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.act === "next") next();
      else if (b.dataset.act === "back") show(idx - 1);
      else if (b.dataset.act === "skip") end();
    });
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", schedulePos);
    window.addEventListener("scroll", schedulePos, true);
  }
  function unmount() {
    if (!els) return;
    Object.values(els).forEach(e => e.remove());
    els = null;
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("resize", schedulePos);
    window.removeEventListener("scroll", schedulePos, true);
  }
  function onKey(e) {
    if (idx < 0) return;
    if (e.key === "Escape") end();
    else if (e.key === "ArrowRight" || e.key === "Enter") next();
    else if (e.key === "ArrowLeft") show(idx - 1);
  }
  function schedulePos() { clearTimeout(posTimer); posTimer = setTimeout(position, 60); }

  function start() {
    if (window.HRCWorkspace) window.HRCWorkspace.close();
    const ov = $("#overlay"); if (ov) ov.classList.remove("open");
    mount();
    show(0);
  }
  function end() {
    idx = -1;
    try { localStorage.setItem(STORE, "1"); } catch (e) { /* unavailable */ }
    unmount();
  }
  function next() { if (idx >= STEPS.length - 1) end(); else show(idx + 1); }

  function show(i) {
    idx = Math.max(0, Math.min(STEPS.length - 1, i));
    const s = STEPS[idx];
    const app = window.HRCApp;
    if (s.tab && app) app.setTab(s.tab);
    els.pop.innerHTML = `
      <h4>${esc(s.title)}</h4>
      <p>${esc(s.text)}</p>
      <div class="tour-nav">
        <button class="icon-btn" data-act="skip">${idx === STEPS.length - 1 ? "Close" : "Skip tour"}</button>
        <span class="spacer"></span>
        <span class="step">${idx + 1} / ${STEPS.length}</span>
        ${idx > 0 ? `<button class="icon-btn" data-act="back">Back</button>` : ""}
        <button class="icon-btn tour-primary" data-act="next">${idx === STEPS.length - 1 ? "Done" : "Next"}</button>
      </div>`;
    // the target may have just been rendered by the tab switch
    setTimeout(() => {
      const t = target();
      if (t) t.scrollIntoView({ block: "center", behavior: "auto" });
      position();
    }, 80);
  }
  function target() {
    const s = STEPS[idx];
    return s ? document.querySelector(s.sel) : null;
  }
  function position() {
    if (!els || idx < 0) return;
    const t = target();
    const vw = window.innerWidth, vh = window.innerHeight;
    let r = t ? t.getBoundingClientRect() : { left: vw / 2 - 40, top: vh / 2 - 20, width: 80, height: 40 };
    const pad = 6;
    const h = Math.min(r.height, vh * 0.55);
    const box = { left: Math.max(0, r.left - pad), top: Math.max(0, r.top - pad), width: Math.min(vw, r.width + pad * 2), height: h + pad * 2 };
    Object.assign(els.spot.style, { left: box.left + "px", top: box.top + "px", width: box.width + "px", height: box.height + "px" });
    const pop = els.pop;
    const pw = Math.min(360, vw - 16);
    pop.style.width = pw + "px";
    const ph = pop.offsetHeight || 160;
    let top = box.top + box.height + 12;
    if (top + ph > vh - 8) top = Math.max(8, box.top - ph - 12);
    let left = box.left + Math.min(box.width / 2, 200) - pw / 2;
    left = Math.max(8, Math.min(vw - pw - 8, left));
    Object.assign(pop.style, { left: left + "px", top: top + "px" });
  }

  /* ---------- wiring ---------- */
  const btn = $("#tour-btn");
  if (btn) btn.addEventListener("click", start);
  let seen = false;
  try { seen = !!localStorage.getItem(STORE); } catch (e) { seen = true; }
  const plainEntry = !location.hash || location.hash === "#/mechs";
  if (!seen && plainEntry) setTimeout(start, 900);

  window.HRCTour = { start, end };
})();
