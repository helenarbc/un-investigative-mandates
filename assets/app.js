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
  const fmtDate = (iso) => {
    if (!iso) return "—";
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return iso;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${+m[3]} ${months[+m[2] - 1]} ${m[1]}`;
  };
  const cssVar = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const unLink = (sym) => `https://docs.un.org/en/${sym}`;
  const wsOn = (k) => !!(window.HRCWorkspace && window.HRCWorkspace.has(k));
  const wsBtn = (key, off, on) => `<button class="icon-btn ws-btn" data-ws-key="${esc(key)}" data-ws-off="${off}" data-ws-on="${on}" aria-pressed="${wsOn(key)}">${wsOn(key) ? on : off}</button>`;

  /* ---------- indices ---------- */
  // Reference-only bodies (special procedures with investigative tasks, e.g. the Special
  // Rapporteur on Afghanistan 2021–2026): kept on the site for context, but their
  // resolutions, votes and sponsorships are excluded from every count, chart and filter.
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
  const fwCombo = (r) => {
    const fw = (r.legal_frameworks || []).slice().sort((a, b) => (FW_ORDER[a] ?? 9) - (FW_ORDER[b] ?? 9));
    return fw.length ? fw.join(" + ") : "(none)";
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
  function renderFilters() {
    const yearOpts = (sel) => {
      let o = "";
      for (let y = YEARS.min; y <= YEARS.max; y++) o += opt(String(y), String(y), String(sel));
      return o;
    };
    const MECH_OPTS = D.bodies.filter(b => (b.resolutions || []).length).map(b => b.short_name).sort();
    $("#filterbar").innerHTML = `
      <div class="filter-row">
        <div class="f-item f-search"><label for="f-q">Search</label>
          <input type="search" id="f-q" placeholder="Symbol, title or mechanism…" value="${esc(F.q)}"></div>
        <div class="f-item"><label for="f-y0">From</label><select id="f-y0">${yearOpts(F.y0)}</select></div>
        <div class="f-item"><label for="f-y1">To</label><select id="f-y1">${yearOpts(F.y1)}</select></div>
        <div class="f-item"><label for="f-body">Mechanism</label>
          <select id="f-body">${opt("", "All")}${MECH_OPTS.map(b => opt(b, b, F.body)).join("")}</select></div>
        <div class="f-actions">
          <button class="icon-btn" id="f-more" aria-expanded="false">More filters ▾</button>
          <button class="icon-btn reset-btn" id="f-reset" title="Clear all filters">Reset</button>
        </div>
      </div>
      <div class="filter-row" id="f-adv" hidden>
        <div class="f-item"><label for="f-country">Situation (country)</label>
          <select id="f-country">${opt("", "All")}${COUNTRIES.map(c => opt(c, c, F.country)).join("")}</select></div>
        <div class="f-item"><label for="f-mode">Adoption</label>
          <select id="f-mode">${opt("", "All")}${opt("Recorded vote", "Recorded vote", F.mode)}${opt("Consensus", "Consensus", F.mode)}</select></div>
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
      <div class="filter-note" id="f-note"></div>`;

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
    $("#f-more").addEventListener("click", () => {
      const adv = $("#f-adv");
      adv.hidden = !adv.hidden;
      $("#f-more").setAttribute("aria-expanded", String(!adv.hidden));
      $("#f-more").textContent = adv.hidden ? "More filters ▾" : "More filters ▴";
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
    if (r.adoption_mode !== "Recorded vote") return `<span class="pill mode-consensus">consensus</span>`;
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
  function genderBadges(r) {
    const g = r.gender_language || {};
    const parts = [];
    if ((g.mandate || []).length) parts.push(`<span class="badge on" style="background:var(--c5)" title="Gender language in the mandate: ${esc((g.mandate || []).join(", "))}">G·mandate</span>`);
    else if (genderAll(r).length) parts.push(`<span class="badge" title="Gender language outside the mandate">G</span>`);
    if ((r.children_language || []).length) parts.push(`<span class="badge" title="Children language: ${esc((r.children_language || []).join(", "))}">C</span>`);
    return parts.join(" ");
  }
  const resLink = (r, label) =>
    `<a class="reslink sym" data-sym="${esc(r.symbol)}">${esc(label || r.symbol)}</a>`;

  /* ---------- view: resolutions ---------- */
  let stackBy = "resolution_role";
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
        <div class="tile"><div class="t-label">Adopted by consensus</div><div class="t-value">${consensus}</div></div>
        <div class="tile clickable" id="tile-mechs" title="Open the Mechanisms tab"><div class="t-label">Mechanisms concerned</div><div class="t-value">${bodiesSet.size}</div><div class="t-sub">see the Mechanisms tab</div></div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Adopted by recorded vote or by consensus, per year</h2>
          <span class="count">${recorded.length} by recorded vote (all passed) · ${consensus} by consensus</span></div>
        <div class="panel-body"><div class="chart-host" id="mode-chart"></div><div class="legend" id="mode-legend"></div></div>
        <div class="panel-note">Each column is one year: the lower part counts resolutions put to a recorded vote and
          <b>adopted with a majority of Yes votes</b>, the upper part those adopted by consensus (without a vote). Every recorded
          vote in this dataset passed — a defeated draft never becomes a resolution, so it cannot appear here (the Yemen
          renewal rejected in October 2021 is the best-known example). The narrowest result is 21 in favour, 19 against,
          7 abstaining (resolution 51/27, 2022). Counts reflect the current filters; click a column to focus that year.</div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Resolutions per year</h2>
          <span class="spacer"></span>
          <div class="seg" id="stack-seg">
            <button data-k="resolution_role" aria-pressed="${stackBy === "resolution_role"}">by role</button>
            <button data-k="legal_frameworks" aria-pressed="${stackBy === "legal_frameworks"}">legal frameworks mentioned</button>
          </div>
        </div>
        <div class="panel-body"><div class="chart-host" id="year-chart"></div><div class="legend" id="year-legend"></div></div>
        <div class="panel-note">${stackBy === "resolution_role"
          ? `<b>Founding</b> creates a mechanism; <b>renewal</b> extends it in time; <b>expansion</b> widens the
             investigation itself (e.g. a special inquiry into new events); <b>tasking</b> adds work — extra reports,
             briefings or operational steps — without widening what is investigated.
             Click a column to focus that year.`
          : `Click a column to focus that year. Counts reflect the current filters.`}</div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Resolutions</h2><span class="count">${R.length}</span>
          ${refFiltered().length ? `<span class="count" title="Resolutions on the Special Rapporteur on Afghanistan, shown for reference only; they are not counted in any tile, chart or percentage">+ ${refFiltered().length} shown for reference, not counted</span>` : ""}
          <span class="spacer"></span><details class="menu"><summary class="icon-btn" title="More actions" aria-label="More actions">⋯</summary><div class="menu-list"><button class="menu-item" id="csv-res">Download CSV</button></div></details></div>
        <div class="tblwrap tall" id="res-table"></div>
        <div class="panel-note">Click a row for details, the vote breakdown and links to the UN documents.${refFiltered().length ? ` Rows tagged <span class="badge">reference only</span> are the texts on the Special Rapporteur on Afghanistan: listed for context, excluded from every count above.` : ""}</div>
      </div>`;

    // chart
    const years = [];
    for (let y = F.y0; y <= F.y1; y++) years.push(y);
    const catKeys = stackKeys(R);
    const series = catKeys.map(k => ({
      key: k.key, label: k.label, color: cssVar(k.color),
      values: years.map(y => R.filter(r => r.year === y && stackVal(r) === k.key).length),
    }));
    window.HRCCharts.stackedColumns($("#year-chart"), {
      categories: years.map(String), series, height: 230,
      onBarClick: (ci) => { F.y0 = F.y1 = years[ci]; renderFilters(); update(); },
      tooltip: (ci) => series.map(s => ({ label: s.label, color: s.color, value: s.values[ci] })).filter(x => x.value),
    });
    $("#year-legend").innerHTML = series.map(s =>
      `<span class="lg"><span class="sw" style="background:${s.color}"></span>${esc(s.label)}</span>`).join("");
    // adoption mode per year (always shown)
    const modeSeries = [
      { key: "vote", label: "recorded vote — adopted (Yes majority)", color: cssVar("--c1"),
        values: years.map(y => R.filter(r => r.year === y && r.adoption_mode === "Recorded vote").length) },
      { key: "consensus", label: "consensus (without a vote)", color: cssVar("--c2"),
        values: years.map(y => R.filter(r => r.year === y && r.adoption_mode !== "Recorded vote").length) },
    ];
    window.HRCCharts.stackedColumns($("#mode-chart"), {
      categories: years.map(String), series: modeSeries, height: 200,
      onBarClick: (ci) => { F.y0 = F.y1 = years[ci]; renderFilters(); update(); },
      tooltip: (ci) => modeSeries.map(s => ({ label: s.label, color: s.color, value: s.values[ci] })).filter(x => x.value),
    });
    $("#mode-legend").innerHTML = modeSeries.map(s =>
      `<span class="lg"><span class="sw" style="background:${s.color}"></span>${esc(s.label)}</span>`).join("");
    $("#stack-seg").addEventListener("click", (e) => {
      const k = e.target.dataset && e.target.dataset.k;
      if (!k) return;
      stackBy = k; viewResolutions(filtered());
    });
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

  function stackVal(r) {
    if (stackBy === "legal_frameworks") return fwCombo(r);
    const v = r[stackBy];
    return v || "(not coded)";
  }
  function stackKeys(R) {
    if (stackBy === "resolution_role")
      return [...ROLES.map(x => ({ key: x, label: x, color: ROLE_COLOR[x] })), { key: "(not coded)", label: "not coded", color: "--baseline" }]
        .filter(k => R.some(r => stackVal(r) === k.key));
    if (stackBy === "adoption_mode")
      return [{ key: "Recorded vote", label: "recorded vote", color: "--c1" }, { key: "Consensus", label: "consensus", color: "--c2" }]
        .filter(k => R.some(r => stackVal(r) === k.key));
    // legal frameworks mentioned (each resolution counted once, by combination)
    const order = ["IHRL", "IHRL + IHL", "IHRL + ICL", "IHRL + IHL + ICL", "IHL", "ICL", "(none)"];
    return order.filter(k => R.some(r => fwCombo(r) === k))
      .map(k => ({ key: k, label: k === "(none)" ? "none mentioned" : k, color: FW_COMBO_COLOR[k] || "--baseline" }));
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
      ["resolution_role", "Role"], ["mechanism_type", "Mechanism"],
      ["adoption_mode", "Adoption"], ["criminal_accountability", "Accountability wording"], [null, "Lang."],
    ];
    const rows = sortRows(R.concat(REFR || []));
    $("#res-table").innerHTML = `<table class="data"><thead><tr>${cols.map(([k, l]) =>
      `<th ${k ? `data-sort="${k}"` : 'class="no-sort"'}>${l}${k === sortKey ? ` <span class="dir">${sortDir > 0 ? "↑" : "↓"}</span>` : ""}</th>`).join("")}</tr></thead>
      <tbody>${rows.map(r => `<tr data-sym="${esc(r.symbol)}"${r.reference_only ? ' class="ref-row" style="color:var(--muted)"' : ""}>
        <td>${resLink(r)}${r.reference_only ? ` <span class="badge" title="Shown for reference only (Special Rapporteur on Afghanistan); not counted in any figure">reference only</span>` : ""}</td>
        <td class="num" style="white-space:nowrap">${fmtDate(r.date_adopted)}</td>
        <td>${esc(r.title)}<div style="font-size:12px;color:var(--muted)">${esc((r.bodies || []).join(" · "))}</div></td>
        <td>${roleBadge(r)}</td>
        <td>${esc(r.mechanism_type || "—")}</td>
        <td style="white-space:nowrap">${tallyPills(r)}</td>
        <td>${caBadge(r)}</td>
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
  let matrixRows = "states";      // states | groups
  let matrixCols = "mechanism";   // mechanism (default) | date
  function voteTotals(row, idxs) {
    const t = { Y: 0, N: 0, A: 0, X: 0 };
    for (const si of idxs) { const c = row[si]; if (t[c] !== undefined) t[c]++; }
    return t;
  }
  const totPills = (t) => `<span class="tots">
    <b class="ty" title="Yes votes">${t.Y}</b><b class="tn" title="No votes">${t.N}</b><b class="ta" title="Abstentions">${t.A}</b></span>`;

  function viewMatrix(R) {
    const host = $("#votes-content");
    let recorded = R.filter(r => r.adoption_mode === "Recorded vote" && votesOf(r.symbol));
    if (!recorded.length) {
      host.innerHTML = `<div class="panel"><div class="panel-body">No recorded votes match the current filters
        (${R.length} resolutions selected, all adopted by consensus or without a published roll-call).</div></div>`;
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
            const act = (A.end_date ? 1 : 0) - (B.end_date ? 1 : 0);
            if (act) return act;
            const sd = (B.start_date || "").localeCompare(A.start_date || "");
            if (sd) return sd;
          }
          return (firstDate[bb] || "").localeCompare(firstDate[ba] || "") || ba.localeCompare(bb);
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
          <details class="menu"><summary class="icon-btn">Display options ▾</summary>
            <div class="menu-list">
              <div class="menu-label">Rows</div>
              <div class="seg" id="mx-rows">
                <button data-v="states" aria-pressed="${matrixRows === "states"}">states</button>
                <button data-v="groups" aria-pressed="${matrixRows === "groups"}">regional groups</button>
              </div>
              <div class="menu-label">Columns</div>
              <div class="seg" id="mx-cols">
                <button data-v="mechanism" aria-pressed="${matrixCols === "mechanism"}">by mechanism</button>
                <button data-v="date" aria-pressed="${matrixCols === "date"}">by date</button>
              </div>
            </div>
          </details>
          <span class="legend">
            <span class="lg"><span class="sw" style="background:var(--yes)"></span>Yes</span>
            <span class="lg"><span class="sw" style="background:var(--no)"></span>No</span>
            <span class="lg"><span class="sw" style="background:var(--abstain)"></span>Abstain</span>
            <span class="lg"><span class="sw" style="background:var(--absent)"></span>Absent</span>
          </span>
          <details class="menu"><summary class="icon-btn" title="More actions" aria-label="More actions">⋯</summary><div class="menu-list"><button class="menu-item" id="csv-matrix">Download CSV</button></div></details>
        </div>
        <div class="matrix-wrap" id="matrix-host"></div>
        <div class="panel-note">${matrixRows === "states"
          ? `Rows: Council members that cast at least one vote in the selection, by regional group; the three
             numbers after each name are that state's Yes · No · Abstain totals in the selection. Faint cells:
             the state was not a Council member for that vote.`
          : `Rows: the five UN regional groups; each cell splits the group's members' votes on that resolution
             proportionally (hover for the exact numbers). The three numbers after the group name are its
             Yes · No · Abstain totals in the selection.`}
        Columns: resolutions ${matrixCols === "date" ? "in chronological order" : "grouped by mechanism (in mechanism order)"} —
        hover for the title, click for details.</div>
      </div>`;

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
    } else {
      for (const [gname, g] of groups) {
        const gTot = { Y: 0, N: 0, A: 0, X: 0 };
        let cells = "";
        recorded.forEach((r, ci) => {
          const t = voteTotals(votesOf(r.symbol), g.idxs);
          gTot.Y += t.Y; gTot.N += t.N; gTot.A += t.A; gTot.X += t.X;
          const sum = t.Y + t.N + t.A + t.X;
          if (!sum) { cells += `<td class="cell gcell${blk(ci)}" data-sym="${esc(r.symbol)}" data-group="${esc(gname)}"><i></i></td>`; return; }
          const seg = (n, cls) => n ? `<b class="${cls}" style="height:${Math.max(2, Math.round(n / sum * 26))}px"></b>` : "";
          cells += `<td class="cell gcell${blk(ci)}" data-sym="${esc(r.symbol)}" data-group="${esc(gname)}"
            data-t="${t.Y}|${t.N}|${t.A}|${t.X}"><div class="gstack">${seg(t.Y, "gy")}${seg(t.N, "gn")}${seg(t.A, "ga")}${seg(t.X, "gx")}</div></td>`;
        });
        html += `<tr class="grow"><th class="state" data-group="${esc(gname)}">
          <span class="dotkey" style="background:var(${g.meta.color})"></span>${esc(gname)} ${totPills(gTot)}</th>${cells}</tr>`;
      }
    }
    html += `</tbody></table>`;
    const mh = $("#matrix-host");
    mh.innerHTML = html;
    $("#mx-rows").addEventListener("click", (e) => {
      const v = e.target.dataset && e.target.dataset.v;
      if (v) { matrixRows = v; viewMatrix(filtered()); }
    });
    $("#mx-cols").addEventListener("click", (e) => {
      const v = e.target.dataset && e.target.dataset.v;
      if (v) { matrixCols = v; viewMatrix(filtered()); }
    });

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
        <div class="tile"><div class="t-label">Votes cast (in selection)</div><div class="t-value">${myVotes.length}</div><div class="t-sub">of ${recorded.length} recorded votes</div></div>
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
  const SCOPE_GROUPS = [
    ["HRC investigative mandate", "Mandated by the Human Rights Council"],
    ["OHCHR investigation (broader)", "OHCHR investigations at the Council's request"],
    ["SG-mandated investigation", "Mandated by the Secretary-General"],
    ["GA-mandated mechanism", "Mandated by the General Assembly"],
    ["UNSC-mandated mechanism", "Mandated by the Security Council"],
    [REF_SCOPE, "Special procedures with investigative tasks — shown for reference, not counted"],
  ];
  const docCountByBody = {};
  D.documents.forEach(d => (d.bodies || []).forEach(b => { docCountByBody[b] = (docCountByBody[b] || 0) + 1; }));

  function renderMechs() {
    const host = $("#mechs-content");
    const grouped = new Map(SCOPE_GROUPS.map(([k, label]) => [k, { label, rows: [] }]));
    D.bodies.forEach(b => {
      // GE Darfur lacks a scope value in the source data; it has HRC resolutions,
      // so it belongs with the Council-mandated group
      const key = b.scope || (b.resolutions.length ? "HRC investigative mandate" : "SG-mandated investigation");
      if (!grouped.has(key)) grouped.set(key, { label: key, rows: [] });
      grouped.get(key).rows.push(b);
    });
    const yearsOf = (b) => {
      const y0 = (b.start_date || "").slice(0, 4), y1 = (b.end_date || "").slice(0, 4);
      if (!y0) return "—";
      return y1 ? (y0 === y1 ? y0 : `${y0}–${y1}`) : `${y0}–ongoing`;
    };
    const durationOf = (b) => {
      if (/not implemented/i.test(b.short_name || "")) return "never implemented";
      if (!b.start_date) return "—";
      const a = new Date(b.start_date), z = b.end_date ? new Date(b.end_date) : new Date();
      if (isNaN(a) || isNaN(z)) return "—";
      let months = (z.getFullYear() - a.getFullYear()) * 12 + (z.getMonth() - a.getMonth());
      if (z.getDate() < a.getDate()) months--;
      months = Math.max(0, months);
      const y = Math.floor(months / 12), m = months % 12;
      const parts = [];
      if (y) parts.push(`${y} year${y > 1 ? "s" : ""}`);
      if (m || !y) parts.push(`${m} month${m === 1 ? "" : "s"}`);
      return `${parts.join(" and ")} (${b.end_date ? "ended" : "ongoing"})`;
    };
    const hrcCount = (grouped.get("HRC investigative mandate") || { rows: [] }).rows.length +
      (grouped.get("OHCHR investigation (broader)") || { rows: [] }).rows.length;
    const refCount = (grouped.get(REF_SCOPE) || { rows: [] }).rows.length;
    const counted = D.bodies.length - refCount;
    host.innerHTML = `
      <div class="panel"><div class="panel-body" style="font-size:13.5px;color:var(--ink-2)">
        <b style="color:var(--ink)">${counted} country-specific investigative and accountability mechanisms</b> —
        ${hrcCount} mandated by the Human Rights Council, ${counted - hrcCount} by the Secretary-General, the
        General Assembly or the Security Council${refCount ? `, plus ${refCount} special procedure shown for reference only (not counted)` : ""}.
        Click a name for its mandate, resolutions, votes and reports.
        <details class="more"><summary>What is and is not included</summary>
          <div>The ${hrcCount} Council-mandated bodies (including OHCHR investigations at the Council's request) are the
          mechanisms whose resolutions and votes appear in the Resolutions and Votes tabs. The other
          ${counted - hrcCount} have no HRC resolutions or votes, but their reports are searchable in the
          Reports tab. Thematic mechanisms and country special procedures are outside the dataset, with one exception
          shown for reference: the Special Rapporteur on Afghanistan, which the Council gave fact-finding support (2021) and a
          task to document and preserve information (2022–2026) until the Independent Investigative Mechanism for Afghanistan
          created in October 2025 is operational. Its ${REFRES.length} resolutions, and their votes and sponsorships, are
          excluded from every count, chart and filter on this site.
          Each mechanism's mandate action verbs and legal frameworks (shown when you open it) are the union of its
          HRC mandating resolutions — renewals inherit the founding language; the non-Council bodies are not coded by design.</div></details>
      </div></div>
      ${[...grouped.values()].filter(g => g.rows.length).map(g => `
      <div class="panel">
        <div class="panel-head"><h2>${esc(g.label)}</h2><span class="count">${g.rows.length}</span></div>
        <div class="tblwrap"><table class="data"><thead><tr>
          <th class="no-sort">Mechanism</th><th class="no-sort">Situation</th><th class="no-sort">Active</th>
          <th class="no-sort" title="From the start of the mandate to its end, or to today if it is still running">Duration</th>
          <th class="no-sort">Explore</th></tr></thead>
        <tbody>${g.rows.sort((a, b) =>
          ((a.end_date ? 1 : 0) - (b.end_date ? 1 : 0)) ||
          (b.start_date || "").localeCompare(a.start_date || "")).map(b => {
          const nres = (b.resolutions || []).length;
          const ndocs = docCountByBody[b.short_name] || 0;
          const isRef = b.scope === REF_SCOPE;
          return `<tr>
            <td><a class="mech-open" data-body="${esc(b.short_name)}" style="cursor:pointer"><b>${esc(b.short_name)}</b></a>
              ${isRef ? `<span class="badge" style="margin-left:4px" title="Shown for reference; not counted in any statistic">reference only</span>` : ""}
              ${!b.end_date && b.start_date ? `<span class="badge on" style="background:var(--c2);margin-left:4px">active</span>` : ""}
              <div style="font-size:12px;color:var(--muted)">${esc(b.full_name || "")}</div></td>
            <td>${esc(countryName(b.country) || "—")}</td>
            <td style="white-space:nowrap">${yearsOf(b)}</td>
            <td style="white-space:nowrap">${durationOf(b)}</td>
            <td style="white-space:nowrap">
              ${isRef ? `<span style="color:var(--muted)">${nres} resolution${nres > 1 ? "s" : ""} (reference only)</span>`
                : nres ? `<a class="mech-res" data-body="${esc(b.short_name)}">${nres} resolution${nres > 1 ? "s" : ""}</a>
                <br><a class="mech-votes" data-body="${esc(b.short_name)}">votes</a>` : `<span style="color:var(--muted)">no HRC resolutions</span>`}
              ${ndocs ? `<br><a class="mech-reports" data-body="${esc(b.short_name)}">${ndocs} report${ndocs > 1 ? "s" : ""}</a>` : ""}
            </td>
          </tr>`;
        }).join("")}</tbody></table></div>
      </div>`).join("")}
`;
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
    const active = y0 ? (y1 ? (y0 === y1 ? y0 : `${y0}–${y1}`) : `${y0}–ongoing`) : "—";
    $("#modal").innerHTML = `
      <div class="modal-head">
        <div><h3>${esc(b.full_name || name)}</h3>
          <div class="sym">${esc(name)} · ${esc(countryName(b.country) || "")} · ${active}</div></div>
        ${wsBtn("m:" + name, "☆ Save", "★ Saved")}
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
        click a column for the full card. Grey stubs: adopted by consensus (no vote).</div>
        ${mres.some(r => r.adoption_mode === "Recorded vote" && votesOf(r.symbol)) ? `
        <h4 style="margin:14px 0 4px;font-size:13px">How each regional group voted, resolution by resolution</h4>
        <div class="chart-host" id="mech-groups"></div>
        <div class="legend" id="mech-groups-legend"></div>
        <div style="font-size:12px;color:var(--muted);margin-top:4px">Each line is one UN regional group: the share of its
        Council members voting <b>in favour</b> (out of those voting Yes, No or Abstain), one point per recorded vote, oldest
        to newest. Hover a point for the group's Yes · No · Abstain; click it for the resolution. Consensus adoptions have no
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
        { key: "C", label: "consensus (no vote)", color: cssVar("--baseline"),
          values: mres.map(r => r.adoption_mode === "Recorded vote" ? 0 : 4) },
      ];
      window.HRCCharts.stackedColumns($("#mech-evo"), {
        categories: cats, series, height: 200, labelWidth: 88,
        onBarClick: (ci) => openResolution(mres[ci].symbol),
        tooltip: (ci) => {
          const r = mres[ci];
          if (r.adoption_mode !== "Recorded vote")
            return [{ label: "Adopted without a vote (consensus)", value: "" }, { label: fmtDate(r.date_adopted), value: "" }];
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
        ${wsBtn("r:" + r.symbol, "☆ Save", "★ Saved")}
        <button class="modal-close" id="modal-close" aria-label="Close">✕</button>
      </div>
      <div class="modal-body">
        ${r.reference_only ? `<div class="panel-note" style="margin:0 0 10px;border:1px solid var(--grid);border-radius:6px;padding:8px 10px">
          <b>Reference only.</b> This resolution concerns the Special Rapporteur on Afghanistan, a special procedure shown
          on this site for context; it is not counted in any statistic, chart or filter.</div>` : ""}
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          ${r.adoption_mode === "Recorded vote"
            ? `${tallyPills(r)} <span style="color:var(--muted);font-size:12.5px">yes–no–abstain</span>`
            : `<span class="pill mode-consensus">adopted without a vote</span>`}
          ${roleBadge(r)} ${caBadge(r)}
          ${(r.legal_frameworks || []).map(f => `<span class="badge" title="${esc(FW_TITLE[f] || "")}">${esc(f)}</span>`).join(" ")}
        </div>
        <div class="meta-grid">
          <div class="m"><b>Mechanism</b>${esc(r.mechanism_type || "—")}</div>
          <div class="m"><b>Bodies</b>${esc((r.bodies || []).join(", ") || "—")}</div>
          <div class="m"><b>Mandate paragraphs</b>${esc(r.mandate_paragraphs || "—")}</div>
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
  let currentTab = "mechs", currentSub = "matrix";
  function setTab(tab, push) {
    currentTab = tab;
    $$(".tabbar .tab").forEach(b => b.setAttribute("aria-selected", String(b.dataset.tab === tab)));
    $$(".view").forEach(v => v.classList.toggle("active", v.id === "view-" + tab));
    if (push !== false) history.replaceState(null, "",
      tab === "res" ? "#/resolutions" : "#/" + tab + (tab === "votes" ? "/" + currentSub : ""));
    // the one filter bar serves both the Resolutions and the Votes tab
    if (tab === "res" || tab === "votes") {
      const slot = $(tab === "res" ? "#fb-slot-res" : "#fb-slot-votes");
      const fb = $("#filterbar");
      if (fb && fb.parentElement !== slot) slot.appendChild(fb);
      update();
    }
    if (tab === "reports" && window.HRCReports) window.HRCReports.activate();
    if (tab === "mechs") renderMechs();
  }
  function setSub(sub) {
    currentSub = sub;
    if (currentTab !== "votes") { setTab("votes"); }
    $$("#votes-subnav button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.sub === sub)));
    history.replaceState(null, "", "#/votes/" + sub);
    update();
  }
  $$(".tabbar .tab").forEach(b => b.addEventListener("click", () => setTab(b.dataset.tab)));
  $$("#votes-subnav button").forEach(b => b.addEventListener("click", () => setSub(b.dataset.sub)));

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
    const note = $("#f-note");
    if (note) note.textContent = `${R.length} of ${RES.length} resolutions selected — ${filterSummary()}.` +
      (REFRES.length ? ` (${REFRES.length} reference-only texts on the Special Rapporteur on Afghanistan are not counted — see Mechanisms.)` : "");
    if (currentTab === "res") viewResolutions(R);
    else if (currentTab === "votes") {
      if (currentSub === "matrix") viewMatrix(R);
      else if (currentSub === "states") viewStates(R);
      else if (currentSub === "sponsors") viewSponsors(R);
    }
  }

  /* ---------- about + footer ---------- */
  function renderAbout() {
    $("#about-content").innerHTML = `
      <h2>What this is</h2>
      <p>An explorer of the United Nations Human Rights Council's country-specific
      <b>investigative and accountability mandates</b> (2006–2026): the resolutions that create,
      renew, expand or task them, how every Council member voted, who sponsored them, and the
      language of the mandates themselves — including how they address criminal accountability,
      gender and children. The <b>Reports</b> tab searches the mechanisms' own reports paragraph
      by paragraph and returns only verbatim text with citations.</p>
      <p><button class="icon-btn" onclick="window.HRCTour && HRCTour.start()">? Take the one-minute tour</button></p>
      <h2>Your workspace</h2>
      <p>While you read, save paragraphs (Reports tab), resolutions and mechanisms with the <b>Save</b> buttons.
      They collect in the <b>☆ Workspace</b> (top right), where you can add a note to each item, copy all the
      citations, download the selection as a text file or a spreadsheet, or copy a link that opens the same
      selection for a colleague. The workspace lives only in your browser — nothing is sent anywhere.</p>
      <h2>What is included</h2>
      <p>Every HRC resolution or decision adopted 2006–2026 (in regular session, special session
      or organizational meeting) that <b>(a) establishes</b> a country-specific investigative or
      accountability mechanism — a commission of inquiry, fact-finding mission, group, team or
      committee of experts, or an OHCHR investigation, examination, monitoring or accountability
      mandate conducted at the Council's request; <b>(b) renews or extends</b> such a mechanism;
      or <b>(c) assigns it new</b> investigative, monitoring, evidence-preservation or reporting
      tasks.</p>
      <p><b>Not included:</b> thematic mechanisms, country special-procedures mandates (Special
      Rapporteurs and Independent Experts) unless the same text also does (a)–(c), resolutions
      that merely welcome a mechanism's report or urge cooperation, and UPR outcome decisions.
      One special procedure is shown <b>for reference only</b> and excluded from every figure: the
      Special Rapporteur on Afghanistan, which the Council gave fact-finding support (2021) and a task
      to document and preserve information (2022–2026) until the Independent Investigative Mechanism for
      Afghanistan, created in October 2025, is operational.
      The Mechanisms and Reports tabs additionally cover related investigative bodies mandated by
      the General Assembly, the Security Council or the Secretary-General for the same country
      situations; those bodies have no HRC resolutions or votes.</p>
      <h2>Data</h2>
      <p>The dataset covers ${RES.length} resolutions and decisions (complete to the end of the Council's
      63rd session, 7 October 2026), ${D.bodies.length - REF_BODIES.size} investigative bodies,
      ${RES.filter(r => r.adoption_mode === "Recorded vote" && votesOf(r.symbol)).length} recorded
      votes with country-by-country positions, sponsorship lists, and the mechanisms' public reports.
      It was compiled and verified against the official UN documents (docs.un.org and the OHCHR
      Search Library) by <b>Helena Rodríguez-Bronchú Carceller</b>; every figure on this site links
      back to the document it comes from.
      Analytical codings (resolution role, criminal-accountability wording, mandate action verbs,
      legal frameworks, gender and children language) are the author's own, applied from the
      resolutions' literal text; the verbatim mandate quotes shown in each resolution card are the
      coding evidence.</p>
      <p><b>Cite as:</b> Rodríguez-Bronchú Carceller, H., <i>UN Investigative Mandates</i> (2026),
      with the UN document symbol of the resolution or report concerned.</p>
      <h2>Method notes</h2>
      <ul>
        <li><b>Resolution roles.</b> Each resolution is coded by what it does to the mechanism:
        <i>founding</i> — creates it; <i>renewal</i> — extends its mandate in time;
        <i>expansion</i> — widens the investigation itself, typically by ordering an additional
        special inquiry into specific new events (as for El-Houleh and Aleppo in Syria);
        <i>tasking</i> — gives it additional work, such as extra reports, briefings or operational
        steps, without widening what it investigates. A resolution can renew and expand at once;
        it is coded by its strongest effect on the mandate.</li>
        <li>Vote tallies follow the official adoption record; the roll-call lists shown are the
        official annexes.</li>
        <li>"Consensus" means adopted without a vote.</li>
        <li>Mechanism-level codings (action verbs, legal frameworks) are the union of the
        mechanism's mandating resolutions, so renewals inherit the founding language.</li>
        <li><b>Criminal-accountability wording</b> is coded literally from the mandate paragraphs, one
        value per text: <i>names crimes or criminal proceedings</i> — the text uses the word crime(s) or
        criminal-justice vocabulary (crimes against humanity, war crimes, genocide, criminal or command
        responsibility, criminal prosecutions or proceedings, the International Criminal Court, legal
        proceedings); <i>accountability or perpetrators wording only</i> — accountability, impunity, those
        responsible or perpetrators, without naming crimes; <i>none</i>; <i>no mandate text</i> — renewals
        that only extend the mandate "as set out in" an earlier text. The "ICL" legal-framework tag on a
        resolution follows the same rule. No mandate paragraph in the dataset contains the phrase
        "international criminal law".</li>
        <li>Sponsorship lists come from the draft L-documents and their addenda; for a minority of
        resolutions no sponsor list has been recorded yet.</li>
        <li>In the Reports tab, search is verbatim only — the site never paraphrases or generates
        text. Paragraph numbers are the printed UN paragraph numbers wherever they exist;
        documents without numbered paragraphs are flagged.</li>
      </ul>
      <h2>Credits</h2>
      <p>Design and interaction concepts inspired by Łukasz Szoszkiewicz's
      <a href="https://lszoszk.github.io/hrc-voting/" target="_blank" rel="noopener">HRC voting explorer</a> and
      <a href="https://lszoszk.github.io/generalcomments/" target="_blank" rel="noopener">UN Human Rights Database</a>
      — warmly acknowledged. This site's code is an independent implementation.</p>
      <p>Built as a static, dependency-free site; it works offline and collects no analytics.</p>`;
    $("#footer").innerHTML = `Dataset: Helena Rodríguez-Bronchú Carceller · compiled from official UN documents
      · build ${esc((D.built || "").slice(0, 10))}
      · <a href="#/about" id="foot-about">About &amp; method</a>`;
    $("#foot-about").addEventListener("click", (e) => { e.preventDefault(); setTab("about"); });
  }

  /* ---------- theme ---------- */
  const themeBtn = $("#theme-toggle");
  function applyTheme(t) {
    if (t === "dark") document.documentElement.setAttribute("data-theme", "dark");
    else document.documentElement.removeAttribute("data-theme");
    try { localStorage.setItem("hrc-theme", t); } catch (e) { /* file:// private mode */ }
  }
  themeBtn.addEventListener("click", () => {
    applyTheme(document.documentElement.hasAttribute("data-theme") ? "light" : "dark");
    update(); // re-render charts so SVG picks up new colors
  });
  let savedTheme = null;
  try { savedTheme = localStorage.getItem("hrc-theme"); } catch (e) { /* unavailable */ }
  if (savedTheme === "dark" || (!savedTheme && matchMedia("(prefers-color-scheme: dark)").matches)) applyTheme("dark");

  /* ---------- boot ---------- */
  function boot() {
    renderFilters();
    renderAbout();
    const h = location.hash;
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
      $$("#votes-subnav button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.sub === currentSub)));
      setTab("votes", false);
    } else if (h === "#/reports") {
      setTab("reports");
    } else if (h.startsWith("#/reports/")) {
      // deep link into a document/paragraph: keep the hash for reports.js
      setTab("reports", false);
    } else if (h.startsWith("#/workspace")) {
      // shared selection or the drawer itself: workspace.js reads the hash
      setTab("mechs", false);
    } else if (h === "#/about") {
      setTab("about");
    } else {
      setTab("mechs");
    }
  }
  const yearsOf = (b) => {
    const y0 = (b.start_date || "").slice(0, 4), y1 = (b.end_date || "").slice(0, 4);
    return y0 ? (y1 ? (y0 === y1 ? y0 : `${y0}–${y1}`) : `${y0}–ongoing`) : "";
  };
  // items the Workspace can save from this module (keyed "r:<symbol>", "m:<short name>")
  const wsItems = {
    r: (sym) => {
      const r = bySym.get(sym);
      if (!r) return null;
      return { sym, title: r.title || "", date: fmtDate(r.date_adopted), mode: r.adoption_mode || "",
        tally: r.tally || "", bodies: r.bodies || [], role: r.resolution_role || "", unlink: unLink(sym) };
    },
    m: (name) => {
      const b = bodyByName.get(name);
      if (!b) return null;
      return { name, full_name: b.full_name || "", country: countryName(b.country) || "", years: yearsOf(b),
        verbs: (b.mandate_action_verbs || []).join(", "), frameworks: (b.mandate_legal_frameworks || []).join(", "),
        link: b.links || "" };
    },
  };
  window.HRCApp = { openResolution, openMechanism, setTab, esc, fmtDate, unLink, downloadCSV, bySym, bodyByName, wsItems };
  boot();
})();
