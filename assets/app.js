/* HRC Investigative Mandates — core app + Votes tab.
   Original code for this project (2026). UI patterns inspired by
   L. Szoszkiewicz's hrc-voting explorer (re-implemented from scratch). */
(function () {
  "use strict";
  const D = window.HRC_DATA;
  if (!D) { document.body.textContent = "Data payload missing (data/core.js)."; return; }

  /* ---------- helpers ---------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const MONTHS_LONG = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  const fmtLongDate = (iso) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
    return m ? `${+m[3]} ${MONTHS_LONG[+m[2] - 1]} ${m[1]}` : "—";
  };
  const fmtDate = (iso) => {
    if (!iso) return "—";
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return iso;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${+m[3]} ${months[+m[2] - 1]} ${m[1]}`;
  };
  const cssVar = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const unLink = (sym) => `https://docs.un.org/en/${sym}`;
  /* ---------- indices ---------- */
  // Reference-only bodies: special procedures with investigative tasks, kept on the site
  // for context, but whose resolutions, votes and sponsorships are excluded from every
  // count, chart and filter.
  const REF_SCOPE = "Special procedure with investigative tasks (reference only)";
  const REF_BODIES = new Set(D.bodies.filter(b => b.scope === REF_SCOPE).map(b => b.short_name));
  const isRefRes = (r) => (r.bodies || []).length > 0 && (r.bodies || []).every(bn => REF_BODIES.has(bn));
  const byDate = (a, b) => (a.date_adopted || "").localeCompare(b.date_adopted || "");
  const RES = D.resolutions.filter(r => !isRefRes(r)).sort(byDate);
  const REFRES = D.resolutions.filter(isRefRes).map(r => Object.assign({}, r, { reference_only: true })).sort(byDate);
  const bySym = new Map(RES.map(r => [r.symbol, r]));
  const byRefSym = new Map(REFRES.map(r => [r.symbol, r]));
  const STATES = D.states;
  const stateIdxByName = new Map(STATES.map((s, i) => [s.state, i]));
  const bodyByName = new Map(D.bodies.map(b => [b.short_name, b]));
  const YEARS = { min: Math.min(...RES.map(r => r.year || 9999)), max: Math.max(...RES.map(r => r.year || 0)) };

  const GROUP_META = [
    { key: "African Group", short: "African Group", color: "--c1" },
    { key: "Asia-Pacific Group", short: "Asia-Pacific Group", color: "--c2" },
    { key: "Eastern European Group", short: "Eastern European Group", color: "--c5" },
    { key: "GRULAC", short: "GRULAC", color: "--c3" },
    { key: "WEOG", short: "WEOG", color: "--c8" },
  ];
  function groupOf(name) {
    if (!name) return null;
    for (const g of GROUP_META) if (name.startsWith(g.key)) return g;
    return { key: name, short: name.replace(/\s*\(.*\)$/, ""), color: "--muted" };
  }

  // country of a resolution = countries of its bodies
  // (display alias: the source data uses both "DRC" and the full name)
  const COUNTRY_ALIAS = { "DRC": "Democratic Republic of the Congo" };
  const countryName = (c) => COUNTRY_ALIAS[c] || c;
  function countriesOf(r) {
    const cs = new Set();
    (r.bodies || []).forEach(bn => {
      const b = bodyByName.get(bn);
      if (b && b.country) cs.add(countryName(b.country));
    });
    return cs;
  }

  // legal-framework combinations (canonical order IHRL, IHL, ICL), fixed colors
  const FW_ORDER = { IHRL: 0, IHL: 1, ICL: 2 };
  const FW_TITLE = {
    IHRL: "International human rights law is named in the mandate paragraphs",
    IHL: "International humanitarian law is named in the mandate paragraphs",
    ICL: "Coder's label: the mandate paragraphs name crimes or criminal proceedings (crimes against humanity, war crimes, criminal responsibility, prosecutions, the ICC). No mandate paragraph in the dataset uses the phrase 'international criminal law'.",
  };
  const FW_COMBO_COLOR = {
    "IHRL": "--c1", "IHRL + IHL": "--c2", "IHRL + ICL": "--c5",
    "IHRL + IHL + ICL": "--c4", "IHL": "--c3", "ICL": "--c6", "(none)": "--grid",
  };

  const ROLE_COLOR = { founding: "--c1", renewal: "--c2", expansion: "--c5", tasking: "--c3" };
  const MODE_COLOR = { "Recorded vote": "--c1", "Consensus": "--c2" };
  // Criminal-accountability wording of the mandate paragraphs (literal coding, one value per text):
  //  - "names crimes or criminal proceedings": the mandate text uses the word crime(s) or
  //    criminal-justice vocabulary (crimes against humanity, war crimes, genocide, criminal/command
  //    responsibility, criminal prosecutions or proceedings, International Criminal Court, legal proceedings);
  //  - "accountability or perpetrators wording only": accountability / impunity / those responsible /
  //    perpetrators, with none of the above;
  //  - "none": neither; "no mandate text": renewals that only extend the mandate "as set out in" an earlier text.
  // No mandate paragraph in the dataset contains the phrase "international criminal law".
  const CA_COLOR = {
    "names crimes or criminal proceedings": "--seq-550",
    "accountability or perpetrators wording only": "--seq-250",
    "none": "--grid", "no mandate text": "--grid",
  };
  const CA_SHORT = {
    "names crimes or criminal proceedings": "names crimes",
    "accountability or perpetrators wording only": "accountability wording only",
    "none": "none", "no mandate text": "no mandate text",
  };
  const ROLES = ["founding", "renewal", "expansion", "tasking"];
  const CAS = ["names crimes or criminal proceedings", "accountability or perpetrators wording only", "none", "no mandate text"];
  const GENDER_LABELS = ["gender analysis", "SGBV", "women and girls"];
  const LOCS = [["mandate", "in the mandate"], ["other_ops", "in other operative paragraphs"], ["preamble", "in the preamble"]];

  const votesOf = (sym) => D.votes[sym] || null;
  const sponsorsOf = (sym) => D.sponsorships[sym] || null;
  const SPONSORED_COUNT = Object.keys(D.sponsorships).filter(s => bySym.has(s)).length;

  /* ---------- filter state ---------- */
  const F = {
    q: "", y0: YEARS.min, y1: YEARS.max, body: "", country: "", mode: "",
    role: "", ca: "", genderLoc: "", genderLabel: "", children: "",
    verbs: new Set(), fw: new Set(),
  };
  const VERBS = [...new Set(RES.flatMap(r => r.action_verbs || []))].sort();
  const FWS = ["IHRL", "IHL", "ICL"];
  const COUNTRIES = [...new Set(D.bodies.map(b => countryName(b.country)).filter(Boolean))].sort();

  function genderAll(r) {
    const g = r.gender_language || {};
    return [...(g.mandate || []), ...(g.other_ops || []), ...(g.preamble || [])];
  }
  function matches(r) {
    if (r.year < F.y0 || r.year > F.y1) return false;
    if (F.body && !(r.bodies || []).includes(F.body)) return false;
    if (F.country && !countriesOf(r).has(F.country)) return false;
    if (F.mode && r.adoption_mode !== F.mode) return false;
    if (F.role && (r.resolution_role || "") !== F.role) return false;
    if (F.ca) {
      if (F.ca === "(not coded)") { if (r.criminal_accountability) return false; }
      else if (r.criminal_accountability !== F.ca) return false;
    }
    const g = r.gender_language || {};
    if (F.genderLoc) {
      if (F.genderLoc === "(none)") { if (genderAll(r).length) return false; }
      else if (!(g[F.genderLoc] || []).length) return false;
    }
    if (F.genderLabel) {
      const pool = F.genderLoc && F.genderLoc !== "(none)" ? (g[F.genderLoc] || []) : genderAll(r);
      if (!pool.includes(F.genderLabel)) return false;
    }
    if (F.children) {
      const ch = r.children_language || [];
      if (F.children === "(none)") { if (ch.length) return false; }
      else if (!ch.includes(F.children)) return false;
    }
    if (F.verbs.size && ![...F.verbs].every(v => (r.action_verbs || []).includes(v))) return false;
    if (F.fw.size && ![...F.fw].every(v => (r.legal_frameworks || []).includes(v))) return false;
    if (F.q) {
      const q = F.q.toLowerCase();
      const hay = `${r.symbol} ${r.title} ${(r.bodies || []).join(" ")}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }
  const filtered = () => RES.filter(matches);
  // reference-only texts that pass the same filters: listed in the table with a tag, never counted
  const refFiltered = () => REFRES.filter(matches);

  /* ---------- filter bar ---------- */
  function opt(v, label, sel) { return `<option value="${esc(v)}"${sel === v ? " selected" : ""}>${esc(label)}</option>`; }
  let paintMoreFilters = () => {};

  function renderFilters() {
    const yearOpts = (sel) => {
      let o = "";
      for (let y = YEARS.min; y <= YEARS.max; y++) o += opt(String(y), String(y), String(sel));
      return o;
    };
    const MECH_OPTS = D.bodies.filter(b => (b.resolutions || []).length).map(b => b.short_name).sort();
    $("#filterbar").innerHTML = `
      <div class="filter-row">
        <div class="f-item"><label for="f-body">Mechanism</label>
          <select id="f-body">${opt("", "All")}${MECH_OPTS.map(b => opt(b, b, F.body)).join("")}</select></div>
        <div class="f-item"><label for="f-country">Situation</label>
          <select id="f-country">${opt("", "All")}${COUNTRIES.map(c => opt(c, c, F.country)).join("")}</select></div>
        <div class="f-item"><label for="f-y0">From</label><select id="f-y0">${yearOpts(F.y0)}</select></div>
        <div class="f-item"><label for="f-y1">To</label><select id="f-y1">${yearOpts(F.y1)}</select></div>
      </div>
      <div class="filter-row filter-row-2">
        <div class="f-item f-search"><label for="f-q">Search</label>
          <input type="search" id="f-q" placeholder="Symbol, title or mechanism…" value="${esc(F.q)}"></div>
        <div class="f-actions">
          <button class="f-more-btn" id="f-more" aria-expanded="false" aria-controls="f-adv">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M3 5h18M7 12h10M10 19h4"/></svg>
            <span>More filters</span><span class="f-more-n" id="f-more-n"></span>
            <svg class="f-more-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
              aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          <button class="icon-btn reset-btn" id="f-reset" title="Clear all filters">Reset</button>
        </div>
      </div>
      <div class="filter-row" id="f-adv" hidden>
        <div class="f-item"><label for="f-mode">Adoption</label>
          <select id="f-mode">${opt("", "All")}${opt("Recorded vote", "Recorded vote", F.mode)}${opt("Consensus", "Without a vote", F.mode)}</select></div>
        <div class="f-item"><label for="f-role">Resolution role</label>
          <select id="f-role">${opt("", "All")}${ROLES.map(x => opt(x, x, F.role)).join("")}</select></div>
        <div class="f-item"><label for="f-ca">Criminal-accountability wording</label>
          <select id="f-ca" title="Literal coding of the mandate paragraphs: 'names crimes' = the text uses the word crime(s) or criminal-justice vocabulary; 'accountability wording only' = accountability / impunity / those responsible, without naming crimes">${opt("", "All")}${CAS.map(x => opt(x, CA_SHORT[x] || x, F.ca)).join("")}${opt("(not coded)", "not coded", F.ca)}</select></div>
        <div class="f-item"><label for="f-gloc">Gender language</label>
          <select id="f-gloc">${opt("", "Anywhere / any")}${LOCS.map(l => opt(l[0], l[1], F.genderLoc)).join("")}${opt("(none)", "no gender language", F.genderLoc)}</select></div>
        <div class="f-item"><label for="f-glab">Gender label</label>
          <select id="f-glab">${opt("", "Any")}${GENDER_LABELS.map(x => opt(x, x, F.genderLabel)).join("")}</select></div>
        <div class="f-item"><label for="f-child">Children language</label>
          <select id="f-child">${opt("", "Any")}${["mandate", "other OPs", "preamble"].map(x => opt(x, "in " + x, F.children)).join("")}${opt("(none)", "none", F.children)}</select></div>
        <div class="f-item" style="flex:1 1 300px"><label>Mandate action verbs (all selected must appear)</label>
          <div class="chip-group" id="f-verbs">${VERBS.map(v =>
            `<button class="chip" data-verb="${esc(v)}" aria-pressed="${F.verbs.has(v)}">${esc(v)}</button>`).join("")}</div></div>
        <div class="f-item"><label>Legal frameworks</label>
          <div class="chip-group" id="f-fw">${FWS.map(v =>
            `<button class="chip" data-fw="${esc(v)}" aria-pressed="${F.fw.has(v)}" title="${esc(FW_TITLE[v] || "")}">${esc(v)}</button>`).join("")}</div></div>
      </div>
`;

    $("#f-q").addEventListener("input", (e) => { F.q = e.target.value.trim(); update(); });
    [["f-y0", "y0", Number], ["f-y1", "y1", Number], ["f-body", "body", String], ["f-country", "country", String],
     ["f-mode", "mode", String], ["f-role", "role", String],
     ["f-ca", "ca", String], ["f-gloc", "genderLoc", String], ["f-glab", "genderLabel", String],
     ["f-child", "children", String]].forEach(([id, key, cast]) => {
      $("#" + id).addEventListener("change", (e) => {
        F[key] = cast(e.target.value);
        if (F.y0 > F.y1) { const t = F.y0; F.y0 = F.y1; F.y1 = t; renderFilters(); }
        update();
      });
    });
    // how many of the advanced filters are actually set, shown on the button
    const advCount = () => {
      let n = 0;
      if (F.mode) n++; if (F.role) n++; if (F.ca) n++;
      if (F.genderLoc) n++; if (F.genderLabel) n++; if (F.children) n++;
      n += F.verbs.size + F.fw.size;
      return n;
    };
    paintMoreFilters = () => {
      const n = advCount(), el = $("#f-more-n");
      if (el) { el.textContent = n ? n : ""; el.hidden = !n; }
      const btn = $("#f-more");
      if (btn) btn.classList.toggle("has-filters", !!n);
    };
    paintMoreFilters();
    if (advCount()) { const adv = $("#f-adv"); adv.hidden = false; $("#f-more").setAttribute("aria-expanded", "true"); }
    $("#f-more").addEventListener("click", () => {
      const adv = $("#f-adv");
      adv.hidden = !adv.hidden;
      $("#f-more").setAttribute("aria-expanded", String(!adv.hidden));
    });
    $("#f-reset").addEventListener("click", resetFilters);
    $("#f-verbs").addEventListener("click", (e) => {
      const v = e.target.dataset && e.target.dataset.verb;
      if (!v) return;
      F.verbs.has(v) ? F.verbs.delete(v) : F.verbs.add(v);
      e.target.setAttribute("aria-pressed", String(F.verbs.has(v)));
      update();
    });
    $("#f-fw").addEventListener("click", (e) => {
      const v = e.target.dataset && e.target.dataset.fw;
      if (!v) return;
      F.fw.has(v) ? F.fw.delete(v) : F.fw.add(v);
      e.target.setAttribute("aria-pressed", String(F.fw.has(v)));
      update();
    });
    // keep the advanced row open if any advanced filter is active
    if (F.country || F.mode || F.role || F.ca || F.genderLoc || F.genderLabel || F.children || F.verbs.size || F.fw.size) {
      $("#f-adv").hidden = false;
      $("#f-more").setAttribute("aria-expanded", "true");
      $("#f-more").textContent = "More filters ▴";
    }
  }

  function resetFilters() {
    F.q = ""; F.y0 = YEARS.min; F.y1 = YEARS.max; F.body = F.country = F.mode = "";
    F.role = F.ca = F.genderLoc = F.genderLabel = F.children = "";
    F.verbs.clear(); F.fw.clear();
    renderFilters(); update();
  }
  function filtersActive() {
    return !!(F.q || F.y0 !== YEARS.min || F.y1 !== YEARS.max || F.body || F.country || F.mode ||
      F.role || F.ca || F.genderLoc || F.genderLabel || F.children || F.verbs.size || F.fw.size);
  }
  // prominent in-view reminder that a filter is narrowing the data
  function filterChip() {
    if (!filtersActive()) return "";
    return `<button class="filter-chip" data-clear-filters
      title="${esc(filterSummary())}">⚠ filtered: ${esc(filterSummary().replace(/^Filters: /, ""))} — clear ✕</button>`;
  }
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-clear-filters]")) resetFilters();
  });

  /* ---------- CSV export ---------- */
  function downloadCSV(name, headers, rows, scopeNote) {
    const q = (v) => {
      v = String(v == null ? "" : v);
      return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    };
    const lines = [
      "# " + document.title,
      "# " + (scopeNote || "Current filter selection"),
      "# Data: UN Investigative Mandates dataset (Helena Rodríguez-Bronchú Carceller); resolutions cited by UN symbol.",
      "# Retrieved: " + new Date().toISOString().slice(0, 10),
      headers.map(q).join(","),
      ...rows.map(r => r.map(q).join(",")),
    ];
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name + ".csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  /* ---------- shared bits ---------- */
  function tallyPills(r) {
    if (r.adoption_mode !== "Recorded vote") return `<span class="pill mode-consensus">without a vote</span>`;
    return `<span class="pill yes" title="In favour">${r.votes_yes ?? "?"}</span>
      <span class="pill no" title="Against">${r.votes_no ?? "?"}</span>
      <span class="pill abstain" title="Abstentions">${r.votes_abstain ?? "?"}</span>`;
  }
  const ROLE_DEF = {
    founding: "Founding: creates a new investigative mechanism",
    renewal: "Renewal: extends an existing mechanism's mandate in time",
    expansion: "Expansion: widens the investigation itself — e.g. orders an additional special inquiry into specific new events",
    tasking: "Tasking: gives the mechanism extra tasks (more reports, briefings, operational steps) without widening what it investigates",
  };
  function roleBadge(r) {
    const role = r.resolution_role;
    if (!role) return `<span class="badge" title="Resolution role">role not coded</span>`;
    return `<span class="badge on" title="${esc(ROLE_DEF[role] || "Resolution role")}" style="background:var(${ROLE_COLOR[role] || "--muted"})">${esc(role)}</span>`;
  }
  const CA_TITLE = {
    "names crimes or criminal proceedings": "The mandate paragraphs use the word crime(s) or criminal-justice vocabulary (crimes against humanity, war crimes, genocide, criminal or command responsibility, criminal prosecutions or proceedings, International Criminal Court, legal proceedings). No mandate paragraph in the dataset names 'international criminal law' as such.",
    "accountability or perpetrators wording only": "The mandate paragraphs speak of accountability, impunity, those responsible or perpetrators, but do not name crimes or criminal proceedings.",
    "none": "No accountability or criminal-law wording in the mandate paragraphs.",
    "no mandate text": "A renewal that only extends the mandate as set out in an earlier resolution; no task language to code.",
  };
  function caBadge(r) {
    const ca = r.criminal_accountability;
    if (!ca) return `<span class="badge" title="Criminal-accountability wording">wording not coded</span>`;
    if (ca === "none") return `<span class="badge" title="${esc(CA_TITLE[ca])}">no accountability wording</span>`;
    if (ca === "no mandate text") return `<span class="badge" title="${esc(CA_TITLE[ca])}">no mandate text</span>`;
    const c = ca === "names crimes or criminal proceedings" ? "--seq-550" : "--seq-400";
    return `<span class="badge on" title="${esc(CA_TITLE[ca] || "Criminal-accountability wording")}" style="background:var(${c})">${esc(CA_SHORT[ca] || ca)}</span>`;
  }
  // What the text says about gender and about children, and — for gender — whether it
  // says it in the mandate paragraph, which is the part the body is told to carry out.
  function genderBadges(r) {
    const g = r.gender_language || {};
    const parts = [];
    if ((g.mandate || []).length) {
      parts.push(`<span class="badge on" style="background:var(--c5)" title="Gender language in the mandate paragraph: ${esc((g.mandate || []).join(", "))}">gender · in mandate</span>`);
    } else if (genderAll(r).length) {
      parts.push(`<span class="badge" title="Gender language, but not in the mandate paragraph: ${esc(genderAll(r).join(", "))}">gender · elsewhere</span>`);
    }
    if ((r.children_language || []).length) {
      parts.push(`<span class="badge" title="Children language: ${esc((r.children_language || []).join(", "))}">children</span>`);
    }
    return parts.length ? parts.join(" ") : `<span style="color:var(--muted)">—</span>`;
  }
  const resLink = (r, label) =>
    `<a class="reslink sym" data-sym="${esc(r.symbol)}">${esc(label || r.symbol)}</a>`;

  /* ---------- view: resolutions ---------- */
  let sortKey = "date_adopted", sortDir = -1;

  function viewResolutions(R) {
    const host = $("#res-content");
    const recorded = R.filter(r => r.adoption_mode === "Recorded vote");
    const consensus = R.length - recorded.length;
    const bodiesSet = new Set(R.flatMap(r => r.bodies || []));
    host.innerHTML = `
      ${filterChip() ? `<div style="margin:0 0 10px">${filterChip()}</div>` : ""}
      <div class="tiles">
        <div class="tile"><div class="t-label">Resolutions in selection</div><div class="t-value">${R.length}</div></div>
        <div class="tile"><div class="t-label">Adopted by recorded vote</div><div class="t-value">${recorded.length}</div></div>
        <div class="tile"><div class="t-label">Adopted without a vote</div><div class="t-value">${consensus}</div></div>
        <div class="tile clickable" id="tile-mechs" title="Open the Mechanisms tab"><div class="t-label">Mechanisms concerned</div><div class="t-value">${bodiesSet.size}</div><div class="t-sub">see the Mechanisms tab</div></div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Resolutions</h2>
          <span class="spacer"></span><details class="menu"><summary class="icon-btn" title="More actions" aria-label="More actions">⋯</summary><div class="menu-list"><button class="menu-item" id="csv-res">Download CSV</button></div></details></div>
        <div class="tblwrap tall" id="res-table"></div>
        <div class="panel-note">Click a row for details, the vote breakdown and links to the UN documents.${refFiltered().length ? ` Rows tagged <span class="badge">reference only</span> are listed for context and excluded from every count above.` : ""}</div>
      </div>`;

    $("#tile-mechs").addEventListener("click", () => setTab("mechs"));

    renderResTable(R, refFiltered());
    $("#csv-res").addEventListener("click", () => {
      downloadCSV("resolutions",
        ["symbol", "date_adopted", "title", "session", "role", "mechanism_type", "bodies", "adoption_mode", "tally", "criminal_accountability", "gender_mandate", "gender_other_ops", "gender_preamble", "children_language", "action_verbs", "legal_frameworks"],
        sortRows(R).map(r => [r.symbol, r.date_adopted, r.title, r.session, r.resolution_role, r.mechanism_type,
          (r.bodies || []).join("; "), r.adoption_mode, r.tally, r.criminal_accountability,
          ((r.gender_language || {}).mandate || []).join("; "), ((r.gender_language || {}).other_ops || []).join("; "),
          ((r.gender_language || {}).preamble || []).join("; "), (r.children_language || []).join("; "),
          (r.action_verbs || []).join("; "), (r.legal_frameworks || []).join("; ")]),
        filterSummary());
    });
  }

  function sortRows(R) {
    const dir = sortDir;
    return R.slice().sort((a, b) => {
      let x = a[sortKey], y = b[sortKey];
      if (x == null) return 1;
      if (y == null) return -1;
      if (typeof x === "string") return x.localeCompare(y) * dir;
      return (x - y) * dir;
    });
  }
  function renderResTable(R, REFR) {
    const cols = [
      ["symbol", "Symbol"], ["date_adopted", "Date"], ["title", "Title"],
      ["resolution_role", "Role"],
      ["adoption_mode", "Adoption"], [null, "Gender · children"],
    ];
    const rows = sortRows(R.concat(REFR || []));
    $("#res-table").innerHTML = `<table class="data"><thead><tr>${cols.map(([k, l]) =>
      `<th ${k ? `data-sort="${k}"` : 'class="no-sort"'}>${l}${k === sortKey ? ` <span class="dir">${sortDir > 0 ? "↑" : "↓"}</span>` : ""}</th>`).join("")}</tr></thead>
      <tbody>${rows.map(r => `<tr data-sym="${esc(r.symbol)}"${r.reference_only ? ' class="ref-row" style="color:var(--muted)"' : ""}>
        <td>${resLink(r)}${r.reference_only ? ` <span class="badge" title="Shown for reference only; not counted in any figure">reference only</span>` : ""}</td>
        <td class="num" style="white-space:nowrap">${fmtDate(r.date_adopted)}</td>
        <td>${esc(r.title)}<div style="font-size:12px;color:var(--muted)">${esc((r.bodies || []).join(" · "))}</div></td>
        <td>${roleBadge(r)}</td>
        <td style="white-space:nowrap">${tallyPills(r)}</td>
        <td>${genderBadges(r)}</td>
      </tr>`).join("")}</tbody></table>`;
    $("#res-table thead").addEventListener("click", (e) => {
      const k = e.target.closest("th") && e.target.closest("th").dataset.sort;
      if (!k) return;
      if (sortKey === k) sortDir *= -1; else { sortKey = k; sortDir = k === "date_adopted" ? -1 : 1; }
      renderResTable(filtered(), refFiltered());
    });
    $("#res-table tbody").addEventListener("click", (e) => {
      const tr = e.target.closest("tr");
      if (tr) openResolution(tr.dataset.sym);
    });
  }

  /* ---------- view: matrix ---------- */
  let matrixRows = "groups";      // groups | states — groups is the readable default
  let matrixCols = "mechanism";   // mechanism (default) | date
  function voteTotals(row, idxs) {
    const t = { Y: 0, N: 0, A: 0, X: 0 };
    for (const si of idxs) { const c = row[si]; if (t[c] !== undefined) t[c]++; }
    return t;
  }
  const totPills = (t) => `<span class="tots">
    <b class="ty" title="Yes votes">${t.Y}</b><b class="tn" title="No votes">${t.N}</b><b class="ta" title="Abstentions">${t.A}</b></span>`;

  // Mechanisms that actually have a recorded vote, for the matrix's own selector.
  let MATRIX_MECHS_CACHE = null;
  const MATRIX_MECHS = () => {
    if (!MATRIX_MECHS_CACHE) {
      MATRIX_MECHS_CACHE = [...new Set(RES
        .filter(r => r.adoption_mode === "Recorded vote" && votesOf(r.symbol))
        .flatMap(r => r.bodies || []))].sort();
    }
    return MATRIX_MECHS_CACHE;
  };

  function viewMatrix(R) {
    const host = $("#votes-content");
    let recorded = R.filter(r => r.adoption_mode === "Recorded vote" && votesOf(r.symbol));
    if (!recorded.length) {
      host.innerHTML = `<div class="panel"><div class="panel-body">No recorded votes match the current filters
        (${R.length} resolutions selected, all adopted without a vote or without a published roll-call).</div></div>`;
      return;
    }
    // column order (+ optional mechanism blocks). Mechanism blocks follow the
    // site-wide order: still-active mandates first, then newest start date;
    // within a block resolutions stay oldest-to-newest so evolution reads left to right.
    let colGroups = null;
    if (matrixCols === "mechanism") {
      const firstDate = {};
      recorded.forEach(r => {
        const b = (r.bodies || [])[0] || "—";
        if (!(b in firstDate) || (r.date_adopted || "") < firstDate[b]) firstDate[b] = r.date_adopted || "";
      });
      recorded = recorded.slice().sort((a, b) => {
        const ba = (a.bodies || [])[0] || "—", bb = (b.bodies || [])[0] || "—";
        if (ba !== bb) {
          const A = bodyByName.get(ba), B = bodyByName.get(bb);
          if (A && B) {
            const act = (bodyIsRunning(A) ? 0 : 1) - (bodyIsRunning(B) ? 0 : 1);
            if (act) return act;
            const sd = (A.start_date || "").localeCompare(B.start_date || "");
            if (sd) return sd;
          }
          return (firstDate[ba] || "").localeCompare(firstDate[bb] || "") || ba.localeCompare(bb);
        }
        return (a.date_adopted || "").localeCompare(b.date_adopted || "");
      });
      colGroups = [];
      recorded.forEach(r => {
        const b = (r.bodies || [])[0] || "—";
        if (colGroups.length && colGroups[colGroups.length - 1].label === b) colGroups[colGroups.length - 1].count++;
        else colGroups.push({ label: b, count: 1 });
      });
    }
    // states that cast at least one vote in the selection, grouped
    const active = new Map();
    recorded.forEach(r => {
      const row = votesOf(r.symbol);
      for (let i = 0; i < row.length; i++) if (row[i] !== ".") active.set(i, true);
    });
    const groups = new Map();
    GROUP_META.forEach(g => groups.set(g.short, { meta: g, idxs: [] }));
    [...active.keys()].sort((a, b) => STATES[a].state.localeCompare(STATES[b].state)).forEach(i => {
      const g = groupOf(STATES[i].regional_group);
      const k = g ? g.short : "Other";
      if (!groups.has(k)) groups.set(k, { meta: g, idxs: [] });
      groups.get(k).idxs.push(i);
    });
    for (const [k, g] of groups) if (!g.idxs.length) groups.delete(k);
    const colLabel = (r) => {
      const s = r.symbol.replace("A/HRC/RES/", "").replace("A/HRC/DEC/", "DEC ").replace("A/HRC/", "");
      // in mechanism order the year is not readable from position, so carry it on the label
      return matrixCols === "mechanism" ? `${s} · ${r.year}` : s;
    };
    // year band for date order (years are contiguous when sorted by date)
    let yearGroups = null;
    if (matrixCols === "date") {
      yearGroups = [];
      recorded.forEach(r => {
        if (yearGroups.length && yearGroups[yearGroups.length - 1].year === r.year) yearGroups[yearGroups.length - 1].count++;
        else yearGroups.push({ year: r.year, count: 1 });
      });
    }

    host.innerHTML = `
      <div class="panel">
        <div class="panel-head"><h2>Votes matrix</h2>
          <span class="count">${recorded.length} recorded votes · ${active.size} states</span>
          ${filterChip()}
          <span class="spacer"></span>
          <span class="ctl-label">Mechanism</span>
          <select id="mx-mech" class="mx-mech" title="Narrow the matrix to one mechanism">
            <option value="">All mechanisms</option>
            ${MATRIX_MECHS().map(m => `<option value="${esc(m)}"${F.body === m ? " selected" : ""}>${esc(m)}</option>`).join("")}
          </select>
          <span class="ctl-label">${matrixRows === "groups" ? "Order" : "Columns"}</span>
          <div class="seg" id="mx-cols">
            <button data-v="mechanism" aria-pressed="${matrixCols === "mechanism"}">by mechanism</button>
            <button data-v="date" aria-pressed="${matrixCols === "date"}">by date</button>
          </div>
          <span class="legend">
            <span class="lg"><span class="sw" style="background:var(--yes)"></span>Yes</span>
            <span class="lg"><span class="sw" style="background:var(--no)"></span>No</span>
            <span class="lg"><span class="sw" style="background:var(--abstain)"></span>Abstain</span>
            <span class="lg"><span class="sw" style="background:var(--absent)"></span>Absent</span>
          </span>
          <details class="menu"><summary class="icon-btn" title="More actions" aria-label="More actions">⋯</summary><div class="menu-list"><button class="menu-item" id="csv-matrix">Download CSV</button></div></details>
        </div>
        <div class="matrix-wrap" id="matrix-host"></div>
        <div class="panel-note">${matrixRows === "groups"
          ? `<b>Rows:</b> one per recorded vote, ${matrixCols === "date" ? "in date order" : "grouped by mechanism"}.
             <b>Columns:</b> the five regional groups; each bar splits that group's votes on that resolution
             — Yes, abstentions, No, absences, left to right. The figures under each group name are its
             Yes · No · Abstain totals across the votes shown.`
          : `<b>Rows:</b> Council members; a faint cell means the state was not a member for that vote. The three
             figures after each name are its Yes · No · Abstain totals.
             <b>Columns:</b> resolutions ${matrixCols === "date" ? "by date" : "by mechanism"}.`}
        Hover for the detail, click for the resolution.</div>
      </div>`;

    // Groups view: the table is turned on its side. Five group columns fit any screen,
    // and the long axis — the resolutions — runs down the page, where scrolling is free.
    if (matrixRows === "groups") {
      const gList = [...groups.entries()];
      const gTot = new Map(gList.map(([k]) => [k, { Y: 0, N: 0, A: 0, X: 0 }]));
      recorded.forEach(r => {
        const row = votesOf(r.symbol);
        gList.forEach(([k, g]) => {
          const t = voteTotals(row, g.idxs);
          const a = gTot.get(k);
          a.Y += t.Y; a.N += t.N; a.A += t.A; a.X += t.X;
        });
      });
      let t_html = `<table class="matrix-t"><thead><tr>
        <th class="res">Resolution</th>
        ${gList.map(([k, g]) => `<th class="gcol"><span class="dotkey" style="background:var(${g.meta.color})"></span>${esc(k)}
          <div class="gtot" title="Yes · No · Abstain across the votes shown">
            <b class="ty">${gTot.get(k).Y}</b> · <b class="tn">${gTot.get(k).N}</b> · <b class="ta">${gTot.get(k).A}</b>
          </div></th>`).join("")}
        <th class="tcol" title="The official tally: Yes · No · Abstaining">Tally</th></tr></thead><tbody>`;
      let band = null;
      recorded.forEach(r => {
        const key = matrixCols === "mechanism" ? ((r.bodies || [])[0] || "—") : String(r.year);
        if (key !== band) {
          band = key;
          t_html += matrixCols === "mechanism"
            ? `<tr class="band"><th class="mech-group" colspan="${gList.length + 2}" data-body="${esc(key)}"
                 title="${esc(key)} — click for the mechanism profile"><span>${esc(key)}</span></th></tr>`
            : `<tr class="band"><th class="year-band" colspan="${gList.length + 2}" data-year="${esc(key)}"
                 title="${esc(key)} — click to focus this year">${esc(key)}</th></tr>`;
        }
        const row = votesOf(r.symbol);
        const cells = gList.map(([k, g]) => {
          const t = voteTotals(row, g.idxs);
          const sum = t.Y + t.N + t.A + t.X;
          if (!sum) return `<td class="cell gcell" data-sym="${esc(r.symbol)}" data-group="${esc(k)}"></td>`;
          const seg = (n, cls) => n ? `<b class="${cls}" style="width:${(100 * n / sum).toFixed(2)}%"></b>` : "";
          return `<td class="cell gcell" data-sym="${esc(r.symbol)}" data-group="${esc(k)}"
            data-t="${t.Y}|${t.N}|${t.A}|${t.X}"><div class="hbar">${seg(t.Y, "gy")}${seg(t.A, "ga")}${seg(t.N, "gn")}${seg(t.X, "gx")}</div></td>`;
        }).join("");
        t_html += `<tr data-sym="${esc(r.symbol)}"><th class="res reslink" data-sym="${esc(r.symbol)}">
          <b>${esc(r.symbol.replace("A/HRC/RES/", "").replace("A/HRC/DEC/", "DEC ").replace("A/HRC/", ""))}</b><span class="rdate">${esc(fmtDate(r.date_adopted))}</span></th>
          ${cells}<td class="tcol tt">${r.votes_yes ?? ""} · ${r.votes_no ?? ""} · ${r.votes_abstain ?? ""}</td></tr>`;
      });
      t_html += `</tbody></table>`;
      $("#matrix-host").innerHTML = t_html;
      wireMatrix($("#matrix-host"), recorded, groups);
      return;
    }

    const nCols = recorded.length;
    let html = `<table class="matrix"><thead>`;
    if (colGroups) {
      html += `<tr><th class="state state-corner mech-corner"></th>`;
      colGroups.forEach(g => {
        html += `<th class="mech-group" colspan="${g.count}" data-body="${esc(g.label)}" title="${esc(g.label)} — click for the mechanism profile"><span>${esc(g.label)}</span></th>`;
      });
      html += `</tr>`;
    }
    if (yearGroups) {
      html += `<tr><th class="state state-corner mech-corner"></th>`;
      yearGroups.forEach(g => {
        html += `<th class="mech-group year-band" colspan="${g.count}" data-year="${g.year}"
          title="${g.year} — ${g.count} recorded vote${g.count > 1 ? "s" : ""}; click to focus this year">${g.year}</th>`;
      });
      html += `</tr>`;
    }
    // first column of each mechanism/year block gets a separator line
    const blockStarts = new Set();
    const srcGroups = colGroups || yearGroups;
    if (srcGroups) {
      let acc = 0;
      srcGroups.forEach(g => { blockStarts.add(acc); acc += g.count; });
    }
    const blk = (ci) => blockStarts.has(ci) ? " blk" : "";
    html += `<tr class="symrow${srcGroups ? " under-mech" : ""}"><th class="state state-corner"></th>`;
    recorded.forEach((r, ci) => { html += `<th class="col${blk(ci)}" data-sym="${esc(r.symbol)}">${esc(colLabel(r))}</th>`; });
    html += `</tr></thead><tbody>`;
    // official tallies per resolution (yes / no / abstain), visible under the symbols
    const tallyRow = (label, cls, val) => `<tr class="tallyrow"><th class="state">${label}</th>` +
      recorded.map((r, ci) => `<td class="tt ${cls}${blk(ci)}">${val(r) ?? ""}</td>`).join("") + `</tr>`;
    html += tallyRow("In favour", "ty", r => r.votes_yes) +
      tallyRow("Against", "tn", r => r.votes_no) +
      tallyRow("Abstaining", "ta", r => r.votes_abstain);

    if (matrixRows === "states") {
      for (const [gname, g] of groups) {
        html += `<tr class="group-row"><th colspan="${nCols + 1}">
          <span class="dotkey" style="background:var(${g.meta.color})"></span>${esc(gname)}</th></tr>`;
        for (const si of g.idxs) {
          const trow = { Y: 0, N: 0, A: 0, X: 0 };
          let cells = "";
          recorded.forEach((r, ci) => {
            const code = votesOf(r.symbol)[si];
            if (trow[code] !== undefined) trow[code]++;
            const cls = code === "." ? "" : " v" + code;
            cells += `<td class="cell${cls}${blk(ci)}" data-sym="${esc(r.symbol)}" data-state="${esc(STATES[si].state)}" data-code="${code}"><i></i></td>`;
          });
          html += `<tr><th class="state statelink" data-state="${esc(STATES[si].state)}">${esc(STATES[si].state)} ${totPills(trow)}</th>${cells}</tr>`;
        }
      }
    }
    html += `</tbody></table>`;
    const mh = $("#matrix-host");
    mh.innerHTML = html;
    wireMatrix(mh, recorded, groups);
  }

  // Tooltip, clicks and CSV for either matrix layout.
  function wireMatrix(mh, recorded, groups) {
    $("#mx-cols").addEventListener("click", (e) => {
      const v = e.target.dataset && e.target.dataset.v;
      if (v) { matrixCols = v; viewMatrix(filtered()); }
    });
    const mxm = $("#mx-mech");
    if (mxm) mxm.addEventListener("change", (e) => { F.body = e.target.value; renderFilters(); update(); });

    const CODE_LABEL = { Y: "Yes", N: "No", A: "Abstain", X: "Absent / did not vote", ".": "Not a Council member" };
    mh.addEventListener("pointermove", (e) => {
      const td = e.target.closest("td.cell");
      if (!td) { window.HRCTooltip.hide(); return; }
      const r = bySym.get(td.dataset.sym);
      if (td.classList.contains("gcell")) {
        const t = (td.dataset.t || "0|0|0|0").split("|").map(Number);
        window.HRCTooltip.show(e, `${td.dataset.group} — ${r.symbol}`, [
          { label: "Yes", color: cssVar("--yes"), value: t[0] },
          { label: "No", color: cssVar("--no"), value: t[1] },
          { label: "Abstain", color: cssVar("--abstain"), value: t[2] },
          { label: "Absent", color: cssVar("--absent"), value: t[3] },
        ]);
        return;
      }
      window.HRCTooltip.show(e, td.dataset.state, [
        { label: r.symbol, value: CODE_LABEL[td.dataset.code] || "—" },
        { label: (r.title || "").slice(0, 60) + ((r.title || "").length > 60 ? "…" : ""), value: "" },
      ]);
    });
    mh.addEventListener("pointerleave", () => window.HRCTooltip.hide());
    mh.addEventListener("click", (e) => {
      const yb = e.target.closest("th.year-band");
      if (yb) { F.y0 = F.y1 = +yb.dataset.year; renderFilters(); update(); return; }
      const mg = e.target.closest("th.mech-group");
      if (mg) return openMechanism(mg.dataset.body);
      const col = e.target.closest("th.col");
      if (col) return openResolution(col.dataset.sym);
      const cell = e.target.closest("td.cell");
      if (cell) return openResolution(cell.dataset.sym);
      const st = e.target.closest("th.statelink");
      if (st) { currentState = st.dataset.state; setSub("states"); }
    });
    $("#csv-matrix").addEventListener("click", () => {
      downloadCSV("votes_matrix",
        ["state", "regional_group", ...recorded.map(r => r.symbol)],
        [...groups.values()].flatMap(g => g.idxs.map(si =>
          [STATES[si].state, STATES[si].regional_group,
            ...recorded.map(r => ({ Y: "Yes", N: "No", A: "Abstain", X: "Absent", ".": "" })[votesOf(r.symbol)[si]])])),
        filterSummary());
    });
  }

  /* ---------- view: state profiles ---------- */
  let currentState = "";
  function viewStates(R) {
    const host = $("#votes-content");
    const recorded = R.filter(r => r.adoption_mode === "Recorded vote" && votesOf(r.symbol));
    // only states that matter for this selection: Council members at the time of at
    // least one recorded vote (any position, including absent), plus any sponsor
    const relevant = new Set();
    recorded.forEach(r => {
      const row = votesOf(r.symbol);
      for (let i = 0; i < row.length; i++) if (row[i] && row[i] !== ".") relevant.add(i);
    });
    R.forEach(r => { const sp0 = sponsorsOf(r.symbol); if (sp0) { sp0.m.forEach(i => relevant.add(i)); sp0.c.forEach(i => relevant.add(i)); } });
    const narrowed = filtersActive() && relevant.size && relevant.size < STATES.length;
    const stateList = narrowed
      ? [...relevant].map(i => STATES[i]).sort((a, b) => a.state.localeCompare(b.state))
      : STATES;
    if (!currentState || (narrowed && !stateList.some(s => s.state === currentState)))
      currentState = stateList.some(s => s.state === "Argentina") ? "Argentina" : stateList[0].state;
    const si = stateIdxByName.get(currentState);
    const myVotes = [];
    recorded.forEach(r => {
      const c = votesOf(r.symbol)[si];
      if (c && c !== ".") myVotes.push({ r, c });
    });
    const count = (code) => myVotes.filter(v => v.c === code).length;
    const sp = [];
    for (const sym in D.sponsorships) {
      const r = bySym.get(sym);
      if (!r || !matches(r)) continue;
      const s = D.sponsorships[sym];
      if (s.m.includes(si)) sp.push({ r, role: "Main sponsor / core group" });
      else if (s.c.includes(si)) sp.push({ r, role: "Co-sponsor" });
    }
    sp.sort((a, b) => (b.r.date_adopted || "").localeCompare(a.r.date_adopted || ""));

    // pairwise agreement (min 8 shared votes)
    const partners = [];
    if (myVotes.length >= 8) {
      STATES.forEach((s2, j) => {
        if (j === si) return;
        let shared = 0, agree = 0;
        recorded.forEach(r => {
          const row = votesOf(r.symbol);
          const a = row[si], b = row[j];
          if ("YNA".includes(a) && "YNA".includes(b)) { shared++; if (a === b) agree++; }
        });
        if (shared >= 8) partners.push({ state: s2.state, group: s2.regional_group, pct: agree / shared, shared });
      });
      partners.sort((a, b) => b.pct - a.pct);
    }
    const g = groupOf(STATES[si].regional_group);

    host.innerHTML = `
      <div class="panel"><div class="panel-body state-picker">
        <label for="state-select">State profile — choose a state</label>
        <select id="state-select">${stateList.map(s =>
          `<option${s.state === currentState ? " selected" : ""}>${esc(s.state)}</option>`).join("")}</select>
        <span class="count" style="color:var(--muted)"><span class="dotkey" style="background:var(${g.color})"></span>${esc(g.short)}</span>
        ${filterChip()}
      </div>
      ${narrowed ? `<div class="panel-note">Listing the ${stateList.length} states that were Council members when at least one of the
        ${recorded.length} selected recorded vote${recorded.length === 1 ? "" : "s"} took place (or sponsored a selected text). States that
        were not members at the time have no position to show and are left out; clear the filter to see all ${STATES.length}.</div>` : ""}
      </div>
      <div class="tiles">
        <div class="tile" title="A state only has a position on a vote taken while it sat on the Council. The Yes, No and Abstain tiles beside this one add up to this figure, minus any absences."><div class="t-label">On the Council for</div><div class="t-value">${myVotes.length}</div><div class="t-sub">of the ${recorded.length} recorded votes shown${recorded.length - myVotes.length ? ` · not a member for the other ${recorded.length - myVotes.length}` : ""}</div></div>
        <div class="tile"><div class="t-label">Yes</div><div class="t-value" style="color:var(--yes)">${count("Y")}</div></div>
        <div class="tile"><div class="t-label">No</div><div class="t-value" style="color:var(--no)">${count("N")}</div></div>
        <div class="tile"><div class="t-label">Abstain</div><div class="t-value">${count("A")}</div><div class="t-sub">${count("X")} absences</div></div>
        <div class="tile"><div class="t-label">Sponsorships</div><div class="t-value">${sp.length}</div><div class="t-sub">${sp.filter(x => x.role.startsWith("Main")).length} as main sponsor</div></div>
      </div>
      ${partners.length ? `<div class="panel"><div class="panel-head"><h2>Voting alignment</h2>
        <span class="count">% of shared votes with the same position — each bar says how many votes the pair
        actually shared (min. 8; a high % over few shared votes means little)</span></div>
        <div class="panel-body" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px">
          <div><h4 style="margin:0 0 6px;font-size:13px">Most aligned</h4><div id="partners-top"></div></div>
          <div><h4 style="margin:0 0 6px;font-size:13px">Least aligned</h4><div id="partners-bottom"></div></div>
        </div></div>` : ""}
      <div class="panel">
        <div class="panel-head"><h2>Voting record</h2><span class="count">${myVotes.length}</span>
        <span class="spacer"></span><details class="menu"><summary class="icon-btn" title="More actions" aria-label="More actions">⋯</summary><div class="menu-list"><button class="menu-item" id="csv-state">Download CSV</button></div></details></div>
        <div class="tblwrap tall"><table class="data"><thead><tr><th class="no-sort">Resolution</th>
          <th class="no-sort">Date</th><th class="no-sort">Title</th><th class="no-sort">Position</th></tr></thead>
        <tbody>${myVotes.slice().reverse().map(({ r, c }) => `<tr data-sym="${esc(r.symbol)}">
          <td>${resLink(r)}</td><td style="white-space:nowrap">${fmtDate(r.date_adopted)}</td>
          <td>${esc(r.title)}</td>
          <td><span class="pill ${({ Y: "yes", N: "no", A: "abstain", X: "absent" })[c]}">${({ Y: "Yes", N: "No", A: "Abstain", X: "Absent" })[c]}</span></td>
        </tr>`).join("")}</tbody></table></div>
      </div>
      ${sp.length ? `<div class="panel">
        <div class="panel-head"><h2>Sponsorships</h2><span class="count">${sp.length}</span></div>
        <div class="tblwrap tall"><table class="data"><thead><tr><th class="no-sort">Resolution</th>
          <th class="no-sort">Date</th><th class="no-sort">Title</th><th class="no-sort">Role</th></tr></thead>
        <tbody>${sp.map(({ r, role }) => `<tr data-sym="${esc(r.symbol)}">
          <td>${resLink(r)}</td><td style="white-space:nowrap">${fmtDate(r.date_adopted)}</td>
          <td>${esc(r.title)}</td><td>${esc(role)}</td></tr>`).join("")}</tbody></table></div>
      </div>` : ""}`;

    $("#state-select").addEventListener("change", (e) => { currentState = e.target.value; viewStates(filtered()); });
    host.addEventListener("click", (e) => {
      const tr = e.target.closest("tr[data-sym]");
      if (tr) openResolution(tr.dataset.sym);
    });
    if (partners.length) {
      const mk = (list) => list.map(p => ({
        label: p.state,
        parts: [{ key: "agree", label: "agreement", color: cssVar(groupOf(p.group).color), value: Math.round(p.pct * 100) }],
        valueText: `${Math.round(p.pct * 100)}% of ${p.shared} shared votes`,
        onClick: () => { currentState = p.state; viewStates(filtered()); },
      }));
      window.HRCCharts.hBars($("#partners-top"), { rows: mk(partners.slice(0, 10)), max: 100 });
      window.HRCCharts.hBars($("#partners-bottom"), { rows: mk(partners.slice(-10).reverse()), max: 100 });
    }
    $("#csv-state") && $("#csv-state").addEventListener("click", () => {
      downloadCSV("votes_" + currentState.replace(/\W+/g, "_"),
        ["resolution", "date", "title", "position"],
        myVotes.map(({ r, c }) => [r.symbol, r.date_adopted, r.title, ({ Y: "Yes", N: "No", A: "Abstain", X: "Absent" })[c]]),
        currentState + " — " + filterSummary());
    });
  }

  /* ---------- view: sponsorship ---------- */
  function viewSponsors(R) {
    const host = $("#votes-content");
    const inSel = R.filter(r => sponsorsOf(r.symbol));
    const tallies = new Map(); // stateIdx -> {m, c}
    inSel.forEach(r => {
      const s = sponsorsOf(r.symbol);
      s.m.forEach(i => { const t = tallies.get(i) || { m: 0, c: 0 }; t.m++; tallies.set(i, t); });
      s.c.forEach(i => { const t = tallies.get(i) || { m: 0, c: 0 }; t.c++; tallies.set(i, t); });
    });
    const board = [...tallies.entries()].map(([i, t]) => ({ i, ...t, total: t.m + t.c }))
      .sort((a, b) => b.total - a.total || b.m - a.m);
    // per-mechanism sponsorship: which states main-sponsor each mechanism's resolutions
    const mechSp = new Map(); // body -> {resCount, lastDate, mains: Map(stateIdx -> count), coCount:Set}
    inSel.forEach(r => {
      const s = sponsorsOf(r.symbol);
      (r.bodies || []).forEach(bn => {
        if (!mechSp.has(bn)) mechSp.set(bn, { resCount: 0, lastDate: "", mains: new Map(), cos: new Set(), coTotal: 0 });
        const m = mechSp.get(bn);
        m.resCount++;
        if ((r.date_adopted || "") > m.lastDate) m.lastDate = r.date_adopted || "";
        s.m.forEach(i => m.mains.set(i, (m.mains.get(i) || 0) + 1));
        s.c.forEach(i => { m.cos.add(i); m.coTotal++; });
      });
    });
    const mechRows2 = [...mechSp.entries()].sort((a, b) => b[1].lastDate.localeCompare(a[1].lastDate));

    host.innerHTML = `
      <div class="panel">
        <div class="panel-head"><h2>Who sponsors these resolutions?</h2>
          <span class="count">sponsorship recorded for ${inSel.length} of ${R.length} selected resolutions</span>
          ${filterChip()}
          <span class="spacer"></span><details class="menu"><summary class="icon-btn" title="More actions" aria-label="More actions">⋯</summary><div class="menu-list"><button class="menu-item" id="csv-sp">Download CSV</button></div></details></div>
        <div class="panel-body">
          <div class="legend" style="padding-bottom:8px">
            <span class="lg"><span class="sw" style="background:var(--c1)"></span>Main sponsor / core group</span>
            <span class="lg"><span class="sw" style="background:var(--seq-250)"></span>Co-sponsor</span>
          </div>
          <div id="sp-board"></div>
        </div>
        <div class="panel-note">Top 30 states by number of sponsored resolutions in the current selection.
        Click a state for its profile. Sponsorship lists come from the L-documents and their addenda;
        for a minority of resolutions no sponsor list has been recorded yet.</div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Sponsorship by mechanism</h2>
          <span class="count">who leads on each mechanism's resolutions — most recent first</span></div>
        <div class="tblwrap tall"><table class="data"><thead><tr>
          <th class="no-sort">Mechanism</th><th class="no-sort num">Resolutions with sponsors</th>
          <th class="no-sort">Main sponsors / core group (× resolutions led)</th>
          <th class="no-sort num" title="How many different states co-sponsored at least one of this mechanism's resolutions in the selection. A state that co-sponsors every renewal is counted once.">Different co-sponsoring states</th>
          <th class="no-sort num" title="Average number of co-sponsors per resolution (co-sponsorships divided by resolutions with a sponsor list)">Co-sponsors per resolution</th>
        </tr></thead><tbody>
        ${mechRows2.map(([bn, m]) => `<tr>
          <td><a class="mechlink" data-body="${esc(bn)}"><b>${esc(bn)}</b></a></td>
          <td class="num">${m.resCount}</td>
          <td>${[...m.mains.entries()].sort((a, b2) => b2[1] - a[1]).map(([i, n]) =>
            `<span class="badge">${esc(STATES[i].state)}${m.resCount > 1 ? ` ×${n}` : ""}</span>`).join(" ") || "—"}</td>
          <td class="num">${m.cos.size}</td>
          <td class="num">${m.resCount ? Math.round(m.coTotal / m.resCount) : "—"}</td>
        </tr>`).join("")}
        </tbody></table></div>
        <div class="panel-note">"×n" = the state appears as main sponsor on n of the mechanism's resolutions in the
        selection. <b>Different co-sponsoring states</b> counts each state once, however many of the mechanism's
        resolutions it co-sponsored (so 42 means 42 different countries signed on to at least one of them);
        <b>co-sponsors per resolution</b> is the average size of the co-sponsor list. Click a mechanism name for its
        profile and vote history.</div>
      </div>`;
    host.querySelectorAll("a.mechlink").forEach(a =>
      a.addEventListener("click", () => openMechanism(a.dataset.body)));
    window.HRCCharts.hBars($("#sp-board"), {
      rows: board.slice(0, 30).map(b => ({
        label: STATES[b.i].state,
        parts: [
          { key: "m", label: "Main sponsor / core group", color: cssVar("--c1"), value: b.m },
          { key: "c", label: "Co-sponsor", color: cssVar("--seq-250"), value: b.c },
        ],
        onClick: () => { currentState = STATES[b.i].state; setSub("states"); },
      })),
    });
    $("#csv-sp").addEventListener("click", () => {
      downloadCSV("sponsorship",
        ["state", "regional_group", "main_sponsor", "co_sponsor", "total"],
        board.map(b => [STATES[b.i].state, STATES[b.i].regional_group, b.m, b.c, b.total]),
        filterSummary());
    });
  }

  /* ---------- view: mechanisms tab ---------- */
  // The Mechanisms tab holds only the bodies the Council mandated — the ones every
  // figure on the site counts. Everything else lives on the Excluded mechanisms tab,
  // so nothing appears in the main list that the charts leave out.
  const SCOPE_GROUPS = [
    ["HRC investigative mandate", "Independent bodies"],
    ["OHCHR investigation (broader)", "OHCHR mechanisms"],
  ];
  const OTHER_SCOPE_GROUPS = [
    ["SG-mandated investigation", "Mandated by the Secretary-General"],
    ["GA-mandated mechanism", "Mandated by the General Assembly"],
    ["UNSC-mandated mechanism", "Mandated by the Security Council"],
    [REF_SCOPE, "Special procedures with investigative tasks"],
  ];
  const docCountByBody = {};
  D.documents.forEach(d => (d.bodies || []).forEach(b => { docCountByBody[b] = (docCountByBody[b] || 0) + 1; }));

  const scopeKeyOf = (b) =>
    // GE Darfur lacks a scope value in the source data; it has HRC resolutions,
    // so it belongs with the Council-mandated group
    b.scope || (b.resolutions.length ? "HRC investigative mandate" : "SG-mandated investigation");

  // Period under investigation — the stretch of time the founding resolution tells the
  // body to examine. Three values, read off the founding text and nothing else:
  // a closed episode, everything since a stated date, or no period at all.
  const PERIOD_ORDER = ["bounded episode", "open since a date", "none stated"];
  // Kept for the dataset coding and for filtering; not shown beside the quotation.
  const PERIOD_LABEL = {
    "bounded episode": "A specific episode",
    "open since a date": "From a date, no end",
    "none stated": "Not stated",
  };
  const PERIOD_TITLE = {
    "bounded episode": "The founding resolution names an event or a bounded stretch of time — a particular election, an attack, a set of protests.",
    "open since a date": "The founding resolution names a start date and no closing date: everything from that date to the present.",
    "none stated": "The founding resolution sets no period at all. The body is told what to investigate, not when it happened.",
  };

  // Mechanisms-tab filters. Kept separate from F, which belongs to Resolutions and Votes.
  const MF = { q: "", country: "", status: "", y0: "", y1: "", type: "", verbs: new Set(), fw: new Set() };
  // Computed on first use, not at module evaluation: COUNCIL_SCOPES is declared further down.
  let MECH_OPTS_CACHE = null;
  const mechOpts = () => {
    if (MECH_OPTS_CACHE) return MECH_OPTS_CACHE;
    const bs = D.bodies.filter(b => COUNCIL_SCOPES.has(b.scope));
    MECH_OPTS_CACHE = {
      countries: [...new Set(bs.map(b => countryName(b.country)).filter(Boolean))].sort(),
      years: [...new Set(bs.map(b => (b.start_date || "").slice(0, 4)).filter(Boolean))].sort(),
      types: [...new Set(bs.map(b => b.mandate_type).filter(Boolean))].sort(),
      verbs: [...new Set(bs.flatMap(b => b.mandate_action_verbs || []))].sort(),
      fws: ["IHRL", "IHL", "ICL"].filter(f => bs.some(b => (b.mandate_legal_frameworks || []).includes(f))),
    };
    return MECH_OPTS_CACHE;
  };

  function renderMechs() { renderBodies("#mechs-content", SCOPE_GROUPS, false); }
  function renderOther() { renderBodies("#other-content", OTHER_SCOPE_GROUPS, true); }

  function renderBodies(hostSel, groupSpec, isOther) {
    const host = $(hostSel);
    const keys = new Set(groupSpec.map(g => g[0]));
    const grouped = new Map(groupSpec.map(([k, label]) => [k, { label, rows: [] }]));
    const periodCount = {};
    D.bodies.forEach(b => {
      const key = scopeKeyOf(b);
      if (!keys.has(key)) return;
      if (!isOther) {
        const ps = b.period_scope || "none stated";
        periodCount[ps] = (periodCount[ps] || 0) + 1;
      }
      grouped.get(key).rows.push(b);
    });
    const yearsOf = (b) => {
      const y0 = (b.start_date || "").slice(0, 4), y1 = (b.end_date || "").slice(0, 4);
      if (!y0) return "—";
      return y1 ? (y0 === y1 ? y0 : `${y0}–${y1}`) : `${y0}–ongoing`;
    };
    // A fixed-term body still in force has an End Date in the future: that is the expiry
    // of its CURRENT period, not the day it stopped. Measuring to it and calling the
    // result "ended" reported running mandates as finished (COI Syria read as
    // "15 years and 7 months (ended)"). Measure to today and say so, as chart 9 does.
    const isRunning = (b) => !b.end_date || new Date(b.end_date) > new Date();
    const durationOf = (b) => {
      if (/not implemented/i.test(b.short_name || "")) return "never implemented";
      if (!b.start_date) return "—";
      const running = isRunning(b);
      const a = new Date(b.start_date), z = running ? new Date() : new Date(b.end_date);
      if (isNaN(a) || isNaN(z)) return "—";
      let months = (z.getFullYear() - a.getFullYear()) * 12 + (z.getMonth() - a.getMonth());
      if (z.getDate() < a.getDate()) months--;
      months = Math.max(0, months);
      const y = Math.floor(months / 12), m = months % 12;
      const parts = [];
      if (y) parts.push(`${y} year${y > 1 ? "s" : ""}`);
      if (m || !y) parts.push(`${m} month${m === 1 ? "" : "s"}`);
      // How a mandate ended — defeated, never tabled, simply expired — is a matter for
      // the argument, not a label on the row: the dataset records every one of them as
      // ended and the table says only that.
      return `${parts.join(" and ")} (${running ? (b.end_date ? "in force" : "ongoing") : "ended"})`;
    };
    const nHere = [...grouped.values()].reduce((a, g) => a + g.rows.length, 0);
    const intro = isOther ? `
      <div class="panel"><div class="panel-body" style="font-size:13.5px;color:var(--ink-2)">
        <b style="color:var(--ink)">${nHere} mechanisms and ${(D.excluded_texts || []).length} resolutions that
        no figure on this site counts.</b> They are listed so the inclusion test can be checked against what it
        leaves out, and so the material stays available: open any mechanism for its mandate and dates, and its
        reports are searchable in the Reports tab. Mechanisms first, then the resolutions.
        <details class="more"><summary>Why each one is out</summary>
          <div>Bodies mandated by the Secretary-General, the General Assembly or the Security Council are outside the
          Council's own practice, which is what this dataset measures; the list of them is a selection, not a complete one.
          The Special Rapporteur on Afghanistan is a country special procedure: the Council gave it fact-finding support
          (2021) and a task to document and preserve information (2022–2026) until the Independent Investigative Mechanism
          for Afghanistan, created in October 2025, is operational — close enough to an investigative mandate to be worth
          showing, not close enough to count; its ${REFRES.length} resolutions are listed on its own profile and
          counted nowhere. None of these bodies' mandates are coded for action verbs or legal frameworks, by design.
          </div></details>
      </div></div>
` : `
      <div class="filterbar">
        <div class="filter-row">
          <div class="f-item"><label for="mf-country">Situation</label>
            <select id="mf-country"><option value="">All</option>${mechOpts().countries.map(c =>
              `<option value="${esc(c)}"${MF.country === c ? " selected" : ""}>${esc(c)}</option>`).join("")}</select></div>
          <div class="f-item"><label for="mf-status">Status</label>
            <select id="mf-status"><option value="">All</option>
              <option value="in-force"${MF.status === "in-force" ? " selected" : ""}>in force</option>
              <option value="ended"${MF.status === "ended" ? " selected" : ""}>ended</option></select></div>
          <div class="f-item"><label for="mf-y0">Began from</label>
            <select id="mf-y0"><option value="">—</option>${mechOpts().years.map(y =>
              `<option value="${y}"${String(MF.y0) === String(y) ? " selected" : ""}>${y}</option>`).join("")}</select></div>
          <div class="f-item"><label for="mf-y1">to</label>
            <select id="mf-y1"><option value="">—</option>${mechOpts().years.map(y =>
              `<option value="${y}"${String(MF.y1) === String(y) ? " selected" : ""}>${y}</option>`).join("")}</select></div>
        </div>
        <div class="filter-row filter-row-2">
          <div class="f-item f-search"><label for="mech-q">Search</label>
            <input type="search" id="mech-q" autocomplete="off" spellcheck="false"
              placeholder="Name, full title, situation or acronym" value="${esc(MF.q)}"></div>
          <div class="f-actions">
            <button class="f-more-btn" id="mf-more" aria-expanded="false" aria-controls="mf-adv">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M3 5h18M7 12h10M10 19h4"/></svg>
              <span>More filters</span><span class="f-more-n" id="mf-more-n"></span>
              <svg class="f-more-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <button class="icon-btn reset-btn" id="mf-reset" title="Clear all filters">Reset</button>
            <span class="mech-count" id="mech-count"></span>
          </div>
        </div>
        <div class="filter-row" id="mf-adv" hidden>
          <div class="f-item"><label for="mf-type">Mandate type</label>
            <select id="mf-type"><option value="">All</option>${mechOpts().types.map(t =>
              `<option value="${esc(t)}"${MF.type === t ? " selected" : ""}>${esc(t)}</option>`).join("")}</select></div>
          <div class="f-item" style="flex:1 1 320px"><label>Mandate action verbs (all selected must appear)</label>
            <div class="chip-group" id="mf-verbs">${mechOpts().verbs.map(v =>
              `<button class="chip" data-v="${esc(v)}" aria-pressed="${MF.verbs.has(v)}">${esc(v)}</button>`).join("")}</div></div>
          <div class="f-item"><label>Legal frameworks named</label>
            <div class="chip-group" id="mf-fw">${mechOpts().fws.map(v =>
              `<button class="chip" data-f="${esc(v)}" aria-pressed="${MF.fw.has(v)}" title="${esc(FW_TITLE[v] || "")}">${esc(v)}</button>`).join("")}</div></div>
        </div>
      </div>`;
    const nAll = Object.values(periodCount).reduce((a, n) => a + n, 0);
    const periodBar = "";
    host.innerHTML = `
      ${intro}
      ${periodBar}
      ${[...grouped.values()].filter(g => g.rows.length).map(g => `
      <div class="panel">
        <div class="panel-head"><h2>${esc(g.label)}</h2><span class="count">${g.rows.length}</span></div>
        <div class="tblwrap"><table class="data"><thead><tr>
          <th class="no-sort">Mechanism</th><th class="no-sort">Situation</th><th class="no-sort" title="First and last year of the mandate as resolved; an ongoing mandate has no last year">Mandate years</th>
          <th class="no-sort" title="From the start of the mandate to its end, or to today if it is still running">Duration</th>
          ${isOther ? "" : `<th class="no-sort" title="The stretch of time the founding resolution tells the body to examine">Period investigated</th>`}
          <th class="no-sort">Explore</th></tr></thead>
        <tbody>${g.rows.sort((a, b) =>
          // in force first, then chronologically: oldest mandate at the top of each block
          ((isRunning(a) ? 0 : 1) - (isRunning(b) ? 0 : 1)) ||
          (a.start_date || "").localeCompare(b.start_date || "")).map(b => {
          const nres = (b.resolutions || []).length;
          const ndocs = docCountByBody[b.short_name] || 0;
          const isRef = b.scope === REF_SCOPE;
          return `<tr data-s="${esc(((b.short_name || "") + " " + (b.full_name || "") + " " +
            (countryName(b.country) || "") + " " + (b.country || "")).toLowerCase())}"
            data-country="${esc(countryName(b.country) || "")}"
            data-status="${isRunning(b) ? "in-force" : "ended"}"
            data-y="${esc((b.start_date || "").slice(0, 4))}"
            data-mt="${esc(b.mandate_type || "")}"
            data-verbs="${esc((b.mandate_action_verbs || []).join("|"))}"
            data-fw="${esc((b.mandate_legal_frameworks || []).join("|"))}">
            <td><a class="mech-open" data-body="${esc(b.short_name)}" style="cursor:pointer"><b>${esc(b.short_name)}</b></a>
              ${isRef ? `<span class="badge" style="margin-left:4px" title="Shown for reference; not counted in any statistic">reference only</span>` : ""}
              ${!isRef && b.start_date && (b.mandate_status === "active" || isRunning(b)) ? `<span class="badge on" style="background:var(--c2);margin-left:4px" title="${b.end_date ? "Fixed term, still running: the End Date is the expiry of the current period" : "No end date set — the Council's own word is ongoing"}">${b.end_date ? "in force" : "ongoing"}</span>` : ""}
              <div style="font-size:12px;color:var(--muted)">${esc(b.full_name || "")}</div></td>
            <td>${esc(countryName(b.country) || "—")}</td>
            <td style="white-space:nowrap">${yearsOf(b)}</td>
            <td style="white-space:nowrap">${durationOf(b)}</td>
            ${isOther ? "" : (() => {
              const ps = b.period_scope || "none stated";
              // The founding resolution's own words. The coded scope stays in the data
              // and in the tooltip; showing the label beside the quotation read as a
              // second, conflicting answer.
              return `<td title="${esc(PERIOD_TITLE[ps] || "")}" style="max-width:26em;white-space:normal">
                ${b.period_phrase ? `\u201c${esc(b.period_phrase)}\u201d`
                  : `<span style="color:var(--muted)">not stated</span>`}</td>`;
            })()}
            <td style="white-space:nowrap">
              ${isRef ? `<span style="color:var(--muted)">${nres} resolution${nres > 1 ? "s" : ""} (reference only)</span>`
                : nres ? `<a class="mech-res" data-body="${esc(b.short_name)}">${nres} resolution${nres > 1 ? "s" : ""}</a>
                <br><a class="mech-votes" data-body="${esc(b.short_name)}">votes</a>` : `<span style="color:var(--muted)">no HRC resolutions</span>`}
              ${ndocs ? `<br><a class="mech-reports" data-body="${esc(b.short_name)}">${ndocs} report${ndocs > 1 ? "s" : ""}</a>` : ""}
            </td>
          </tr>`;
        }).join("")}</tbody></table></div>
      </div>`).join("")}
      ${isOther && (D.excluded_texts || []).length ? `
      <div class="panel">
        <div class="panel-head"><h2>Resolutions excluded from the corpus</h2><span class="count">${(D.excluded_texts || []).length}</span></div>
        <div class="tblwrap"><table class="data"><thead><tr><th class="no-sort">Resolution</th><th class="no-sort">Why it is excluded</th></tr></thead>
        <tbody>${(D.excluded_texts || []).map(x => `<tr>
          <td style="white-space:nowrap"><a href="${esc(unLink(x.symbol))}" target="_blank" rel="noopener">${esc(x.symbol)}</a></td>
          <td>${esc(x.reason)}</td></tr>`).join("")}</tbody></table></div>
        <div class="panel-note">Adopted by the Council, but they fail one of the four criteria on the
          Methodology tab. They are not among the ${RES.length} resolutions counted anywhere on this site.</div>
      </div>` : ""}
`;
    const q = $("#mech-q", host);
    if (q && !isOther) {
      const countEl = $("#mech-count", host);
      const hit = (tr) => {
        const d = tr.dataset;
        if (MF.q && !(d.s || "").includes(MF.q)) return false;
        if (MF.country && d.country !== MF.country) return false;
        if (MF.status && d.status !== MF.status) return false;
        if (MF.y0 && (!d.y || d.y < MF.y0)) return false;
        if (MF.y1 && (!d.y || d.y > MF.y1)) return false;
        if (MF.type && d.mt !== MF.type) return false;
        if (MF.verbs.size) {
          const has = new Set((d.verbs || "").split("|").filter(Boolean));
          for (const v of MF.verbs) if (!has.has(v)) return false;
        }
        if (MF.fw.size) {
          const has = new Set((d.fw || "").split("|").filter(Boolean));
          for (const f of MF.fw) if (!has.has(f)) return false;
        }
        return true;
      };
      const advCount = () => (MF.country ? 1 : 0) + (MF.status ? 1 : 0) + (MF.y0 ? 1 : 0) +
        (MF.y1 ? 1 : 0) + (MF.type ? 1 : 0) + MF.verbs.size + MF.fw.size;
      const apply = () => {
        let shown = 0;
        $$(".panel", host).forEach(panel => {
          const rows = $$("tbody tr", panel);
          if (!rows.length) return;
          let n = 0;
          rows.forEach(tr => {
            const ok = hit(tr);
            tr.style.display = ok ? "" : "none";
            if (ok) n++;
          });
          panel.style.display = n ? "" : "none";
          const c = $(".panel-head .count", panel);
          if (c) c.textContent = n;
          shown += n;
        });
        const nAdv = advCount();
        const badge = $("#mf-more-n", host);
        if (badge) { badge.textContent = nAdv ? nAdv : ""; badge.hidden = !nAdv; }
        const mb = $("#mf-more", host);
        if (mb) mb.classList.toggle("has-filters", !!nAdv);
        countEl.textContent = (MF.q || nAdv) ? `${shown} of ${nHere}` : "";
      };
      q.addEventListener("input", () => { MF.q = q.value.trim().toLowerCase(); apply(); });
      q.addEventListener("keydown", (e) => {
        if (e.key === "Escape") { q.value = ""; MF.q = ""; apply(); }
      });
      [["mf-country", "country"], ["mf-status", "status"], ["mf-y0", "y0"],
       ["mf-y1", "y1"], ["mf-type", "type"]].forEach(([id, key]) => {
        const el = $("#" + id, host);
        if (el) el.addEventListener("change", (e) => { MF[key] = e.target.value; apply(); });
      });
      [["mf-verbs", "v", MF.verbs], ["mf-fw", "f", MF.fw]].forEach(([id, attr, set]) => {
        const el = $("#" + id, host);
        if (el) el.addEventListener("click", (e) => {
          const b = e.target.closest("button");
          const v = b && b.dataset[attr];
          if (!v) return;
          set.has(v) ? set.delete(v) : set.add(v);
          b.setAttribute("aria-pressed", String(set.has(v)));
          apply();
        });
      });
      const more = $("#mf-more", host), adv = $("#mf-adv", host);
      if (more && adv) {
        if (MF.type || MF.verbs.size || MF.fw.size) { adv.hidden = false; more.setAttribute("aria-expanded", "true"); }
        more.addEventListener("click", () => {
          adv.hidden = !adv.hidden;
          more.setAttribute("aria-expanded", String(!adv.hidden));
        });
      }
      const reset = $("#mf-reset", host);
      if (reset) reset.addEventListener("click", () => {
        MF.q = ""; MF.country = ""; MF.status = ""; MF.y0 = ""; MF.y1 = ""; MF.type = "";
        MF.verbs.clear(); MF.fw.clear();
        renderMechs();
      });
      apply();
    }

    host.onclick = (e) => {
      const mo = e.target.closest("a.mech-open");
      if (mo) { openMechanism(mo.dataset.body); return; }
      const mr = e.target.closest("a.mech-res");
      if (mr) {
        F.body = mr.dataset.body;
        renderFilters(); setTab("res");
        return;
      }
      const v = e.target.closest("a.mech-votes");
      if (v) {
        F.body = v.dataset.body;
        renderFilters(); setTab("votes");
        return;
      }
      const rp = e.target.closest("a.mech-reports");
      if (rp && window.HRCReports) {
        setTab("reports");
        window.HRCReports.showMechanism(rp.dataset.body);
      }
    };
  }

  /* ---------- mechanism profile modal (with vote evolution) ---------- */
  const SCOPE_LABEL = {
    "HRC investigative mandate": "Mandated by the Human Rights Council",
    "OHCHR investigation (broader)": "OHCHR investigation at the Council's request",
    "SG-mandated investigation": "Mandated by the Secretary-General",
    "GA-mandated mechanism": "Mandated by the General Assembly",
    "UNSC-mandated mechanism": "Mandated by the Security Council",
    [REF_SCOPE]: "Special procedure with investigative tasks — reference only, not counted",
  };
  const PREDECESSOR_NOTE = {
    "IIM Afghanistan (2025)": "Predecessor: Special Rapporteur with document-and-preserve mandate, 2021–2026 (reference only)",
  };
  function openMechanism(name) {
    const b = bodyByName.get(name);
    if (!b) return;
    const isRef = b.scope === REF_SCOPE;
    const predecessor = b.predecessor_note || PREDECESSOR_NOTE[name];
    const mres = (isRef ? REFRES : RES).filter(r => (r.bodies || []).includes(name));
    const y0 = (b.start_date || "").slice(0, 4), y1 = (b.end_date || "").slice(0, 4);
    const running = bodyIsRunning(b);
    const years = y0 ? (y1 ? (y0 === y1 ? y0 : `${y0}–${y1}`) : `${y0}–ongoing`) : "—";
    // y1 on a running body is the expiry of the current period, so say which it is
    const active = y0 && !isRef
      ? `${years} · ${running ? (b.end_date ? "in force" : "ongoing") : "ended"}`
      : years;
    $("#modal").innerHTML = `
      <div class="modal-head">
        <div><h3>${esc(b.full_name || name)}</h3>
          <div class="sym">${esc(name)} · ${esc(countryName(b.country) || "")} · ${active}</div></div>
        <button class="modal-close" id="modal-close" aria-label="Close">✕</button>
      </div>
      <div class="modal-body">
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <span class="badge">${esc(SCOPE_LABEL[b.scope] || (mres.length ? SCOPE_LABEL["HRC investigative mandate"] : b.scope || "—"))}</span>
          ${(b.mandate_legal_frameworks || []).map(f => `<span class="badge on" style="background:var(${FW_COMBO_COLOR[f] || "--c1"})" title="${esc(FW_TITLE[f] || "")}">${esc(f)}</span>`).join(" ")}
        </div>
        ${isRef ? `<div class="panel-note" style="margin:10px 0;border:1px solid var(--grid);border-radius:6px;padding:8px 10px">
          <b>Shown for reference only.</b> This is a special procedure, not an investigative body. The Council gave it
          fact-finding, legal-analysis and forensic support (resolution 48/1, 2021) and a task to document and preserve
          information on violations (51/20, 2022), kept in force until the Independent Investigative Mechanism for
          Afghanistan (created by 60/2, October 2025) is operational. Its resolutions, votes and sponsorships are
          <b>not counted</b> in any figure on this site.</div>` : ""}
        ${predecessor ? `<div class="panel-note" style="margin:10px 0">${esc(predecessor)}</div>` : ""}
        <div class="meta-grid">
          <div class="m"><b>Mandate action verbs</b>${esc((b.mandate_action_verbs || []).join(", ") || "—")}</div>
          ${b.period_scope ? `<div class="m" title="${esc(PERIOD_TITLE[b.period_scope] || "")}"><b>Period under investigation</b>${
            b.period_phrase ? `\u201c${esc(b.period_phrase)}\u201d` : "not stated"}${
            b.period_source ? `<div style="font-size:12px;color:var(--muted)">from ${esc(b.period_source)}</div>` : ""}</div>` : ""}
          ${b.links ? (() => {
            const isRes = /undocs\.org|docs\.un\.org/i.test(b.links);
            const symFromUrl = decodeURIComponent(b.links.replace(/^https?:\/\/[^/]+\/(en\/)?/i, "").replace(/[?#].*$/, ""));
            return `<div class="m"><b>${isRes ? "Mandating resolution" : "Official web page"}</b><a href="${esc(b.links)}" target="_blank" rel="noopener">${esc(isRes ? symFromUrl : (b.full_name || name))} ↗</a></div>`;
          })() : ""}
        </div>
        ${(() => {
          const founding = mres.find(r => r.resolution_role === "founding" && r.verbatim_mandate) ||
            mres.find(r => r.verbatim_mandate);
          return founding ? `
            <h4 style="margin:12px 0 4px;font-size:13px">Mandate as adopted — verbatim from resolution ${esc(founding.symbol.replace("A/HRC/RES/", "").replace("A/HRC/DEC/", "decision ").replace("A/HRC/", ""))} (${esc(String(founding.year || (founding.date_adopted || "").slice(0, 4)))}${founding.resolution_role ? `, ${esc(founding.resolution_role)} text` : ""})</h4>
            <blockquote class="verbatim">${esc(founding.verbatim_mandate)}</blockquote>` : "";
        })()}
        ${mres.length ? `
        <h4 style="margin:12px 0 4px;font-size:13px">How the Council has voted on this mechanism</h4>
        <div class="chart-host" id="mech-evo"></div>
        <div class="legend" id="mech-evo-legend"></div>
        <div style="font-size:12px;color:var(--muted);margin-top:4px">One column per resolution (year in brackets), oldest to newest —
        click a column for the full card. Grey stubs: adopted without a vote.</div>
        ${mres.some(r => r.adoption_mode === "Recorded vote" && votesOf(r.symbol)) ? `
        <h4 style="margin:14px 0 4px;font-size:13px">How each regional group voted, resolution by resolution</h4>
        <div class="chart-host" id="mech-groups"></div>
        <div class="legend" id="mech-groups-legend"></div>
        <div style="font-size:12px;color:var(--muted);margin-top:4px">Each line is one UN regional group: the share of its
        Council members voting <b>in favour</b> (out of those voting Yes, No or Abstain), one point per recorded vote, oldest
        to newest. Hover a point for the group's Yes · No · Abstain; click it for the resolution. Adoptions without a vote have no
        vote and are left out.</div>` : ""}
        <div class="tblwrap" style="max-height:280px;margin-top:10px"><table class="data"><tbody>
          ${mres.map((r, i) => `<tr data-sym="${esc(r.symbol)}"><td>${resLink(r)}</td>
            <td style="white-space:nowrap">${fmtDate(r.date_adopted)}</td>
            <td>${roleBadge(r)}</td>
            <td style="white-space:nowrap">${tallyPills(r)}</td>
            <td>${r.verbatim_mandate ? `<button class="chip vm-toggle" data-vm="${i}">mandate text</button>` : ""}</td></tr>
            ${r.verbatim_mandate ? `<tr class="vm-row" id="vm-${i}" hidden><td colspan="5">
              <blockquote class="verbatim" style="margin:4px 0">${esc(r.verbatim_mandate)}</blockquote></td></tr>` : ""}`).join("")}
        </tbody></table></div>` : `<p style="color:var(--ink-2);font-size:13.5px">This body was not mandated by the
        Human Rights Council, so it has no Council resolutions or votes. Its reports are in the Reports tab.</p>`}
        <div class="linkrow">
          ${mres.length && !isRef ? `<a id="mech-to-res" style="cursor:pointer">See its resolutions</a>
            <a id="mech-to-votes" style="cursor:pointer">See its votes</a>` : ""}
          ${(docCountByBody[name] || 0) ? `<a id="mech-to-reports" style="cursor:pointer">Open its ${docCountByBody[name]} report${docCountByBody[name] > 1 ? "s" : ""}</a>` : ""}
        </div>
      </div>`;
    $("#overlay").classList.add("open");
    document.body.style.overflow = "hidden";
    if (location.hash.indexOf("#/res/") !== 0 && location.hash.indexOf("#/mech/") !== 0) modalReturnHash = location.hash;
    history.replaceState(null, "", "#/mech/" + encodeURIComponent(name));
    $("#modal-close").addEventListener("click", closeModal);
    if (mres.length) {
      const cats = mres.map(r => `${r.symbol.replace("A/HRC/RES/", "").replace("A/HRC/DEC/", "DEC ").replace("A/HRC/", "")} (${r.year || (r.date_adopted || "").slice(0, 4)})`);
      const count = (r, code) => {
        const row = votesOf(r.symbol);
        if (!row) return 0;
        let n = 0;
        for (let i = 0; i < row.length; i++) if (row[i] === code) n++;
        return n;
      };
      const series = [
        { key: "Y", label: "Yes", color: cssVar("--yes"), values: mres.map(r => count(r, "Y")) },
        { key: "N", label: "No", color: cssVar("--no"), values: mres.map(r => count(r, "N")) },
        { key: "A", label: "Abstain", color: cssVar("--abstain"), values: mres.map(r => count(r, "A")) },
        { key: "X", label: "Absent", color: cssVar("--absent"), values: mres.map(r => count(r, "X")) },
        { key: "C", label: "adopted without a vote", color: cssVar("--baseline"),
          values: mres.map(r => r.adoption_mode === "Recorded vote" ? 0 : 4) },
      ];
      window.HRCCharts.stackedColumns($("#mech-evo"), {
        categories: cats, series, height: 200, labelWidth: 88,
        onBarClick: (ci) => openResolution(mres[ci].symbol),
        tooltip: (ci) => {
          const r = mres[ci];
          if (r.adoption_mode !== "Recorded vote")
            return [{ label: "Adopted without a vote", value: "" }, { label: fmtDate(r.date_adopted), value: "" }];
          return series.slice(0, 4).map(s => ({ label: s.label, color: s.color, value: s.values[ci] }))
            .concat([{ label: fmtDate(r.date_adopted), value: "" }]);
        },
      });
      $("#mech-evo-legend").innerHTML = series.filter(s => s.values.some(v => v)).map(s =>
        `<span class="lg"><span class="sw" style="background:${s.color}"></span>${esc(s.label)}</span>`).join("");
      // regional groups, resolution by resolution (recorded votes only)
      const voted = mres.filter(r => r.adoption_mode === "Recorded vote" && votesOf(r.symbol));
      if (voted.length && $("#mech-groups")) {
        const tallyBy = (r) => {
          const row = votesOf(r.symbol), out = new Map();
          GROUP_META.forEach(g => out.set(g.short, { Y: 0, N: 0, A: 0 }));
          for (let i = 0; i < row.length; i++) {
            const c = row[i];
            if (c !== "Y" && c !== "N" && c !== "A") continue;
            const g = groupOf(STATES[i].regional_group);
            const k = g ? g.short : "Other";
            if (!out.has(k)) out.set(k, { Y: 0, N: 0, A: 0 });
            out.get(k)[c]++;
          }
          return out;
        };
        const tallies = voted.map(tallyBy);
        const gcats = voted.map(r => `${r.symbol.replace("A/HRC/RES/", "").replace("A/HRC/DEC/", "DEC ").replace("A/HRC/", "")} (${r.year || (r.date_adopted || "").slice(0, 4)})`);
        const gseries = GROUP_META.map(g => ({
          key: g.short, label: g.short, color: cssVar(g.color),
          values: tallies.map(t => { const c = t.get(g.short); const cast = c ? c.Y + c.N + c.A : 0; return cast ? Math.round(100 * c.Y / cast) : null; }),
        }));
        window.HRCCharts.lines($("#mech-groups"), {
          categories: gcats, series: gseries, height: 230, yMax: 100, yLabel: (v) => v + "%",
          onPointClick: (ci) => openResolution(voted[ci].symbol),
          tooltip: (ci) => gseries.map(sr => {
            const c = tallies[ci].get(sr.key) || { Y: 0, N: 0, A: 0 };
            return { label: sr.label, color: sr.color, value: sr.values[ci] == null ? "no votes cast" : `${sr.values[ci]}% in favour (${c.Y} · ${c.N} · ${c.A})` };
          }).concat([{ label: fmtDate(voted[ci].date_adopted), value: "" }]),
        });
        $("#mech-groups-legend").innerHTML = gseries.map(sr =>
          `<span class="lg"><span class="sw" style="background:${sr.color}"></span>${esc(sr.label)}</span>`).join("");
      }
      $("#modal .tblwrap tbody").addEventListener("click", (e) => {
        const vt = e.target.closest("button.vm-toggle");
        if (vt) {
          const row = $("#vm-" + vt.dataset.vm);
          row.hidden = !row.hidden;
          vt.setAttribute("aria-pressed", String(!row.hidden));
          return;
        }
        const tr = e.target.closest("tr[data-sym]");
        if (tr) openResolution(tr.dataset.sym);
      });
      const tv = $("#mech-to-votes");
      if (tv) tv.addEventListener("click", () => {
        closeModal(); F.body = name; renderFilters(); setTab("votes");
      });
      const tr0 = $("#mech-to-res");
      if (tr0) tr0.addEventListener("click", () => {
        closeModal(); F.body = name; renderFilters(); setTab("res");
      });
    }
    const tr2 = $("#mech-to-reports");
    if (tr2) tr2.addEventListener("click", () => {
      closeModal(); setTab("reports");
      if (window.HRCReports) window.HRCReports.showMechanism(name);
    });
  }

  /* ---------- resolution modal ---------- */
  function mechVerbs(r) {
    const out = new Set();
    (r.bodies || []).forEach(bn => {
      const b = bodyByName.get(bn);
      (b && b.mandate_action_verbs || []).forEach(v => out.add(v));
    });
    return [...out];
  }
  function openResolution(sym) {
    const r = bySym.get(sym) || byRefSym.get(sym);
    if (!r) return;
    const overlay = $("#overlay");
    const votesRow = votesOf(sym);
    let voteCols = "";
    if (votesRow) {
      const lists = { Y: [], N: [], A: [], X: [] };
      for (let i = 0; i < votesRow.length; i++) {
        const c = votesRow[i];
        if (lists[c]) lists[c].push(STATES[i].state);
      }
      const col = (title, arr, cls) => `<div><h4><span class="pill ${cls}">${arr.length}</span> ${title}</h4>
        <ul>${arr.map(s => `<li>${esc(s)}</li>`).join("")}</ul></div>`;
      voteCols = `<div class="vote-cols">
        ${col("In favour", lists.Y, "yes")}${col("Against", lists.N, "no")}
        ${col("Abstaining", lists.A, "abstain")}${lists.X.length ? col("Absent", lists.X, "absent") : ""}
      </div>`;
    }
    const s = sponsorsOf(sym);
    const spBlock = s ? `<div class="m" style="grid-column:1/-1"><b>Sponsors</b>
      ${s.m.length ? `<div style="margin-top:2px"><span class="badge on" style="background:var(--c1)">main / core group</span>
        ${s.m.map(i => esc(STATES[i].state)).join(", ")}</div>` : ""}
      ${s.c.length ? `<div style="margin-top:2px"><span class="badge">co-sponsors (${s.c.length})</span>
        <span style="color:var(--ink-2)">${s.c.map(i => esc(STATES[i].state)).join(", ")}</span></div>` : ""}</div>` : "";
    const g = r.gender_language || {};
    const langRow = (label, arr) => arr && arr.length ? `<div class="m"><b>${label}</b>${esc(arr.join(", "))}</div>` : "";
    const links = [];
    links.push(`<a href="${esc(r.links && r.links.download || unLink(r.symbol))}" target="_blank" rel="noopener">Full text (docs.un.org) ↗</a>`);
    if (r.links && r.links.draft_un) links.push(`<a href="${esc(r.links.draft_un)}" target="_blank" rel="noopener">Draft ${esc(r.links.l_document_symbol || "L-document")} ↗</a>`);
    if (r.links && r.links.voting_record_un) links.push(`<a href="${esc(r.links.voting_record_un)}" target="_blank" rel="noopener">Official voting record ↗</a>`);

    $("#modal").innerHTML = `
      <div class="modal-head">
        <div><h3>${esc(r.title)}</h3>
          <div class="sym">${esc(r.symbol)} · ${fmtDate(r.date_adopted)} · session ${esc(r.session || "—")}</div></div>
        <button class="modal-close" id="modal-close" aria-label="Close">✕</button>
      </div>
      <div class="modal-body">
        ${r.reference_only ? `<div class="panel-note" style="margin:0 0 10px;border:1px solid var(--grid);border-radius:6px;padding:8px 10px">
          <b>Reference only.</b> This resolution concerns a special procedure, shown on this site for context;
          it is not counted in any statistic, chart or filter.</div>` : ""}
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          ${r.adoption_mode === "Recorded vote"
            ? `${tallyPills(r)} <span style="color:var(--muted);font-size:12.5px">yes–no–abstain</span>`
            : `<span class="pill mode-consensus">adopted without a vote</span>`}
          ${roleBadge(r)} ${caBadge(r)}
          ${(r.legal_frameworks || []).map(f => `<span class="badge" title="${esc(FW_TITLE[f] || "")}">${esc(f)}</span>`).join(" ")}
        </div>
        <div class="meta-grid">
          <div class="m"><b>Bodies</b>${esc((r.bodies || []).join(", ") || "—")}</div>
          <div class="m"><b>Mandate paragraphs</b>${esc(r.mandate_paragraphs || "—")}</div>
          ${r.agenda_item ? `<div class="m"><b>Agenda item</b>${r.agenda_item === "special session"
              ? "special session" : r.agenda_item === "not recorded" ? "not recorded in the UN record"
              : esc(r.agenda_item) + (r.agenda_item_title ? ` — ${esc(r.agenda_item_title)}` : "")}</div>` : ""}
          ${r.vote_requested_by ? `<div class="m"><b>Vote requested by</b>${esc(r.vote_requested_by)}</div>` : ""}
          ${r.state_concerned_position ? `<div class="m" style="grid-column:1/-1"><b>Position of the State concerned</b>
              <span class="badge ${r.state_concerned_position === "objected" ? "" : "on"}">${esc(r.state_concerned_position)}</span>
              ${r.investigated_conduct_state_position ? `<span class="badge">State whose conduct is investigated: ${esc(r.investigated_conduct_state_position)}</span>` : ""}
              ${r.state_concerned_source ? `<div style="font-size:11.5px;color:var(--ink-2);margin-top:3px">${esc(r.state_concerned_source)}</div>` : ""}</div>` : ""}
          ${(r.action_verbs || []).length
            ? `<div class="m"><b>Action verbs (this text)</b>${esc(r.action_verbs.join(", "))}</div>`
            : `<div class="m"><b>Action verbs (mechanism-level)</b>${esc(mechVerbs(r).join(", ") || "—")}
               ${mechVerbs(r).length ? `<div style="font-size:11px;color:var(--muted)">none coded in this text — showing the mechanism's mandate verbs</div>` : ""}</div>`}
          ${langRow("Gender language — mandate", g.mandate)}
          ${langRow("Gender language — other OPs", g.other_ops)}
          ${langRow("Gender language — preamble", g.preamble)}
          ${langRow("Children language", r.children_language)}
          ${spBlock}
        </div>
        ${r.verbatim_mandate ? `<h4 style="margin:12px 0 4px;font-size:13px">Mandate (verbatim)</h4>
          <blockquote class="verbatim">${esc(r.verbatim_mandate)}</blockquote>` : ""}
        ${voteCols}
        <div class="linkrow">${links.join("")}
          <a id="copy-cite" style="cursor:pointer">Copy citation</a>
          <a id="copy-link" style="cursor:pointer">Copy link to this card</a></div>
      </div>`;
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
    if (location.hash.indexOf("#/res/") !== 0) modalReturnHash = location.hash;
    history.replaceState(null, "", "#/res/" + encodeURIComponent(sym));
    $("#modal-close").addEventListener("click", closeModal);
    $("#copy-cite").addEventListener("click", () => {
      const cite = r.adoption_mode === "Recorded vote"
        ? `Human Rights Council, "${r.title}", UN Doc ${r.symbol} (${fmtDate(r.date_adopted)}), adopted by ${r.tally} recorded vote.`
        : `Human Rights Council, "${r.title}", UN Doc ${r.symbol} (${fmtDate(r.date_adopted)}), adopted without a vote.`;
      navigator.clipboard.writeText(cite);
      $("#copy-cite").textContent = "Copied ✓";
    });
    $("#copy-link").addEventListener("click", () => {
      navigator.clipboard.writeText(location.href);
      $("#copy-link").textContent = "Copied ✓";
    });
  }
  let modalReturnHash = "";
  function closeModal() {
    $("#overlay").classList.remove("open");
    document.body.style.overflow = "";
    if (location.hash.indexOf("#/res/") === 0 || location.hash.indexOf("#/mech/") === 0)
      history.replaceState(null, "", modalReturnHash || "#/resolutions");
  }
  $("#overlay").addEventListener("click", (e) => { if (e.target === $("#overlay")) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
  document.addEventListener("click", (e) => {
    $$("details.menu[open]").forEach(d => { if (!d.contains(e.target)) d.removeAttribute("open"); });
  });
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a.reslink");
    if (a) { e.preventDefault(); openResolution(a.dataset.sym); }
  });

  /* ---------- tabs, subnav, router ---------- */
  let lastRoutedHash = null;
  let currentTab = "overview", currentSub = "matrix";
  function setTab(tab, push) {
    currentTab = tab;
    $$(".tabbar .tab").forEach(b => b.setAttribute("aria-selected", String(b.dataset.tab === tab)));
    $$(".view").forEach(v => v.classList.toggle("active", v.id === "view-" + tab));
    if (push !== false) history.replaceState(null, "",
      tab === "res" ? "#/resolutions" : "#/" + tab + (tab === "votes" ? "/" + currentSub : ""));
    // keep the router's guard in step: replaceState fires no hashchange, so without
    // this the stored hash would go stale and a later Back to the same hash would be ignored
    lastRoutedHash = location.hash;
    // the one filter bar serves both the Resolutions and the Votes tab
    if (tab === "res" || tab === "votes") {
      const slot = $(tab === "res" ? "#fb-slot-res" : "#fb-slot-votes");
      const fb = $("#filterbar");
      if (fb && fb.parentElement !== slot) slot.appendChild(fb);
      update();
    }
    if (tab === "reports" && window.HRCReports) window.HRCReports.activate();
    // the excluded list lives at the foot of Mechanisms, so it renders with it
    if (tab === "mechs") { renderMechs(); renderOther(); }
    if (tab === "overview") { renderOverviewTiles(); if (window.HRCSummary) window.HRCSummary.activate(); }
    if (tab === "present" && window.HRCPresent) window.HRCPresent.activate();
  }
  function setSub(sub) {
    currentSub = sub;
    if (currentTab !== "votes") { setTab("votes"); }
    $$("#votes-subnav > button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.sub === sub)));
    const rn = $("#mx-rows-nav"); if (rn) rn.hidden = sub !== "matrix";
    history.replaceState(null, "", "#/votes/" + sub);
    update();
  }
  $$(".tabbar .tab").forEach(b => b.addEventListener("click", () => setTab(b.dataset.tab)));
  $$("#votes-subnav > button").forEach(b => b.addEventListener("click", () => setSub(b.dataset.sub)));
  function paintRowsNav() {
    $$("#mx-rows-nav button").forEach(b =>
      b.setAttribute("aria-pressed", String(b.dataset.v === matrixRows)));
  }
  paintRowsNav();
  $$("#mx-rows-nav button").forEach(b => b.addEventListener("click", () => {
    matrixRows = b.dataset.v;
    paintRowsNav();
    if (currentSub !== "matrix") setSub("matrix"); else viewMatrix(filtered());
  }));

  function filterSummary() {
    const bits = [];
    if (F.y0 !== YEARS.min || F.y1 !== YEARS.max) bits.push(`years ${F.y0}-${F.y1}`);
    if (F.country) bits.push(F.country);
    if (F.body) bits.push(`mechanism: ${F.body}`);
    if (F.mode) bits.push(F.mode);
    if (F.role) bits.push("role: " + F.role);
    if (F.ca) bits.push("accountability: " + F.ca);
    if (F.genderLoc || F.genderLabel) bits.push("gender language filter");
    if (F.children) bits.push("children language filter");
    if (F.verbs.size) bits.push("verbs: " + [...F.verbs].join("/"));
    if (F.fw.size) bits.push([...F.fw].join("/"));
    if (F.q) bits.push(`search "${F.q}"`);
    return bits.length ? "Filters: " + bits.join("; ") : "All 2006-2026 resolutions, no filters";
  }

  function update() {
    const R = filtered();
    paintMoreFilters();
    if (currentTab === "res") viewResolutions(R);
    else if (currentTab === "votes") {
      if (currentSub === "matrix") viewMatrix(R);
      else if (currentSub === "states") viewStates(R);
      else if (currentSub === "sponsors") viewSponsors(R);
    }
  }

  /* ---------- overview tiles ---------- */
  // The headline figures of the whole corpus. They never follow the filter bar:
  // the Overview describes the dataset, Resolutions and Votes interrogate it.
  function renderOverviewTiles() {
    const host = $("#overview-tiles");
    if (!host) return;
    const voted = RES.filter(r => r.adoption_mode === "Recorded vote" && votesOf(r.symbol));
    let positions = 0;
    voted.forEach(r => {
      const row = votesOf(r.symbol) || [];
      for (let i = 0; i < row.length; i++) if (row[i] !== ".") positions++;
    });
    const situations = new Set();
    D.bodies.forEach(b => { if (b.scope !== REF_SCOPE && b.country) situations.add(b.country); });
    host.innerHTML = `
      <div class="tiles overview-tiles">
        <div class="tile"><div class="t-label">Mandating texts</div><div class="t-value">${RES.length}</div>
          <div class="t-sub">${YEARS.min}–${YEARS.max}</div></div>
        <div class="tile clickable" data-go="mechs"><div class="t-label">Mechanisms</div><div class="t-value">${COUNCIL_BODIES}</div>
          <div class="t-sub">across ${situations.size} situations</div></div>
        <div class="tile clickable" data-go="votes"><div class="t-label">Recorded votes</div><div class="t-value">${voted.length}</div>
          <div class="t-sub">${RES.length - voted.length} adopted without a vote</div></div>
        <div class="tile clickable" data-go="votes"><div class="t-label">Positions recorded</div><div class="t-value">${positions.toLocaleString("en-GB")}</div>
          <div class="t-sub">one per state, per vote</div></div>
        <div class="tile clickable" data-go="reports"><div class="t-label">Reports searchable</div><div class="t-value">${D.documents.length}</div>
          <div class="t-sub">paragraph by paragraph</div></div>
      </div>`;
    host.onclick = (e) => {
      const t = e.target.closest("[data-go]");
      if (t) setTab(t.dataset.go);
    };
  }

  /* ---------- about + footer ---------- */
  // Bodies on the site that the Council did not mandate (GA-, UNSC- and SG-mandated),
  // shown for context in the Mechanisms and Reports tabs and counted in no figure.
  const COUNCIL_SCOPES = new Set(["HRC investigative mandate", "OHCHR investigation (broader)"]);
  const COUNCIL_BODIES = D.bodies.filter(b => COUNCIL_SCOPES.has(b.scope)).length;
  const OTHER_MANDATED_BODIES = D.bodies.filter(
    b => !COUNCIL_SCOPES.has(b.scope) && b.scope !== REF_SCOPE).length;

  function renderAbout() {
    $("#about-content").innerHTML = `
      <p class="prose">Every figure on this site is built from the text of the resolutions themselves.
      This page states what enters the corpus, what that leaves out, and how the coding is applied.
      <button class="icon-btn" onclick="window.HRCTour && HRCTour.start()">? One-minute tour</button></p>

      <h2>What qualifies</h2>
      <p class="prose">A text is counted only if it meets all four. Each criterion rules something out,
      and the right-hand column is what it rules out.</p>
      <table class="data criteria">
        <thead><tr><th>Counted</th><th>Not counted</th></tr></thead>
        <tbody>
          <tr>
            <td><b>1 · The Human Rights Council adopted it, 2006&#8211;2026.</b><br>
              Regular session, special session or organizational meeting.</td>
            <td>Anything the General Assembly, the Security Council or the Secretary-General mandated.</td>
          </tr>
          <tr>
            <td><b>2 · It acts on a country-specific mechanism.</b><br>
              It establishes one, renews it, widens what it investigates, or gives it new tasks.</td>
            <td>Thematic mechanisms. Country special procedures &#8212; Special Rapporteurs, Independent
              Experts &#8212; even where they are given investigation-like functions, such as the Special
              Rapporteur on Afghanistan, unless the same text also does one of those four things. Texts that
              only welcome a report or urge cooperation. UPR outcome decisions.</td>
          </tr>
          <tr>
            <td><b>3 · That mechanism investigates, or preserves evidence.</b><br>
              A commission of inquiry, fact-finding mission, group, team or committee of experts; or OHCHR
              running an investigation, examination, monitoring or accountability mandate for the Council.</td>
            <td>A request to OHCHR for a report where no body exists and nothing investigative is asked of
              it &#8212; for example, resolution S-23/1 (Boko Haram, 2015).</td>
          </tr>
          <tr>
            <td><b>4 · It speaks to the body itself.</b><br>
              At least one paragraph instructs the body, rather than someone else.</td>
            <td>Welcoming its report &#8212; that is an assessment of the body. Urging States to cooperate, or
              transmitting its reports onward &#8212; those address States and other organs.</td>
          </tr>
        </tbody>
      </table>
      <p class="prose"><b>Check it against what it excludes.</b> Every mechanism and every resolution the test
      leaves out is listed, with the reason, under <a href="#/other" id="meth-excluded">Mechanisms this dataset
      does not count</a> at the foot of the Mechanisms tab. Nothing there enters any figure, chart or
      percentage, but each one keeps its profile, its dates and its reports, so the test can be audited rather
      than taken on trust.</p>

      <h2>How it is coded</h2>
      <p class="prose">The dataset has three parts: the mandating resolutions, the recorded votes, and the
      mechanisms' reports.</p>

      <h3>Resolutions</h3>
      <p class="prose">${RES.length} texts. Each one is coded on:</p>
      <ul class="prose">
        <li>Symbol, date, session and year of adoption.</li>
        <li>The situation, and the body or bodies it concerns.</li>
        <li>What it does to the mandate: founding, renewal, expansion or tasking.</li>
        <li>The mandate paragraphs: their OP numbers, and their text quoted verbatim.</li>
        <li>The action verbs those paragraphs use, from a fixed list of fifteen. A text carries between
          none and thirteen of them.</li>
        <li>The term the text sets: ongoing, 24 months, 12 months, another set term, or none stated.</li>
        <li>The period it tells the body to examine, read off the founding resolution in its own words and
          carried to the body; renewals do not change it. One of three: <b>a specific episode</b>, where the
          text names an event or a bounded stretch of time &#8212; an election, an attack, a set of protests;
          <b>from a date, no end</b>, where it names a start and no closing date; or <b>not stated</b>, where
          it sets no period at all and the body is told what to investigate but not when it happened. A
          mandate bounded by place or by actor rather than by time counts as not stated. The text's own
          wording is shown beside the label.</li>
        <li>The bodies of law the mandate paragraphs name: international human rights law, international
          humanitarian law, international criminal law, or none.</li>
        <li>Its criminal-accountability register, on four values from naming crimes down to no mandate text.</li>
        <li>Whether it refers to gender and to children, with the wording quoted.</li>
        <li>How it was adopted; where there was a recorded vote, the tally and the delegation that called
          for it.</li>
        <li>Its sponsors, from the draft L-document.</li>
        <li>The agenda item, and the position of the State concerned where a record supports it.</li>
      </ul>

      <h3>Recorded votes</h3>
      <p class="prose">${RES.filter(r => r.adoption_mode === "Recorded vote" && votesOf(r.symbol)).length}
      roll-calls. Each carries one position for every State on the roster: yes, no, abstain, absent, or not a
      member of the Council that year. ${(() => {
        // votesOf returns the packed row as a string, one character per State
        let n = 0;
        RES.forEach(r => {
          const v = votesOf(r.symbol);
          if (v) for (let i = 0; i < v.length; i++) if (v[i] !== ".") n++;
        });
        return n.toLocaleString("en-GB");
      })()} positions in all.</p>

      <h3>Reports</h3>
      <p class="prose">${D.documents.length} reports. Each carries its UN symbol, date, type and issuing body,
      and its text is indexed paragraph by paragraph. Search returns the paragraph verbatim; the site never
      paraphrases or generates text.</p>

      <h3>Rules that the fields do not show</h3>
      <ul class="prose">
        <li>A text that renews and expands at once is coded by its strongest effect on the mandate.</li>
        <li>Action verbs are read from the mandate paragraphs only. A paragraph addressed to OHCHR as an
          office &#8212; technical assistance, capacity-building &#8212; carries none; where the Council asks the
          Office to run the investigation itself, OHCHR is the body and its paragraphs are the mandate.</li>
        <li>A mechanism's verbs and legal frameworks are the union of its mandating texts, so a renewal
          inherits the founding language.</li>
        <li>Bodies of law and accountability register are read literally. Naming a body of law is not
          applying it.</li>
        <li>A term written as a condition &#8212; "to the twenty-eighth session", or until a final report &#8212;
          is measured against the record: the closing date of that session, or the date of the next renewal.
          This is what the Sri Lanka series does, and measured out its five texts run 12, 18.5, 24, 12 and
          24 months.</li>
        <li>For a body still running under a renewable term, End Date is the expiry of the current period,
          a future date, not an ending.</li>
        <li>"Without a vote" is the UN category: no member asked for a vote. It does not mean every member
          agreed.</li>
      </ul>

      <h2>Sources and citation</h2>
      <p class="prose">Complete to the close of the Council's 63rd session, 7 October 2026, covering
      ${COUNCIL_BODIES} Council-mandated bodies. Sponsorship lists come from the draft L-documents; for a
      minority of resolutions they are not yet recorded.</p>
      <p class="prose">Compiled and verified against the official UN documents (docs.un.org and the OHCHR Search
      Library) by <b>Helena Rodríguez-Bronchú Carceller</b>. The analytical codings are the author's own, applied
      from the literal text; the verbatim mandate quotes on each resolution card are the coding evidence. Every
      figure links back to the document it comes from.</p>
      <p class="prose"><b>Cite as:</b> Rodríguez-Bronchú Carceller, H., <i>UN Investigative Mandates</i> (2026),
      with the UN document symbol of the resolution or report concerned.</p>`;
    $("#footer").innerHTML = `Dataset: Helena Rodríguez-Bronchú Carceller · compiled from official UN documents
      · last updated on ${esc(fmtLongDate(D.built))}
      · <a href="#/about" id="foot-about">Methodology</a>`;
    $("#foot-about").addEventListener("click", (e) => { e.preventDefault(); setTab("about"); });
    const mx = $("#meth-excluded");
    if (mx) mx.addEventListener("click", (e) => {
      e.preventDefault();
      setTab("mechs", false);
      const fold = $("#excluded-fold");
      if (fold) {
        fold.open = true;
        requestAnimationFrame(() => fold.scrollIntoView({ behavior: "smooth", block: "start" }));
      }
    });
  }

  /* ---------- routing ---------- */
  // Read the hash and show the matching tab. Used at boot and again on every
  // hashchange, so an in-page #/tab link, an edited URL and the Back and Forward
  // buttons all move the tab instead of silently leaving it where it was.
  // setTab and friends write the hash with replaceState, which fires no
  // hashchange, so this cannot loop; the guard is for repeated events.
  function route(h) {
    let m;
    if ((m = /^#\/res\/(.+)$/.exec(h))) {
      setTab("res", false);
      openResolution(decodeURIComponent(m[1]));
    } else if ((m = /^#\/mech\/(.+)$/.exec(h))) {
      setTab("mechs", false);
      openMechanism(decodeURIComponent(m[1]));
    } else if (h === "#/resolutions" || h === "#/votes/resolutions") {
      setTab("res", false);
    } else if ((m = /^#\/votes\/(\w+)(?:\/(.+))?$/.exec(h))) {
      currentSub = ["matrix", "states", "sponsors"].includes(m[1]) ? m[1] : "matrix";
      if (m[2]) currentState = decodeURIComponent(m[2]);
      $$("#votes-subnav > button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.sub === currentSub)));
      const rn2 = $("#mx-rows-nav"); if (rn2) rn2.hidden = currentSub !== "matrix";
      setTab("votes", false);
    } else if (h === "#/reports") {
      setTab("reports");
    } else if (h.startsWith("#/reports/")) {
      // deep link into a document/paragraph: keep the hash for reports.js
      setTab("reports", false);
    } else if (h === "#/present") {
      setTab("present");
    } else if (h === "#/about") {
      setTab("about");
    } else if (h === "#/other") {
      // kept so links shared before the fold still work: open Mechanisms with the
      // excluded disclosure expanded and scrolled to
      setTab("mechs", false);
      const fold = $("#excluded-fold");
      if (fold) {
        fold.open = true;
        requestAnimationFrame(() => fold.scrollIntoView({ behavior: "smooth", block: "start" }));
      }
    } else if (h === "#/mechs") {
      setTab("mechs");
    } else if (h === "#/overview" || h === "#/summary") {
      // "#/summary" is the old name of this tab; links shared before the rename still work
      setTab("overview");
    } else {
      setTab("overview");
    }
  }

  /* ---------- boot ---------- */
  function boot() {
    renderFilters();
    renderAbout();
    lastRoutedHash = location.hash;
    route(location.hash);
    window.addEventListener("hashchange", () => {
      const h = location.hash;
      if (h === lastRoutedHash) return;
      lastRoutedHash = h;
      route(h);
    });
  }
  // One definition of "still running", used by every view. An active fixed-term body
  // has an End Date in the future: that is the expiry of its CURRENT period, not the
  // day it stopped. Testing for the mere presence of an End Date reported eleven
  // running mandates as finished.
  const bodyIsRunning = (b) => !b || !b.end_date || new Date(b.end_date) > new Date();
  const yearsOf = (b) => {
    const y0 = (b.start_date || "").slice(0, 4), y1 = (b.end_date || "").slice(0, 4);
    return y0 ? (y1 ? (y0 === y1 ? y0 : `${y0}–${y1}`) : `${y0}–ongoing`) : "";
  };
  // items the Workspace can save from this module (keyed "r:<symbol>", "m:<short name>")
  window.HRCApp = { openResolution, openMechanism, setTab, esc, fmtDate, unLink, downloadCSV, bySym, bodyByName };
  boot();
})();
