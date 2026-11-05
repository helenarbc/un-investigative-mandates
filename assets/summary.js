/* HRC Investigative Mandates — "Summary graphs" tab.
   Presentation-ready charts, drawn live from window.HRC_DATA (never pasted images),
   each with a Download PNG button (2x, white background).

   CHARTS ON THIS TAB
     A. Resolutions per year, by role          — stacked columns, 2006-2026
     B. Texts and bodies per situation         — horizontal bars + bodies column
     C. Bodies running at the same time        — columns per calendar year, 2006-2026
     D. The term each mandate sets             — stacked columns, counts or shares
     E. Task verbs per founding mandate        — dot chart with yearly means
     F. Four features of each founding mandate — dot matrix, one column per text
     G. The fifteen task verbs                 — table: counts, first use, wording
     E2. Task verbs: what rose is the floor    — same texts as E, read as two bands
     H. Groups named vs groups instructed      — paired horizontal bars
     I. How texts were adopted                — stacked columns, counts or shares
     J. How States voted                      — average Yes / abstentions / No per voted text

   To add one: append an entry to CARDS at the bottom ({id, build(host)}) and a
   draw function above it. Nothing else needs touching.

   This file registers itself: it watches #view-summary for the .active class that
   app.js toggles, so no change to app.js's router is needed.

   Original code for this project (2026). */
(function () {
  "use strict";
  const D = window.HRC_DATA;
  if (!D) return;

  const NS = "http://www.w3.org/2000/svg";
  const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  /* ---------------- palette ---------------- */
  // Fixed series colours (identical in light and dark mode).
  const ROLE_COLOR = { founding: "#4a77d4", renewal: "#4faf7a", expansion: "#4d39a6", tasking: "#e0a21c" };
  const REGION_COLOR = {
    "Africa": "#2a78d6",
    "Asia-Pacific (incl. Middle East)": "#eb6834",
    "Eastern Europe": "#1baf7a",
    "Latin America": "#eda100",
    "Western European and others": "#8a5cc7",
  };
  const C_RECENT = "#2a78d6", C_EARLY = "#86b6ef";

  // Chrome colours: from the stylesheet on screen, forced light for PNG export.
  const LIGHT = { ink: "#0b0b0b", ink2: "#52514e", muted: "#898781", grid: "#e1e0d9", baseline: "#c3c2b7" };
  let PAL = LIGHT;
  function screenPalette() {
    const cs = getComputedStyle(document.documentElement);
    const v = (n, f) => (cs.getPropertyValue(n).trim() || f);
    return {
      ink: v("--ink", LIGHT.ink), ink2: v("--ink-2", LIGHT.ink2), muted: v("--muted", LIGHT.muted),
      grid: v("--grid", LIGHT.grid), baseline: v("--baseline", LIGHT.baseline),
    };
  }

  /* ---------------- svg helpers ---------------- */
  function el(name, attrs) {
    const n = document.createElementNS(NS, name);
    let tip = null;
    for (const k in attrs) {
      if (k === "_tip") { tip = attrs[k]; continue; }
      if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
    }
    // "_tip" attaches a native SVG <title>: the browser shows it on hover, it needs
    // no library and it survives into the downloaded SVG. Used on every data mark so
    // the figures behind the chart can be read without opening the data tabs.
    if (tip) {
      const t = document.createElementNS(NS, "title");
      t.textContent = tip;
      n.appendChild(t);
      n.setAttribute("cursor", "help");
    }
    return n;
  }
  const plural = (n, one, many) => n + " " + (n === 1 ? one : (many || one + "s"));
  function svgRoot(W, H) {
    return el("svg", {
      xmlns: NS, viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img",
      "font-family": FONT, style: "display:block;max-width:100%;height:auto",
    });
  }
  function text(parent, s, attrs) {
    const t = el("text", attrs);
    t.textContent = s;
    parent.appendChild(t);
    return t;
  }
  // Rough advance width, good enough to decide whether a label fits.
  const textW = (s, size) => String(s).length * size * 0.58;
  // Wrap a string on word boundaries so it never runs off the canvas.
  function wrapTo(str, size, width) {
    const out = [];
    String(str).split(" ").forEach(w => {
      const last = out.length - 1;
      const test = last >= 0 ? out[last] + " " + w : w;
      if (last >= 0 && textW(test, size) <= width) out[last] = test;
      else out.push(w);
    });
    return out;
  }

  /* ---------------- counting rules ---------------- */
  // 1. Texts: every resolution/decision except the Special Rapporteur on Afghanistan
  //    reference-only texts (bodies === ['SR Afghanistan']).
  const isSrOnly = (r) => (r.bodies || []).length === 1 && r.bodies[0] === "SR Afghanistan";
  const TEXTS = D.resolutions.filter(r => !isSrOnly(r));

  // 2. Council-mandated bodies: HRC investigative mandates + broader OHCHR investigations.
  const COUNCIL_SCOPES = new Set(["HRC investigative mandate", "OHCHR investigation (broader)"]);
  const BODIES = D.bodies.filter(b => COUNCIL_SCOPES.has(b.scope));

  // 3. Situations: distinct country values among those bodies. The source data uses
  //    both "DRC" and the full name for one of them, so normalise as the rest of the site does.
  const COUNTRY_ALIAS = { "DRC": "Democratic Republic of the Congo" };
  const situationOf = (c) => COUNTRY_ALIAS[c] || c;
  // Display-only label fixes (the stored value keeps its spelling; nothing is written back).
  const DISPLAY_LABEL = {
    "Cote d’Ivoire": "Côte d’Ivoire",
    "Cote d'Ivoire": "Côte d’Ivoire",
    "Democratic Republic of the Congo": "DR Congo",
    "Central African Republic": "Central African Rep.",
    "Sudan": "Sudan (incl. Darfur)",
    "OPT and Israel": "OPT / Israel",
  };
  const label = (s) => DISPLAY_LABEL[s] || s;

  const SITUATIONS = [...new Set(BODIES.map(b => situationOf(b.country)).filter(Boolean))];

  // 5. A body runs in year Y if start year <= Y <= end year; a null end date runs to the
  //    last year of the dataset. The never-implemented 2006 OPT mission is excluded.
  const NOT_IMPLEMENTED = "FFM OPT (2006, not implemented)";
  const RUNNING = BODIES.filter(b => b.short_name !== NOT_IMPLEMENTED);

  const YEAR_MIN = 2006;
  const YEAR_MAX = Math.max(...TEXTS.map(r => r.year || 0));
  const YEARS = [];
  for (let y = YEAR_MIN; y <= YEAR_MAX; y++) YEARS.push(y);

  const REGION_OF = (() => {
    const m = new Map();
    const put = (region, names) => names.forEach(n => m.set(n, [].concat(m.get(n) || [], region)));
    put("Africa", ["South Sudan", "Sudan", "Sudan (incl. Darfur)", "Libya", "Burundi",
      "Democratic Republic of the Congo", "DRC", "Eritrea", "Ethiopia",
      "Cote d’Ivoire", "Côte d'Ivoire", "Côte d’Ivoire", "Central African Republic", "Central African Rep."]);
    put("Asia-Pacific (incl. Middle East)", ["Syria", "OPT and Israel", "OPT / Israel", "DPRK",
      "Sri Lanka", "Myanmar", "Yemen", "Iran", "Lebanon", "Iraq", "Afghanistan"]);
    put("Eastern Europe", ["Belarus", "Ukraine"]);
    put("Latin America", ["Venezuela", "Nicaragua"]);
    // Israel has sat with the Western European and others group in Geneva since 1 January 2014
    put("Western European and others", ["OPT and Israel", "OPT / Israel"]);
    return (s) => m.get(s) || null;
  })();

  /* ---------------- derived series ---------------- */
  const ROLES = ["founding", "renewal", "expansion", "tasking"];
  const ROLE_TIP = {
    founding: "create a mechanism",
    renewal: "extend one without new tasks",
    expansion: "add new tasks to one",
    tasking: "task an existing one",
  };

  const A_DATA = (() => {
    const per = new Map(YEARS.map(y => [y, [0, 0, 0, 0]]));
    const unroled = [];
    TEXTS.forEach(r => {
      const y = r.year || +String(r.date_adopted || "").slice(0, 4);
      const i = ROLES.indexOf(r.resolution_role);
      if (i < 0) { unroled.push(r.symbol); return; }
      if (per.has(y)) per.get(y)[i]++;
    });
    const totals = ROLES.map((_, i) => YEARS.reduce((a, y) => a + per.get(y)[i], 0));
    return { per, totals, unroled, total: TEXTS.length };
  })();

  const B_DATA = (() => {
    const countryByBody = new Map(BODIES.map(b => [b.short_name, situationOf(b.country)]));
    const texts = new Map(SITUATIONS.map(s => [s, 0]));
    const bodies = new Map(SITUATIONS.map(s => [s, 0]));
    BODIES.forEach(b => {
      const s = situationOf(b.country);
      if (s) bodies.set(s, bodies.get(s) + 1);
    });
    let unassigned = 0;
    TEXTS.forEach(r => {
      const s = (r.bodies || []).map(n => countryByBody.get(n)).find(Boolean);
      if (!s) { unassigned++; return; }
      texts.set(s, texts.get(s) + 1);
    });
    const rows = SITUATIONS.slice()
      .sort((a, b) => texts.get(b) - texts.get(a) || bodies.get(b) - bodies.get(a) || a.localeCompare(b))
      .map(s => ({ situation: s, texts: texts.get(s), bodies: bodies.get(s), regions: REGION_OF(s) || [] }));
    const regionCounts = Object.keys(REGION_COLOR).map(r =>
      ({ region: r, n: rows.filter(x => x.regions.indexOf(r) >= 0).length }));
    const top4 = rows.slice(0, 4);
    return {
      rows, unassigned, regionCounts,
      totalTexts: rows.reduce((a, r) => a + r.texts, 0),
      totalBodies: rows.reduce((a, r) => a + r.bodies, 0),
      top4,
      top4Texts: top4.reduce((a, r) => a + r.texts, 0),
      top4Bodies: top4.reduce((a, r) => a + r.bodies, 0),
    };
  })();

  const C_DATA = (() => {
    const startY = (b) => +String(b.start_date || "").slice(0, 4) || null;
    const endY = (b) => (b.end_date ? +String(b.end_date).slice(0, 4) : YEAR_MAX);
    const values = YEARS.map(y => RUNNING.filter(b => {
      const s = startY(b);
      return s && s <= y && y <= endY(b);
    }).length);
    const openEnded = RUNNING.filter(b => !b.end_date);
    const since2021 = YEARS.map((y, i) => (y >= 2021 ? values[i] : null)).filter(v => v !== null);
    return {
      values, openEnded,
      first: values[0], firstYear: YEARS[0],
      recentMin: Math.min(...since2021), recentMax: Math.max(...since2021),
    };
  })();

  /* ---------------- text helpers ---------------- */
  const WORDS = ["zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
    "Twenty", "Twenty-one", "Twenty-two", "Twenty-three", "Twenty-four", "Twenty-five", "Twenty-six",
    "Twenty-seven", "Twenty-eight", "Twenty-nine", "Thirty"];
  const word = (n) => (WORDS[n] || String(n));
  const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);

  const MONTHS = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  const BUILD_DATE = (() => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(D.built || ""));
    return m ? `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}` : String(D.built || "unknown date");
  })();
  const SOURCE_LINE = `Source: HRC investigative mandates dataset, build of ${BUILD_DATE} ` +
    `(${TEXTS.length} texts, ${BODIES.length} bodies, ${SITUATIONS.length} situations).`;

  /* ---------------- chart A ---------------- */
  function drawA(host) {
    const W = Math.max(host.clientWidth || 960, 300);
    const padL = 34, padR = 10, padT = 24, padB = 26;
    const H = Math.max(260, Math.min(340, Math.round(W * 0.30)));
    const iw = W - padL - padR, ih = H - padT - padB;
    const totals = YEARS.map(y => A_DATA.per.get(y).reduce((a, b) => a + b, 0));
    const yMax = Math.max(4, Math.ceil((Math.max(...totals) + 1) / 4) * 4);
    const svg = svgRoot(W, H);

    for (let t = 0; t <= 4; t++) {
      const y = padT + ih - ih * t / 4;
      svg.appendChild(el("line", { x1: padL, x2: W - padR, y1: y, y2: y, stroke: PAL.grid, "stroke-width": 1 }));
      text(svg, Math.round(yMax * t / 4), { x: padL - 6, y: y + 4, "text-anchor": "end", "font-size": 11, fill: PAL.muted });
    }

    const slot = iw / YEARS.length;
    const bw = Math.max(5, Math.min(30, slot - 6));
    const segFont = Math.max(8, Math.min(12, bw * 0.46));
    const yearFont = Math.max(8, Math.min(11.5, slot * 0.42));
    const showSeg = bw >= 14;

    YEARS.forEach((yr, i) => {
      const vals = A_DATA.per.get(yr);
      const x = padL + slot * i + (slot - bw) / 2;
      let yCur = padT + ih;
      vals.forEach((v, k) => {
        if (!v) return;
        const h = ih * v / yMax;
        svg.appendChild(el("rect", { x, y: yCur - h, width: bw, height: Math.max(1, h - 1), rx: 1.5,
          fill: ROLE_COLOR[ROLES[k]],
          _tip: `${yr} — ${plural(v, "text")} that ${ROLE_TIP[ROLES[k]]}\n${totals[i]} in ${yr} in all` }));
        if (showSeg && h >= segFont * 1.5) {
          text(svg, v, {
            x: x + bw / 2, y: yCur - h / 2 + segFont * 0.36, "text-anchor": "middle",
            "font-size": segFont, "font-weight": 600, fill: "#ffffff",
          });
        }
        yCur -= h;
      });
      if (totals[i]) {
        text(svg, totals[i], {
          x: x + bw / 2, y: padT + ih - ih * totals[i] / yMax - 6, "text-anchor": "middle",
          "font-size": Math.max(8.5, segFont), "font-weight": 650, fill: PAL.ink,
        });
      }
      const every = slot < 20 ? 5 : 1;
      if (i % every === 0 || i === YEARS.length - 1) {
        text(svg, yr, { x: x + bw / 2, y: H - 8, "text-anchor": "middle", "font-size": yearFont, fill: PAL.ink2 });
      }
    });
    svg.appendChild(el("line", { x1: padL, x2: W - padR, y1: padT + ih, y2: padT + ih, stroke: PAL.baseline, "stroke-width": 1 }));
    host.textContent = "";
    host.appendChild(svg);
  }

  const A_LEGEND = [
    ["founding", "founding — creates a mechanism"],
    ["renewal", "renewal — extends it in time"],
    ["expansion", "expansion — widens the investigation itself"],
    ["tasking", "tasking — adds work without widening what is investigated"],
  ];

  /* ---------------- chart B ---------------- */
  function drawB(host) {
    const W = Math.max(host.clientWidth || 960, 300);
    const narrow = W < 560;
    const rows = B_DATA.rows;
    const rowH = narrow ? 23 : 26, barH = narrow ? 12 : 14;
    const headH = 18;
    const H = headH + rows.length * rowH + 6;
    const labelW = narrow ? Math.min(118, W * 0.38) : Math.min(188, W * 0.27);
    const maxBodies = Math.max(...rows.map(r => r.bodies));
    const dotR = narrow ? 2.4 : 3;
    const dotPitch = dotR * 2 + 1.6;
    const bodiesW = (narrow ? 20 : 24) + maxBodies * dotPitch + 6;
    const valueW = narrow ? 26 : 30;
    const iw = Math.max(40, W - labelW - valueW - bodiesW - 8);
    const max = Math.max(...rows.map(r => r.texts));
    const fontRow = narrow ? 10.5 : 12.5;
    const svg = svgRoot(W, H);

    text(svg, "Texts", { x: labelW + 2, y: 12, "font-size": narrow ? 9.5 : 11, fill: PAL.muted });
    text(svg, "Bodies", { x: W - bodiesW + (narrow ? 0 : 2), y: 12, "font-size": narrow ? 9.5 : 11, fill: PAL.muted });

    rows.forEach((r, i) => {
      const y = headH + i * rowH;
      const cy = y + barH / 2;
      text(svg, label(r.situation), {
        x: labelW - 8, y: cy + fontRow * 0.35, "text-anchor": "end", "font-size": fontRow, fill: PAL.ink,
      });
      const w = iw * r.texts / max;
      const regs = r.regions.length ? r.regions : [null];
      const sh = barH / regs.length;
      regs.forEach((rg, k) => {
        svg.appendChild(el("rect", {
          x: labelW, y: y + k * sh, width: Math.max(2, w), height: sh,
          rx: regs.length === 1 ? 2 : 0, fill: REGION_COLOR[rg] || PAL.baseline,
          _tip: `${label(r.situation)}\n${plural(r.texts, "text")}, ${plural(r.bodies, "body", "bodies")}` +
            (rg ? `\nRegional group: ${rg}` : ""),
        }));
      });
      text(svg, r.texts, {
        x: labelW + w + 5, y: cy + fontRow * 0.35, "font-size": fontRow, "font-weight": 600, fill: PAL.ink,
      });
      const bx = W - bodiesW;
      text(svg, r.bodies, { x: bx, y: cy + fontRow * 0.35, "font-size": fontRow, fill: PAL.ink2 });
      for (let k = 0; k < r.bodies; k++) {
        svg.appendChild(el("circle", {
          cx: bx + (narrow ? 14 : 18) + dotR + k * dotPitch, cy, r: dotR,
          fill: REGION_COLOR[r.regions[0]] || PAL.baseline, opacity: 0.75,
          _tip: `${label(r.situation)} — ${plural(r.bodies, "body", "bodies")} in all`,
        }));
      }
    });
    host.textContent = "";
    host.appendChild(svg);
  }

  /* ---------------- chart C ---------------- */
  function drawC(host) {
    const W = Math.max(host.clientWidth || 960, 300);
    const padL = 32, padR = 10, padT = 22, padB = 26;
    const H = Math.max(240, Math.min(320, Math.round(W * 0.28)));
    const iw = W - padL - padR, ih = H - padT - padB;
    const yMax = Math.max(4, Math.ceil((Math.max(...C_DATA.values) + 1) / 4) * 4);
    const svg = svgRoot(W, H);

    for (let t = 0; t <= 4; t++) {
      const y = padT + ih - ih * t / 4;
      svg.appendChild(el("line", { x1: padL, x2: W - padR, y1: y, y2: y, stroke: PAL.grid, "stroke-width": 1 }));
      text(svg, Math.round(yMax * t / 4), { x: padL - 6, y: y + 4, "text-anchor": "end", "font-size": 11, fill: PAL.muted });
    }
    const slot = iw / YEARS.length;
    const bw = Math.max(6, Math.min(32, slot - 6));
    const valFont = Math.max(8, Math.min(12, slot * 0.42));
    YEARS.forEach((yr, i) => {
      const v = C_DATA.values[i];
      const x = padL + slot * i + (slot - bw) / 2;
      const h = ih * v / yMax;
      svg.appendChild(el("rect", {
        x, y: padT + ih - h, width: bw, height: Math.max(1, h), rx: 1.5,
        fill: yr >= 2021 ? C_RECENT : C_EARLY,
        _tip: `${yr} — ${plural(v, "body", "bodies")} running at some point that year`,
      }));
      text(svg, v, {
        x: x + bw / 2, y: padT + ih - h - 5, "text-anchor": "middle",
        "font-size": valFont, "font-weight": 650, fill: PAL.ink,
      });
      const yearFont = Math.max(8, Math.min(11.5, slot * 0.42));
      const every = slot < 20 ? 5 : 1;
      if (i % every === 0 || i === YEARS.length - 1) {
        text(svg, yr, { x: x + bw / 2, y: H - 8, "text-anchor": "middle", "font-size": yearFont, fill: PAL.ink2 });
      }
    });
    svg.appendChild(el("line", { x1: padL, x2: W - padR, y1: padT + ih, y2: padT + ih, stroke: PAL.baseline, "stroke-width": 1 }));
    host.textContent = "";
    host.appendChild(svg);
  }

  /* ---------------- chart D: the term each mandate sets ---------------- */
  // Every text that creates a body or extends its mandate in time, whatever its coded
  // role: foundings, renewals, and expansions that also extend (43/28, Syria 2020).
  // Pure taskings set no term and carry no mandate_term, so they drop out here.
  // Coded in scripts/export.py from the verbatim mandate paragraphs.
  const TERMS = ["not stated", "other set term", "12 months", "24 months", "ongoing"];
  const TERM_COLOR = {
    "not stated": "#c9c8c3",
    "other set term": "#eda100",
    "12 months": "#86b6ef",
    "24 months": "#2a78d6",
    "ongoing": "#1d3f73",
  };
  const D_TIP = (yr, term, v, tot, shares) => {
    const share = tot ? Math.round(100 * v / tot) + "% of " + tot : "";
    const what = term === "not stated" ? "state no term"
      : term === "ongoing" ? "give the body no end date"
      : term === "other set term" ? "set a term in another form"
      : "set a term of " + term;
    return `${yr} — ${plural(v, "text")} that ${what}` + (shares && share ? `\n${share} that year` : "");
  };
  const ONGOING_LABEL = {
    "IIMM Myanmar": "Myanmar mechanism, no end date",
    "COI OPT & Israel": "OPT and Israel commission, no end date",
    "IIM Afghanistan (2025)": "Afghanistan mechanism, no end date",
  };

  const D_DATA = (() => {
    const texts = TEXTS.filter(r => r.mandate_term);
    const per = new Map(YEARS.map(y => [y, TERMS.map(() => 0)]));
    texts.forEach(r => {
      const y = r.year || +String(r.date_adopted || "").slice(0, 4);
      const i = TERMS.indexOf(r.mandate_term);
      if (per.has(y) && i >= 0) per.get(y)[i]++;
    });
    const totals = TERMS.map((_, i) => YEARS.reduce((a, y) => a + per.get(y)[i], 0));
    const first24 = YEARS.find(y => per.get(y)[TERMS.indexOf("24 months")] > 0);
    const ongoing = texts.filter(r => r.mandate_term === "ongoing")
      .map(r => ({
        year: r.year || +String(r.date_adopted || "").slice(0, 4),
        body: (r.bodies || [])[0] || "",
        symbol: r.symbol,
      }))
      .sort((a, b) => a.year - b.year);
    return { per, totals, total: texts.length, first24, ongoing };
  })();

  // Fixed 16:9 canvas so the exported PNG drops straight onto a slide and the
  // type sizes below are the sizes at 1280 px wide.
  const D_W = 1280, D_H = 720;

  function drawD(host, mode) {
    const shares = mode === "shares";
    const padL = 72, padR = 40;
    const iw = D_W - padL - padR;
    const svg = svgRoot(D_W, D_H);
    svg.setAttribute("style", "display:block;width:100%;height:auto");

    // title: one line if it fits at 26px, otherwise wrapped on its semicolons
    const T_SIZE = 26;
    const titleLines = wrapTo(D_TITLE(), T_SIZE, iw);
    titleLines.forEach((ln, i) => text(svg, ln, {
      x: padL - 4, y: 44 + i * 32, "font-size": T_SIZE, "font-weight": 650, fill: PAL.ink,
    }));

    const legendY = 44 + titleLines.length * 32 - 4;
    let lx = padL - 4;
    TERMS.slice().reverse().forEach(t => {
      svg.appendChild(el("rect", { x: lx, y: legendY - 11, width: 13, height: 13, rx: 2.5, fill: TERM_COLOR[t] }));
      text(svg, t, { x: lx + 19, y: legendY, "font-size": 15, fill: PAL.ink2 });
      lx += 19 + textW(t, 15) + 24;
    });

    const plotT = legendY + 92, plotB = 576;
    const ih = plotB - plotT;

    const totals = YEARS.map(y => D_DATA.per.get(y).reduce((a, b) => a + b, 0));
    const yMax = shares ? 100 : Math.max(4, Math.ceil((Math.max(...totals) + 1) / 2) * 2);
    for (let t = 0; t <= 4; t++) {
      const y = plotT + ih - ih * t / 4;
      svg.appendChild(el("line", { x1: padL, x2: D_W - padR, y1: y, y2: y, stroke: PAL.grid, "stroke-width": 1 }));
      text(svg, shares ? Math.round(100 * t / 4) + "%" : Math.round(yMax * t / 4),
        { x: padL - 10, y: y + 5, "text-anchor": "end", "font-size": 14, fill: PAL.muted });
    }

    const slot = iw / YEARS.length, bw = Math.min(34, slot - 20);
    const topOf = new Map();
    YEARS.forEach((yr, i) => {
      const vals = D_DATA.per.get(yr), tot = totals[i];
      const x = padL + slot * i + (slot - bw) / 2;
      let yCur = plotT + ih;
      vals.forEach((v, k) => {
        if (!v) return;
        const share = tot ? v / tot : 0;
        const h = shares ? ih * share : ih * v / yMax;
        svg.appendChild(el("rect", { x, y: yCur - h, width: bw, height: Math.max(1, h - 1), rx: 1.5,
          fill: TERM_COLOR[TERMS[k]], _tip: D_TIP(yr, TERMS[k], v, tot, shares) }));
        if (h >= 17) {
          const lbl = shares ? Math.round(share * 100) + "%" : String(v);
          if (textW(lbl, 14) < bw - 4) {
            text(svg, lbl, {
              x: x + bw / 2, y: yCur - h / 2 + 5, "text-anchor": "middle", "font-size": 14,
              "font-weight": 600, fill: TERMS[k] === "not stated" || TERMS[k] === "12 months" ? "#0b0b0b" : "#ffffff",
            });
          }
        }
        yCur -= h;
      });
      topOf.set(yr, tot ? (shares ? plotT : plotT + ih - ih * tot / yMax) : plotT + ih);
      if (!shares && tot) {
        text(svg, tot, { x: x + bw / 2, y: topOf.get(yr) - 8, "text-anchor": "middle", "font-size": 14, "font-weight": 650, fill: PAL.ink });
      }
      text(svg, yr, { x: x + bw / 2, y: plotB + 24, "text-anchor": "middle", "font-size": 14, fill: PAL.ink2 });
    });
    svg.appendChild(el("line", { x1: padL, x2: D_W - padR, y1: plotB, y2: plotB, stroke: PAL.baseline, "stroke-width": 1 }));

    // annotations: three staggered rows above the plot, each with a thin leader
    const notes = [];
    if (D_DATA.first24) notes.push({ year: D_DATA.first24, label: "First two-year term (DPRK project)" });
    D_DATA.ongoing.forEach(o => notes.push({ year: o.year, label: ONGOING_LABEL[o.body] || (o.body + ", no end date"), dot: true }));
    notes.sort((a, b) => a.year - b.year);
    const ROWS = [legendY + 26, legendY + 50, legendY + 74];
    notes.forEach((n, i) => {
      const idx = YEARS.indexOf(n.year);
      if (idx < 0) return;
      const cx = padL + slot * idx + slot / 2;
      const ry = ROWS[i % ROWS.length];
      const w = textW(n.label, 14);
      // keep the label inside the canvas; anchor it away from the edge
      let anchor = "middle", tx = cx;
      if (cx - w / 2 < padL) { anchor = "start"; tx = padL; }
      if (cx + w / 2 > D_W - padR) { anchor = "end"; tx = D_W - padR; }
      text(svg, n.label, { x: tx, y: ry, "text-anchor": anchor, "font-size": 14, fill: PAL.ink2 });
      const top = topOf.get(n.year);
      svg.appendChild(el("line", {
        x1: cx, x2: cx, y1: ry + 6, y2: Math.max(ry + 10, top - (shares ? 6 : 26)),
        stroke: PAL.baseline, "stroke-width": 1, "stroke-dasharray": "2 3",
      }));
      if (n.dot) svg.appendChild(el("circle", { cx, cy: Math.max(ry + 12, top - (shares ? 6 : 26)), r: 3.5,
        fill: TERM_COLOR.ongoing, _tip: `${n.year} — ${n.label}` }));
    });

    // note, wrapped on word boundaries so it never runs off the canvas
    const NOTE = "Texts that create or extend a body, coded from the mandate paragraphs; taskings, which set no " +
      "term, are not shown. ‘Other set term’: under twelve months, until a final report, or until an event.";
    const noteLines = wrapTo(NOTE, 14, iw);
    noteLines.forEach((ln, i) => text(svg, ln,
      { x: padL - 4, y: 626 + i * 20, "font-size": 14, fill: PAL.muted }));
    text(svg, SOURCE_LINE, { x: padL - 4, y: 626 + noteLines.length * 20 + 6, "font-size": 13, fill: PAL.muted });

    host.textContent = "";
    host.appendChild(svg);
  }

  function D_TITLE() {
    const i12 = TERMS.indexOf("12 months");
    return `Twelve months is the usual term (${D_DATA.totals[i12]} of ${D_DATA.total} texts); ` +
      `two-year terms since ${D_DATA.first24}; ` +
      `${lower(word(D_DATA.ongoing.length))} bodies created with no end date`;
  }

  /* ---------------- chart E: task verbs in each founding mandate ---------------- */
  // One dot per founding text: how many distinct task verbs its mandate paragraphs
  // carry, on the 15-verb taxonomy. Role coding as it stands (strongest-effect rule).
  const E_DOT = "#86b6ef", E_DOT_LATE = "#2a78d6", E_MEAN = "#2a78d6";
  const E_MAX = 15;

  const E_DATA = (() => {
    const texts = TEXTS.filter(r => r.resolution_role === "founding")
      .map(r => ({
        year: r.year || +String(r.date_adopted || "").slice(0, 4),
        n: (r.action_verbs || []).length,
        symbol: r.symbol,
        body: (r.bodies || [])[0] || "",
      }))
      .sort((a, b) => a.year - b.year || a.n - b.n);
    const per = new Map(YEARS.map(y => [y, []]));
    texts.forEach(t => { if (per.has(t.year)) per.get(t.year).push(t); });
    const mean = new Map(YEARS.map(y => {
      const v = per.get(y);
      return [y, v.length ? v.reduce((a, t) => a + t.n, 0) / v.length : null];
    }));
    const since2022 = texts.filter(t => t.year >= 2022).map(t => t.n);
    const first = texts.filter(t => t.year === YEARS[0]).map(t => t.n);
    return {
      texts, per, mean, n: texts.length,
      firstMax: first.length ? Math.max(...first) : null,
      lateMin: since2022.length ? Math.min(...since2022) : null,
      lateMax: since2022.length ? Math.max(...since2022) : null,
      emptyYears: YEARS.filter(y => !per.get(y).length),
    };
  })();

  // the texts that carry a label, found by symbol so the values stay computed
  const E_LABELS = [
    { symbol: "A/HRC/RES/S-2/1", text: (t) => `Lebanon ${t.year}: ${t.n}`, place: "below" },
    { symbol: "A/HRC/RES/42/25", text: (t) => `Venezuela ${t.year}: ${t.n}`, place: "below" },
    { symbol: "A/HRC/RES/49/1", text: (t) => `Ukraine ${t.year}: ${t.n}`, place: "above", lift: 26 },
    { symbol: "A/HRC/RES/60/2", text: (t) => `Afghanistan mechanism ${t.year}: ${t.n}`, place: "above", lift: 78 },
  ];

  function drawE(host) {
    const padL = 72, padR = 40;
    const iw = D_W - padL - padR;
    const svg = svgRoot(D_W, D_H);
    svg.setAttribute("style", "display:block;width:100%;height:auto");

    const T_SIZE = 26;
    const titleLines = wrapTo(E_TITLE(), T_SIZE, iw);
    titleLines.forEach((ln, i) => text(svg, ln, {
      x: padL - 4, y: 44 + i * 32, "font-size": T_SIZE, "font-weight": 650, fill: PAL.ink,
    }));

    const plotT = 44 + titleLines.length * 32 + 62, plotB = 576;
    const ih = plotB - plotT;
    const slot = iw / YEARS.length;
    const xAt = (y) => padL + slot * YEARS.indexOf(y) + slot / 2;
    const yAt = (v) => plotT + ih - ih * v / E_MAX;

    for (let v = 0; v <= E_MAX; v += 3) {
      svg.appendChild(el("line", { x1: padL, x2: D_W - padR, y1: yAt(v), y2: yAt(v), stroke: PAL.grid, "stroke-width": 1 }));
      text(svg, v, { x: padL - 10, y: yAt(v) + 5, "text-anchor": "end", "font-size": 14, fill: PAL.muted });
    }
    text(svg, "task verbs", { x: padL, y: yAt(E_MAX) - 14, "font-size": 13, fill: PAL.muted });

    // dots: within a year, texts sharing a value sit side by side, never stacked
    const posOf = new Map();
    YEARS.forEach(yr => {
      const rows = E_DATA.per.get(yr);
      const byVal = new Map();
      rows.forEach(t => { if (!byVal.has(t.n)) byVal.set(t.n, []); byVal.get(t.n).push(t); });
      byVal.forEach((group) => {
        const step = Math.min(11, (slot - 8) / Math.max(1, group.length));
        group.forEach((t, i) => {
          const cx = xAt(yr) + (i - (group.length - 1) / 2) * step;
          posOf.set(t.symbol, { cx, cy: yAt(t.n) });
          svg.appendChild(el("circle", {
            cx, cy: yAt(t.n), r: 5,
            fill: yr >= 2021 ? E_DOT_LATE : E_DOT,
            stroke: "#ffffff", "stroke-width": 1.2,
            _tip: `${t.symbol} (${yr})\n${t.body}\n${plural(t.n, "task verb")} in the founding mandate`,
          }));
        });
      });
    });

    // yearly mean: a short dash, joined by a thin line that breaks on empty years
    let d = "", open = false;
    YEARS.forEach(yr => {
      const m = E_DATA.mean.get(yr);
      if (m === null) { open = false; return; }
      const x = xAt(yr), y = yAt(m);
      d += (open ? " L" : " M") + x.toFixed(1) + " " + y.toFixed(1);
      open = true;
    });
    if (d) svg.appendChild(el("path", { d: d.trim(), fill: "none", stroke: E_MEAN, "stroke-width": 1.6, opacity: 0.85 }));
    YEARS.forEach(yr => {
      const m = E_DATA.mean.get(yr);
      if (m === null) return;
      const x = xAt(yr), y = yAt(m);
      svg.appendChild(el("line", { x1: x - 13, x2: x + 13, y1: y, y2: y, stroke: E_MEAN, "stroke-width": 3.2, "stroke-linecap": "round" }));
    });

    YEARS.forEach(yr => text(svg, yr, {
      x: xAt(yr), y: plotB + 24, "text-anchor": "middle", "font-size": 14, fill: PAL.ink2,
    }));
    svg.appendChild(el("line", { x1: padL, x2: D_W - padR, y1: plotB, y2: plotB, stroke: PAL.baseline, "stroke-width": 1 }));

    // labels, outside the dots, with thin leaders
    E_LABELS.forEach(spec => {
      const t = E_DATA.texts.find(x => x.symbol === spec.symbol);
      const pos = t && posOf.get(spec.symbol);
      if (!t || !pos) return;
      const label = spec.text(t);
      const up = spec.place === "above";
      const ly = up ? pos.cy - (spec.lift || 26) : pos.cy + (spec.lift || 34);
      const w = textW(label, 14);
      let anchor = "middle", tx = pos.cx;
      if (tx - w / 2 < padL) { anchor = "start"; tx = padL; }
      if (tx + w / 2 > D_W - padR) { anchor = "end"; tx = D_W - padR; }
      text(svg, label, { x: tx, y: ly, "font-size": 14, "text-anchor": anchor, fill: PAL.ink2 });
      svg.appendChild(el("line", {
        x1: pos.cx, x2: pos.cx, y1: up ? ly + 6 : ly - 12, y2: up ? pos.cy - 8 : pos.cy + 8,
        stroke: PAL.baseline, "stroke-width": 1, "stroke-dasharray": "2 3",
      }));
    });

    const NOTE = `One dot per founding text, coded from its mandate paragraphs on a 15-verb taxonomy ` +
      `(n = ${E_DATA.n}). The dash and line show the mean for each year; no founding text in ` +
      `${E_DATA.emptyYears.join(" or ")}. With one to five founding texts a year, single texts move the yearly mean.`;
    const noteLines = wrapTo(NOTE, 14, iw);
    noteLines.forEach((ln, i) => text(svg, ln, { x: padL - 4, y: 626 + i * 20, "font-size": 14, fill: PAL.muted }));
    text(svg, SOURCE_LINE, { x: padL - 4, y: 626 + noteLines.length * 20 + 6, "font-size": 13, fill: PAL.muted });

    host.textContent = "";
    host.appendChild(svg);
  }

  function E_TITLE() {
    return `Task verbs in each founding mandate: at most ${lower(word(E_DATA.firstMax))} in ${YEARS[0]}, ` +
      `between ${lower(word(E_DATA.lateMin))} and ${lower(word(E_DATA.lateMax))} since 2022`;
  }

  /* ---------------- chart F: four features of each founding mandate ---------------- */
  const F_ROWS = [
    ["Establish the facts", (r) => (r.action_verbs || []).indexOf("establish facts") >= 0],
    ["Identify those responsible", (r) => (r.action_verbs || []).indexOf("identify perpetrators") >= 0],
    ["Evidence task", (r) => ["collect", "consolidate", "preserve", "analyse evidence", "document"]
      .some(v => (r.action_verbs || []).indexOf(v) >= 0)],
    ["Crimes or criminal proceedings named", (r) => r.criminal_accountability === "names crimes or criminal proceedings"],
  ];
  const F_ON = "#2a78d6", F_OFF = "#c9c8c3";

  const F_DATA = (() => {
    const texts = TEXTS.filter(r => r.resolution_role === "founding")
      .sort((a, b) => (a.date_adopted || "").localeCompare(b.date_adopted || ""))
      .map(r => ({
        year: r.year || +String(r.date_adopted || "").slice(0, 4),
        symbol: r.symbol,
        body: (r.bodies || [])[0] || "",
        f: F_ROWS.map(([, test]) => !!test(r)),
      }));
    const per = new Map(YEARS.map(y => [y, texts.filter(t => t.year === y)]));
    const totals = F_ROWS.map((_, i) => texts.filter(t => t.f[i]).length);
    const since2021 = texts.filter(t => t.year >= 2021);
    const firstFacts = texts.filter(t => t.f[0]).map(t => t.year).sort((a, b) => a - b)[0];
    return {
      texts, per, totals,
      n: texts.length,
      emptyYears: YEARS.filter(y => !per.get(y).length),
      firstFacts,
      firstFactsBodies: texts.filter(t => t.year === firstFacts && t.f[0]).map(t => t.body),
      firstFactsCount: texts.filter(t => t.year === firstFacts && t.f[0]).length,
      evSince2021: since2021.filter(t => t.f[2]).length,
      nSince2021: since2021.length,
    };
  })();

  function drawF(host) {
    const padR = 40;
    const labelW = 292, totalW = 58;
    const svg = svgRoot(D_W, D_H);
    svg.setAttribute("style", "display:block;width:100%;height:auto");

    const T_SIZE = 26;
    const titleLines = wrapTo(F_TITLE(), T_SIZE, D_W - padR - 28);
    titleLines.forEach((ln, i) => text(svg, ln, {
      x: 28, y: 44 + i * 32, "font-size": T_SIZE, "font-weight": 650, fill: PAL.ink,
    }));

    // column geometry: one column per text, grouped by year; empty years keep a slot
    const gridL = labelW + 12, gridR = D_W - padR - totalW;
    const gap = 8;
    const slots = YEARS.map(y => Math.max(1, F_DATA.per.get(y).length));
    // a group is never narrower than its own year label, so the labels never collide
    const MIN_GROUP = textW("2026", 13.5) + 7;
    const avail = gridR - gridL - gap * (YEARS.length - 1);
    let colW = 17;
    const widthAt = (cw) => slots.reduce((a, n) => a + Math.max(MIN_GROUP, n * cw), 0);
    while (colW > 7 && widthAt(colW) > avail) colW -= 0.25;
    const groupX = new Map();
    let x = gridL;
    YEARS.forEach((y, i) => {
      const w = Math.max(MIN_GROUP, slots[i] * colW);
      groupX.set(y, { x0: x, x1: x + w, w, cols: slots[i] });
      x += w + gap;
    });

    const annoTop = 44 + titleLines.length * 32 + 26;
    const matrixTop = annoTop + 86;
    const rowGap = 96;
    const rowY = (i) => matrixTop + i * rowGap;
    const matrixBottom = rowY(F_ROWS.length - 1) + 20;

    // annotations with thin brackets
    const anno = [
      { years: [F_DATA.firstFacts], row: 0,
        label: `${F_DATA.firstFacts}: ‘establish the facts’ and ‘identify those responsible’ enter ` +
          `(${F_DATA.firstFactsBodies.map(b => label(b.replace(/^(COI|FFM)\s+/, "").replace(/\s*\(\d+\)$/, "")))
            .filter((v, i, a) => a.indexOf(v) === i).join(", ")})` },
      { years: [2021, 2025], row: 1,
        label: `Since 2021: an evidence task in ${F_DATA.evSince2021} of ${F_DATA.nSince2021} founding texts` },
    ];
    anno.forEach(a => {
      const g0 = groupX.get(a.years[0]), g1 = groupX.get(a.years[a.years.length - 1]);
      if (!g0 || !g1) return;
      const by = annoTop + 56;
      const cx = (g0.x0 + g1.x1) / 2;
      svg.appendChild(el("path", {
        d: `M${g0.x0} ${by + 10} L${g0.x0} ${by + 4} L${g1.x1} ${by + 4} L${g1.x1} ${by + 10}`,
        fill: "none", stroke: PAL.baseline, "stroke-width": 1,
      }));
      const w = textW(a.label, 14);
      let anchorPos = "middle", tx = cx;
      if (tx + w / 2 > D_W - padR) { anchorPos = "end"; tx = D_W - padR; }
      if (tx - w / 2 < 28) { anchorPos = "start"; tx = 28; }
      text(svg, a.label, { x: tx, y: by - 8 - a.row * 22, "font-size": 14, "text-anchor": anchorPos, fill: PAL.ink2 });
      svg.appendChild(el("line", {
        x1: cx, x2: cx, y1: by - 4 - a.row * 22, y2: by + 4,
        stroke: PAL.baseline, "stroke-width": 1, "stroke-dasharray": "2 3",
      }));
    });

    // rows
    F_ROWS.forEach(([name], i) => {
      const y = rowY(i);
      text(svg, name, { x: labelW, y: y + 5, "text-anchor": "end", "font-size": 14, fill: PAL.ink });
      svg.appendChild(el("line", {
        x1: gridL - 6, x2: gridR + 6, y1: y, y2: y, stroke: PAL.grid, "stroke-width": 1,
      }));
      text(svg, F_DATA.totals[i], {
        x: D_W - padR, y: y + 5, "text-anchor": "end", "font-size": 14, "font-weight": 650, fill: PAL.ink,
      });
    });
    text(svg, `of ${F_DATA.n}`, { x: D_W - padR, y: rowY(0) - 26, "text-anchor": "end", "font-size": 12.5, fill: PAL.muted });

    // cells
    YEARS.forEach(yr => {
      const g = groupX.get(yr);
      const rows = F_DATA.per.get(yr);
      const inner = rows.length * colW;
      const x0 = g.x0 + (g.w - inner) / 2;
      rows.forEach((t, k) => {
        const cx = x0 + colW * (k + 0.5);
        t.f.forEach((on, i) => {
          const fTip = `${t.symbol} (${yr})\n${t.body}\n${F_ROWS[i][0]}: ${on ? "yes" : "no"}`;
          svg.appendChild(el("circle", on
            ? { cx, cy: rowY(i), r: 5, fill: F_ON, _tip: fTip }
            : { cx, cy: rowY(i), r: 3.6, fill: "none", stroke: F_OFF, "stroke-width": 1.3, _tip: fTip }));
        });
      });
      // year label and separator
      text(svg, yr, {
        x: (g.x0 + g.x1) / 2, y: matrixBottom + 22, "text-anchor": "middle", "font-size": 13.5,
        fill: rows.length ? PAL.ink2 : PAL.muted,
      });
      if (yr !== YEARS[YEARS.length - 1]) {
        svg.appendChild(el("line", {
          x1: g.x1 + gap / 2, x2: g.x1 + gap / 2, y1: rowY(0) - 16, y2: matrixBottom + 6,
          stroke: PAL.grid, "stroke-width": 1,
        }));
      }
    });

    const NOTE = `One column per founding text (n = ${F_DATA.n}), coded from its mandate paragraphs. ` +
      `Evidence task: collect, consolidate, preserve, analyse evidence or document. ` +
      `No founding text in ${F_DATA.emptyYears.join(" or ")}.`;
    const noteLines = wrapTo(NOTE, 14, D_W - padR - 28);
    noteLines.forEach((ln, i) => text(svg, ln, { x: 28, y: 626 + i * 20, "font-size": 14, fill: PAL.muted }));
    text(svg, SOURCE_LINE, { x: 28, y: 626 + noteLines.length * 20 + 6, "font-size": 13, fill: PAL.muted });

    host.textContent = "";
    host.appendChild(svg);
  }

  function F_TITLE() {
    return `From ${F_DATA.firstFacts} the Council asks its bodies to establish the facts; since 2021 ` +
      `${F_DATA.evSince2021} of ${F_DATA.nSince2021} new bodies are also asked to collect evidence`;
  }

  /* ---------------- table G: the fifteen task verbs ---------------- */
  // Families are a presentation grouping, not a coded field.
  const G_FAMILIES = [
    ["Inquiry", ["investigate", "establish facts", "identify perpetrators"]],
    ["Evidence", ["collect", "consolidate", "preserve", "analyse evidence", "document", "verify"]],
    ["The situation", ["monitor", "assess"]],
    ["Outputs and relations", ["report", "make recommendations", "provide guidance", "engage"]],
  ];
  const G_SHADED = "Evidence";
  const G_SHADE = "#eaf2fc";
  const G_DISPLAY = { "identify perpetrators": "identify those responsible" };
  // the verb, plus the synonyms mapped onto it
  const G_PATTERNS = {
    "investigate": [/\binvestigat\w*/i],
    "establish facts": [/\bestablish\w*\s+the\s+facts/i, /\bdetermine\s+the\s+facts/i],
    "identify perpetrators": [/\bidentify[^.;:]{0,40}?those\s+responsible/i, /\bidentify\w*\s+the\s+perpetrators/i, /\bclarify\w*\s+responsibility/i],
    "collect": [/\bcollect\w*/i, /\bgather\w*/i],
    "consolidate": [/\bconsolidat\w*/i],
    "preserve": [/\bpreserv\w*/i],
    "analyse evidence": [/\banalys\w*/i, /\banalyz\w*/i],
    "document": [/\bdocument(?:s|ing|ed)?\b/i],
    "verify": [/\bverif\w*/i],
    "monitor": [/\bmonitor\w*/i],
    "assess": [/\bassess(?:es|ing|ed)?\b/i],
    "report": [/\breport\w*/i],
    "make recommendations": [/\bmake\s+recommendations/i, /\brecommend(?:s|ing|ed)?\b/i],
    "provide guidance": [/\bprovide\s+guidance/i, /\bguidance/i],
    "engage": [/\bengag\w*/i],
  };
  const G_COUNT_WORDS = 8;   // the rule: at most eight words
  const G_SHOW_WORDS = 8;    // the full rule fits the column; shortened only if it does not

  const G_DATA = (() => {
    const byDate = TEXTS.slice().sort((a, b) => (a.date_adopted || "").localeCompare(b.date_adopted || ""));
    const founding = byDate.filter(r => r.resolution_role === "founding");
    const cut = (seg, n) => {
      const w = seg.split(/\s+/);
      return { s: w.slice(0, n).join(" ").replace(/[,.]$/, ""), more: w.length > n };
    };
    const phrase = (vm, pats) => {
      const t = String(vm || "").replace(/\s+/g, " ");
      for (const p of pats) {
        const m = p.exec(t);
        if (!m) continue;
        const rest = t.slice(m.index);
        const stop = rest.search(/[;:]/);
        return (stop >= 0 ? rest.slice(0, stop) : rest).trim();
      }
      return null;
    };
    const rows = [];
    G_FAMILIES.forEach(([family, verbs]) => verbs.forEach(v => {
      const texts = byDate.filter(r => (r.action_verbs || []).indexOf(v) >= 0);
      const fnd = founding.filter(r => (r.action_verbs || []).indexOf(v) >= 0);
      const counts = new Map();
      let noLiteral = 0;
      const why = { ref: 0, nomandate: 0, other: 0 };
      texts.forEach(r => {
        const seg = phrase(r.verbatim_mandate, G_PATTERNS[v]);
        if (!seg) {
          noLiteral++;
          const vm = String(r.verbatim_mandate || "");
          if (!vm.trim()) why.nomandate++;
          else if (/as set out in|in accordance with .{0,30}resolution|under the same terms|referred to in|its resolution \d/i.test(vm)) why.ref++;
          else why.other++;
          return;
        }
        // identical wording, ignoring punctuation and case
        const key = cut(seg, G_COUNT_WORDS).s.toLowerCase().replace(/[^a-z0-9 ]+/g, "").replace(/\s+/g, " ").trim();
        if (!counts.has(key)) counts.set(key, { show: cut(seg, G_SHOW_WORDS), n: 0 });
        counts.get(key).n++;
      });
      const top = [...counts.values()].sort((a, b) => b.n - a.n || a.show.s.localeCompare(b.show.s)).slice(0, 2);
      rows.push({
        family, verb: v, label: G_DISPLAY[v] || v,
        texts: texts.length, founding: fnd.length, noLiteral, why,
        first: texts[0] ? { sym: texts[0].symbol, year: texts[0].year } : null,
        top,
      });
    }));
    return { rows, total: byDate.length, totalFounding: founding.length };
  })();

  const shortSym = (s) => String(s).replace("A/HRC/RES/", "").replace("A/HRC/DEC/", "dec. ").replace("A/HRC/", "");

  function drawG(host) {
    const L = 28, R = D_W - 28;
    const svg = svgRoot(D_W, D_H);
    svg.setAttribute("style", "display:block;width:100%;height:auto");

    text(svg, "Fifteen task verbs, and how the Council words them",
      { x: L, y: 36, "font-size": 23, "font-weight": 650, fill: PAL.ink });
    text(svg, `Coded from the mandate paragraphs; a verb counts once per text. ` +
      `Texts: of ${G_DATA.total} in the corpus; founding: of ${G_DATA.totalFounding}.`,
      { x: L, y: 56, "font-size": 13, fill: PAL.ink2 });

    const cVerb = L, cTexts = 236, cFound = 310, cFirst = 392, cWord = 512;
    let y = 78;
    text(svg, "Verb", { x: cVerb, y, "font-size": 12.5, "font-weight": 650, fill: PAL.muted });
    text(svg, "Texts", { x: cTexts + 40, y, "font-size": 12.5, "font-weight": 650, "text-anchor": "end", fill: PAL.muted });
    text(svg, "Founding", { x: cFound + 58, y, "font-size": 12.5, "font-weight": 650, "text-anchor": "end", fill: PAL.muted });
    text(svg, "First used", { x: cFirst, y, "font-size": 12.5, "font-weight": 650, fill: PAL.muted });
    text(svg, "How it is worded", { x: cWord, y, "font-size": 12.5, "font-weight": 650, fill: PAL.muted });
    y += 8;
    svg.appendChild(el("line", { x1: L, x2: R, y1: y, y2: y, stroke: PAL.baseline, "stroke-width": 1 }));

    const ROW_H = 31, FAM_H = 18;
    G_FAMILIES.forEach(([family]) => {
      const rows = G_DATA.rows.filter(r => r.family === family);
      const blockTop = y;
      const blockH = FAM_H + rows.length * ROW_H;
      if (family === G_SHADED) {
        svg.appendChild(el("rect", { x: L - 6, y: blockTop + 2, width: R - L + 12, height: blockH - 2, fill: G_SHADE }));
      }
      y += FAM_H;
      text(svg, family, { x: cVerb, y: y - 5, "font-size": 12.5, "font-weight": 650, fill: PAL.accent || "#1c5cab" });
      rows.forEach(r => {
        const mid = y + 13;
        // invisible hit area so the whole row carries its figures on hover
        svg.appendChild(el("rect", {
          x: L - 6, y: y, width: R - L + 12, height: ROW_H, fill: "transparent",
          _tip: `${r.label}\n${plural(r.texts, "text")} of ${G_DATA.total} in the corpus` +
            `\n${r.founding} of ${G_DATA.totalFounding} founding texts` +
            (r.first ? `\nFirst used: ${r.first.sym} (${r.first.year})` : "") +
            (r.top && r.top.length ? `\nMost common wording: “${r.top[0].s}”` : ""),
        }));
        text(svg, r.label, { x: cVerb, y: mid, "font-size": 13.5, fill: PAL.ink });
        text(svg, r.texts, { x: cTexts + 40, y: mid, "font-size": 13.5, "text-anchor": "end", fill: PAL.ink });
        text(svg, r.founding, { x: cFound + 58, y: mid, "font-size": 13.5, "text-anchor": "end", fill: PAL.ink2 });
        text(svg, r.first ? `${shortSym(r.first.sym)} ${r.first.year}` : "—",
          { x: cFirst, y: mid, "font-size": 13, fill: PAL.ink2 });
        const rightEdge = [];
        r.top.forEach((t, i) => {
          let show = t.show;
          // fall back to six words rather than shrinking the type
          if (textW(`“${show.s}”`, 13) > R - cWord - 34) {
            const w = show.s.split(/\s+/);
            show = { s: w.slice(0, 6).join(" ").replace(/[,.]$/, ""), more: true };
          }
          const q = `“${show.s}${show.more ? " …" : ""}”`;
          const ty = y + 10 + i * 15;
          text(svg, q, { x: cWord, y: ty, "font-size": 13, fill: PAL.ink2 });
          text(svg, t.n, { x: cWord + textW(q, 13) + 10, y: ty, "font-size": 12.5, "font-weight": 650, fill: PAL.muted });
          rightEdge[i] = cWord + textW(q, 13) + 10 + textW(String(t.n), 12.5);
        });
        // where the verb is carried without any literal wording, say how; placed on
        // whichever of the two lines has room, right-aligned, never over the quote
        if (r.noLiteral) {
          const bits = [];
          if (r.why.ref) bits.push(`${r.why.ref} by reference`);
          if (r.why.other) bits.push(`${r.why.other} worded otherwise`);
          if (r.why.nomandate) bits.push(`${r.why.nomandate} no mandate text`);
          const full = `+${r.noLiteral} with no literal wording (${bits.join(", ")})`;
          const brief = `+${r.noLiteral} with no literal wording`;
          let note = full, line = -1;
          for (const cand of [full, brief]) {
            const w = textW(cand, 11.5);
            const fit = rightEdge.findIndex(e => R - e - 14 >= w);
            if (fit >= 0) { note = cand; line = fit; break; }
          }
          if (line >= 0) {
            text(svg, note, {
              x: R, y: y + 10 + line * 15, "text-anchor": "end",
              "font-size": 11.5, "font-style": "italic", fill: PAL.muted,
            });
          }
        }
        y += ROW_H;
        svg.appendChild(el("line", { x1: L, x2: R, y1: y - 2, y2: y - 2, stroke: PAL.grid, "stroke-width": 0.8 }));
      });
    });

    text(svg, SOURCE_LINE, { x: L, y: D_H - 22, "font-size": 12.5, fill: PAL.muted });
    host.textContent = "";
    host.appendChild(svg);
  }

  /* ---------------- chart E2: the floor rose (alternative reading of E) ---------------- */
  // Same texts as chart E, read a different way. No mean line: with one to five
  // founding texts a year a mean invents a trajectory. The claim here is about the
  // range the Council works inside, which is what the two bands show.
  const E2_EARLY_END = 2013, E2_LATE_START = 2022;
  const E2_EARLY = "#9aa3ad", E2_MID = "#86b6ef", E2_LATE = "#2a78d6";
  const E2_BAND_LATE = "#eaf2fc", E2_BAND_EARLY = "#f1f2f4";

  const E2_DATA = (() => {
    const texts = E_DATA.texts;
    const early = texts.filter(t => t.year <= E2_EARLY_END).map(t => t.n);
    const late = texts.filter(t => t.year >= E2_LATE_START).map(t => t.n);
    const ceiling = early.length ? Math.max(...early) : null;
    const floor = late.length ? Math.min(...late) : null;
    const firstAtFloor = floor === null ? null : texts.find(t => t.n >= floor);
    const peak = texts.reduce((a, t) => (!a || t.n > a.n ? t : a), null);
    // years after the first mandate reached the floor that still carry a short one
    const shortLate = texts.filter(t => firstAtFloor && t.year > firstAtFloor.year &&
      t.year < E2_LATE_START && t.n < 5);
    const shortYears = [...new Set(shortLate.map(t => t.year))].sort((a, b) => a - b);
    return {
      texts, ceiling, floor, firstAtFloor, peak,
      nEarly: early.length, nLate: late.length,
      lateMax: late.length ? Math.max(...late) : null,
      shortYears, shortMin: shortLate.length ? Math.min(...shortLate.map(t => t.n)) : null,
      shortMax: shortLate.length ? Math.max(...shortLate.map(t => t.n)) : null,
    };
  })();

  function drawE2(host) {
    const padL = 72, padR = 40;
    const iw = D_W - padL - padR;
    const svg = svgRoot(D_W, D_H);
    svg.setAttribute("style", "display:block;width:100%;height:auto");

    const T_SIZE = 26;
    const titleLines = wrapTo(E2_TITLE(), T_SIZE, iw);
    titleLines.forEach((ln, i) => text(svg, ln, {
      x: padL - 4, y: 44 + i * 32, "font-size": T_SIZE, "font-weight": 650, fill: PAL.ink,
    }));

    const plotT = 44 + titleLines.length * 32 + 68, plotB = 556;
    const ih = plotB - plotT;
    const slot = iw / YEARS.length;
    const xAt = (y) => padL + slot * YEARS.indexOf(y) + slot / 2;
    const edgeL = (y) => padL + slot * YEARS.indexOf(y);
    const edgeR = (y) => padL + slot * (YEARS.indexOf(y) + 1);
    const yAt = (v) => plotT + ih - ih * v / E_MAX;

    // the two bands: where every early mandate sat, and where every recent one sits
    if (E2_DATA.ceiling !== null) {
      svg.appendChild(el("rect", {
        x: edgeL(YEARS[0]), y: yAt(E2_DATA.ceiling), width: edgeR(E2_EARLY_END) - edgeL(YEARS[0]),
        height: plotB - yAt(E2_DATA.ceiling), fill: E2_BAND_EARLY,
      }));
      svg.appendChild(el("line", {
        x1: edgeL(YEARS[0]), x2: edgeR(E2_EARLY_END), y1: yAt(E2_DATA.ceiling), y2: yAt(E2_DATA.ceiling),
        stroke: E2_EARLY, "stroke-width": 1.6,
      }));
      text(svg, `Before ${E2_EARLY_END + 1}: never more than ${E2_DATA.ceiling}`,
        { x: edgeL(YEARS[0]) + 6, y: yAt(E2_DATA.ceiling) - 9, "font-size": 14, "font-weight": 600, fill: "#6b7280" });
      text(svg, `${E2_DATA.nEarly} founding texts`,
        { x: edgeL(YEARS[0]) + 6, y: yAt(E2_DATA.ceiling) + 17, "font-size": 12.5, fill: PAL.muted });
    }
    if (E2_DATA.floor !== null) {
      svg.appendChild(el("rect", {
        x: edgeL(E2_LATE_START), y: plotT, width: edgeR(YEARS[YEARS.length - 1]) - edgeL(E2_LATE_START),
        height: yAt(E2_DATA.floor) - plotT, fill: E2_BAND_LATE,
      }));
      svg.appendChild(el("line", {
        x1: edgeL(E2_LATE_START), x2: edgeR(YEARS[YEARS.length - 1]), y1: yAt(E2_DATA.floor), y2: yAt(E2_DATA.floor),
        stroke: E2_LATE, "stroke-width": 1.6,
      }));
      text(svg, `Since ${E2_LATE_START}: never fewer than ${E2_DATA.floor}`,
        { x: edgeR(YEARS[YEARS.length - 1]) - 6, y: yAt(E2_DATA.floor) + 20, "text-anchor": "end",
          "font-size": 14, "font-weight": 600, fill: "#1c5cab" });
      text(svg, `${E2_DATA.nLate} founding texts, ${E2_DATA.floor}–${E2_DATA.lateMax}`,
        { x: edgeR(YEARS[YEARS.length - 1]) - 6, y: yAt(E2_DATA.floor) - 9, "text-anchor": "end",
          "font-size": 12.5, fill: PAL.muted });
    }

    for (let v = 0; v <= E_MAX; v += 3) {
      svg.appendChild(el("line", { x1: padL, x2: D_W - padR, y1: yAt(v), y2: yAt(v), stroke: PAL.grid, "stroke-width": 1, opacity: 0.7 }));
      text(svg, v, { x: padL - 10, y: yAt(v) + 5, "text-anchor": "end", "font-size": 14, fill: PAL.muted });
    }
    text(svg, "task verbs", { x: padL, y: yAt(E_MAX) - 14, "font-size": 13, fill: PAL.muted });

    const posOf = new Map();
    YEARS.forEach(yr => {
      const rows = E_DATA.per.get(yr);
      const byVal = new Map();
      rows.forEach(t => { if (!byVal.has(t.n)) byVal.set(t.n, []); byVal.get(t.n).push(t); });
      byVal.forEach(group => {
        const step = Math.min(11, (slot - 8) / Math.max(1, group.length));
        group.forEach((t, i) => {
          const cx = xAt(yr) + (i - (group.length - 1) / 2) * step;
          posOf.set(t.symbol, { cx, cy: yAt(t.n) });
          svg.appendChild(el("circle", {
            cx, cy: yAt(t.n), r: 5.5,
            fill: yr >= E2_LATE_START ? E2_LATE : (yr <= E2_EARLY_END ? E2_EARLY : E2_MID),
            stroke: "#ffffff", "stroke-width": 1.2,
            _tip: `${t.symbol} (${yr})\n${t.body}\n${plural(t.n, "task verb")} in the founding mandate`,
          }));
        });
      });
      text(svg, yr, { x: xAt(yr), y: plotB + 24, "text-anchor": "middle", "font-size": 14, fill: PAL.ink2 });
    });
    svg.appendChild(el("line", { x1: padL, x2: D_W - padR, y1: plotB, y2: plotB, stroke: PAL.baseline, "stroke-width": 1 }));

    // the transition: the years that kept making short mandates after the first long one
    if (E2_DATA.shortYears.length) {
      const y0 = E2_DATA.shortYears[0], y1 = E2_DATA.shortYears[E2_DATA.shortYears.length - 1];
      const bx0 = edgeL(y0) + 3, bx1 = edgeR(y1) - 3, by = plotB + 40;
      svg.appendChild(el("path", {
        d: `M${bx0} ${by - 6} L${bx0} ${by} L${bx1} ${by} L${bx1} ${by - 6}`,
        fill: "none", stroke: PAL.baseline, "stroke-width": 1,
      }));
      text(svg, `${y0}–${y1}: the Council was still creating bodies with ` +
        `${lower(word(E2_DATA.shortMin))}- and ${lower(word(E2_DATA.shortMax))}-verb mandates`,
        { x: (bx0 + bx1) / 2, y: by + 17, "text-anchor": "middle", "font-size": 14, fill: PAL.ink2 });
    }

    // two labels only, both carrying the claim
    [
      E2_DATA.firstAtFloor && { t: E2_DATA.firstAtFloor, s: `First to reach ${E2_DATA.floor}: ${label(E2_DATA.firstAtFloor.body)} ${E2_DATA.firstAtFloor.year}` },
      E2_DATA.peak && { t: E2_DATA.peak, s: `${label(E2_DATA.peak.body).replace(/^COI\s+/, "")} ${E2_DATA.peak.year}: ${E2_DATA.peak.n}` },
    ].filter(Boolean).forEach(spec => {
      const pos = posOf.get(spec.t.symbol);
      if (!pos) return;
      const ly = pos.cy - 24;
      const w = textW(spec.s, 14);
      let anc = "middle", tx = pos.cx;
      if (tx - w / 2 < padL) { anc = "start"; tx = padL; }
      if (tx + w / 2 > D_W - padR) { anc = "end"; tx = D_W - padR; }
      text(svg, spec.s, { x: tx, y: ly, "font-size": 14, "text-anchor": anc, fill: PAL.ink });
      svg.appendChild(el("line", {
        x1: pos.cx, x2: pos.cx, y1: ly + 6, y2: pos.cy - 8,
        stroke: PAL.baseline, "stroke-width": 1, "stroke-dasharray": "2 3",
      }));
    });

    const NOTE = `One dot per founding text (n = ${E_DATA.n}), coded from its mandate paragraphs on a 15-verb ` +
      `taxonomy. No yearly average is shown: with one to five founding texts a year an average would move on ` +
      `a single text. No founding text in ${E_DATA.emptyYears.join(" or ")}.`;
    const noteLines = wrapTo(NOTE, 14, iw);
    noteLines.forEach((ln, i) => text(svg, ln, { x: padL - 4, y: 640 + i * 20, "font-size": 14, fill: PAL.muted }));
    text(svg, SOURCE_LINE, { x: padL - 4, y: 640 + noteLines.length * 20 + 6, "font-size": 13, fill: PAL.muted });

    host.textContent = "";
    host.appendChild(svg);
  }

  function E2_TITLE() {
    return `What rose is the floor: before ${E2_EARLY_END + 1} no founding mandate carried more than ` +
      `${lower(word(E2_DATA.ceiling))} task verbs; since ${E2_LATE_START} none carries fewer than ` +
      `${lower(word(E2_DATA.floor))}`;
  }

  /* ---------------- chart H: groups named vs groups instructed ---------------- */
  // "Named anywhere" = differentiated_analysis_whole_text; "in the instruction to the
  // body" = differentiated_analysis_mandate, i.e. the paragraphs that create, extend
  // or task the body. "age" is counted but not charted.
  const H_GROUPS = ["women", "girls", "gender", "children",
    "persons with disabilities", "older persons", "minorities"];
  const H_LIGHT = "#c9dcf5", H_DARK = "#2a78d6", H_FOCUS_DARK = "#1d3f73";
  const H_FOCUS = "gender";

  const H_DATA = (() => {
    const anywhere = (g) => TEXTS.filter(r => (r.differentiated_analysis_whole_text || []).indexOf(g) >= 0).length;
    const mandate = (g) => TEXTS.filter(r => (r.differentiated_analysis_mandate || []).indexOf(g) >= 0).length;
    const rows = H_GROUPS.map(g => ({ group: g, anywhere: anywhere(g), mandate: mandate(g) }));
    const focus = rows.find(r => r.group === H_FOCUS);
    const instructed = rows.filter(r => r.mandate > 0);
    const never = rows.filter(r => r.mandate === 0);
    const years = [...new Set(TEXTS.filter(r => (r.differentiated_analysis_mandate || []).indexOf(H_FOCUS) >= 0)
      .map(r => r.year))].sort((a, b) => a - b);
    // the run of consecutive years ending at the most recent one
    let runStart = years[years.length - 1];
    for (let i = years.length - 1; i > 0; i--) {
      if (years[i] - years[i - 1] === 1) runStart = years[i - 1]; else break;
    }
    return { rows, focus, instructed, never, total: TEXTS.length, runStart, age: anywhere("age") };
  })();

  function drawH(host) {
    const padR = 40, L = 28;
    const svg = svgRoot(D_W, D_H);
    svg.setAttribute("style", "display:block;width:100%;height:auto");

    const titleLines = wrapTo(H_TITLE(), 26, D_W - padR - L);
    titleLines.forEach((ln, i) => text(svg, ln, {
      x: L, y: 44 + i * 32, "font-size": 26, "font-weight": 650, fill: PAL.ink,
    }));

    const subY = 44 + titleLines.length * 32 + 4;
    text(svg, H_SUBTITLE(), { x: L, y: subY, "font-size": 15, fill: PAL.ink2 });

    // legend
    const ly = subY + 30;
    svg.appendChild(el("rect", { x: L, y: ly - 11, width: 14, height: 13, rx: 2, fill: H_LIGHT }));
    text(svg, "named anywhere in the text", { x: L + 20, y: ly, "font-size": 14, fill: PAL.ink2 });
    const lx2 = L + 20 + textW("named anywhere in the text", 14) + 26;
    svg.appendChild(el("rect", { x: lx2, y: ly - 11, width: 14, height: 13, rx: 2, fill: H_DARK }));
    text(svg, "in the instruction to the body", { x: lx2 + 20, y: ly, "font-size": 14, fill: PAL.ink2 });

    const labelW = 228;
    const gridL = L + labelW, gridR = D_W - padR - 56;
    const max = H_DATA.total;
    const xAt = (v) => gridL + (gridR - gridL) * v / max;

    const top = ly + 34;
    const rowH = (546 - top) / H_GROUPS.length;
    const barH = Math.min(17, rowH * 0.30);

    // axis
    const step = max > 120 ? 25 : 20;
    const ticks = [];
    for (let v = 0; v <= max; v += step) ticks.push(v);
    if (ticks[ticks.length - 1] !== max) ticks.push(max);
    ticks.forEach(v => {
      svg.appendChild(el("line", { x1: xAt(v), x2: xAt(v), y1: top - 6, y2: 552, stroke: PAL.grid, "stroke-width": 1 }));
      text(svg, v, { x: xAt(v), y: 572, "text-anchor": "middle", "font-size": 13, fill: PAL.muted });
    });
    text(svg, "texts", { x: xAt(max), y: top - 14, "text-anchor": "end", "font-size": 13, fill: PAL.muted });

    H_DATA.rows.forEach((r, i) => {
      const y0 = top + i * rowH;
      const focus = r.group === H_FOCUS;
      const mid = y0 + rowH / 2;
      text(svg, r.group, {
        x: gridL - 12, y: mid + 5, "text-anchor": "end", "font-size": 15,
        "font-weight": focus ? 650 : 400, fill: focus ? H_FOCUS_DARK : PAL.ink,
      });
      const yA = mid - barH - 2, yM = mid + 2;
      svg.appendChild(el("rect", { x: gridL, y: yA, width: Math.max(1, xAt(r.anywhere) - gridL), height: barH, rx: 2,
        fill: H_LIGHT, _tip: `${r.group}\nNamed anywhere in the text: ${plural(r.anywhere, "text")}` }));
      text(svg, r.anywhere, { x: xAt(r.anywhere) + 7, y: yA + barH - 3, "font-size": 14, fill: PAL.ink2 });
      if (r.mandate > 0) {
        svg.appendChild(el("rect", { x: gridL, y: yM, width: Math.max(1, xAt(r.mandate) - gridL), height: barH, rx: 2,
          fill: focus ? H_FOCUS_DARK : H_DARK,
          _tip: `${r.group}\nIn the instruction to the body: ${plural(r.mandate, "text")}\nNamed anywhere: ${r.anywhere}` }));
        text(svg, r.mandate, {
          x: xAt(r.mandate) + 7, y: yM + barH - 3, "font-size": 14, "font-weight": 650,
          fill: focus ? H_FOCUS_DARK : PAL.ink,
        });
      } else {
        // the zero has to be visible, so print it where the dark bar would start
        text(svg, "0", { x: gridL + 7, y: yM + barH - 3, "font-size": 14, "font-weight": 650, fill: PAL.muted });
      }
      if (focus) {
        text(svg, `the only group instruction that became regular: every year since ${H_DATA.runStart}`,
          { x: xAt(r.mandate) + 30, y: yM + barH - 3, "font-size": 14, "font-style": "italic", fill: H_FOCUS_DARK });
      }
    });

    const NOTE = `Texts, of ${H_DATA.total}. ‘In the instruction to the body’: named in the mandate paragraphs, ` +
      `the paragraphs that create, extend or task the body. A group named only in the body’s composition or ` +
      `resources is not counted.`;
    const noteLines = wrapTo(NOTE, 14, D_W - padR - L);
    noteLines.forEach((ln, i) => text(svg, ln, { x: L, y: 622 + i * 20, "font-size": 14, fill: PAL.muted }));
    text(svg, SOURCE_LINE, { x: L, y: 622 + noteLines.length * 20 + 6, "font-size": 13, fill: PAL.muted });

    host.textContent = "";
    host.appendChild(svg);
  }

  function H_TITLE() {
    return `The texts name many groups; the mandate instructs the body to look at one: ` +
      `${H_FOCUS} (${H_DATA.focus.mandate} of ${H_DATA.total} texts)`;
  }
  function H_SUBTITLE() {
    const never = H_DATA.never;
    const most = never.reduce((a, r) => (!a || r.anywhere > a.anywhere ? r : a), null);
    return `${never.map(r => r.group).join(", ")} are named in up to ${most.anywhere} texts ` +
      `and instructed in none.`;
  }

  /* ---------------- chart I: how texts were adopted ---------------- */
  const I_NOVOTE = "#c9c8c3", I_VOTE = "#2a78d6";
  const I_DATA = (() => {
    const per = new Map(YEARS.map(y => {
      const ty = TEXTS.filter(r => (r.year || +String(r.date_adopted || "").slice(0, 4)) === y);
      const voted = ty.filter(r => r.adoption_mode === "Recorded vote").length;
      return [y, { n: ty.length, voted, novote: ty.length - voted }];
    }));
    const share = (from, to) => {
      const a = TEXTS.filter(r => r.year >= from && r.year <= to);
      const v = a.filter(r => r.adoption_mode === "Recorded vote");
      return { n: a.length, v: v.length, pct: a.length ? Math.round(100 * v.length / a.length) : 0 };
    };
    const voted = TEXTS.filter(r => r.adoption_mode === "Recorded vote");
    return {
      per, voted: voted.length, novote: TEXTS.length - voted.length, total: TEXTS.length,
      early: share(YEARS[0], 2015), late: share(2016, YEARS[YEARS.length - 1]),
    };
  })();

  function drawI(host, mode) {
    const shares = mode === "shares";
    const padL = 72, padR = 40;
    const iw = D_W - padL - padR;
    const svg = svgRoot(D_W, D_H);
    svg.setAttribute("style", "display:block;width:100%;height:auto");

    const titleLines = wrapTo(I_TITLE(), 26, iw);
    titleLines.forEach((ln, i) => text(svg, ln, { x: padL - 4, y: 44 + i * 32, "font-size": 26, "font-weight": 650, fill: PAL.ink }));

    const legendY = 44 + titleLines.length * 32 + 22;
    let lx = padL - 4;
    [["Recorded vote", I_VOTE], ["Adopted without a vote", I_NOVOTE]].forEach(([lbl, c]) => {
      svg.appendChild(el("rect", { x: lx, y: legendY - 11, width: 13, height: 13, rx: 2.5, fill: c }));
      text(svg, lbl, { x: lx + 19, y: legendY, "font-size": 15, fill: PAL.ink2 });
      lx += 19 + textW(lbl, 15) + 26;
    });

    const plotT = legendY + 34, plotB = 556;
    const ih = plotB - plotT;
    const totals = YEARS.map(y => I_DATA.per.get(y).n);
    const yMax = shares ? 100 : Math.max(4, Math.ceil((Math.max(...totals) + 1) / 2) * 2);
    for (let t = 0; t <= 4; t++) {
      const yy = plotT + ih - ih * t / 4;
      svg.appendChild(el("line", { x1: padL, x2: D_W - padR, y1: yy, y2: yy, stroke: PAL.grid, "stroke-width": 1 }));
      text(svg, shares ? Math.round(100 * t / 4) + "%" : Math.round(yMax * t / 4),
        { x: padL - 10, y: yy + 5, "text-anchor": "end", "font-size": 14, fill: PAL.muted });
    }
    const slot = iw / YEARS.length, bw = Math.min(34, slot - 20);
    YEARS.forEach((yr, i) => {
      const d = I_DATA.per.get(yr);
      const x = padL + slot * i + (slot - bw) / 2;
      let yCur = plotB;
      [["novote", I_NOVOTE], ["voted", I_VOTE]].forEach(([k, c]) => {
        const v = d[k];
        if (!v) return;
        const h = shares ? (d.n ? ih * v / d.n : 0) : ih * v / yMax;
        svg.appendChild(el("rect", { x, y: yCur - h, width: bw, height: Math.max(1, h - 1), rx: 1.5, fill: c,
          _tip: `${yr} — ${plural(v, "text")} ${k === "voted" ? "put to a recorded vote" : "adopted without a vote"}` +
            (d.n ? `\n${Math.round(100 * v / d.n)}% of the ${plural(d.n, "text")} that year` : "") }));
        if (h >= 17) {
          const lbl = shares ? Math.round(100 * v / d.n) + "%" : String(v);
          if (textW(lbl, 14) < bw - 4) {
            text(svg, lbl, { x: x + bw / 2, y: yCur - h / 2 + 5, "text-anchor": "middle", "font-size": 14,
              "font-weight": 600, fill: k === "voted" ? "#ffffff" : "#0b0b0b" });
          }
        }
        yCur -= h;
      });
      if (!shares && d.n) {
        text(svg, d.n, { x: x + bw / 2, y: plotB - ih * d.n / yMax - 8, "text-anchor": "middle",
          "font-size": 14, "font-weight": 650, fill: PAL.ink });
      }
      text(svg, yr, { x: x + bw / 2, y: plotB + 24, "text-anchor": "middle", "font-size": 14, fill: PAL.ink2 });
      if (shares) {
        text(svg, `n = ${d.n}`, { x: x + bw / 2, y: plotB + 42, "text-anchor": "middle",
          "font-size": 12.5, fill: PAL.muted });
      }
    });
    svg.appendChild(el("line", { x1: padL, x2: D_W - padR, y1: plotB, y2: plotB, stroke: PAL.baseline, "stroke-width": 1 }));

    const NOTE = `Each bar: the texts of that year that create, renew, expand or task a body. ` +
      `‘Adopted without a vote’ means no member requested a recorded vote; it does not mean every member agreed.`;
    const noteLines = wrapTo(NOTE, 14, iw);
    noteLines.forEach((ln, i) => text(svg, ln, { x: padL - 4, y: 622 + i * 20, "font-size": 14, fill: PAL.muted }));
    text(svg, SOURCE_LINE, { x: padL - 4, y: 622 + noteLines.length * 20 + 6, "font-size": 13, fill: PAL.muted });
    host.textContent = "";
    host.appendChild(svg);
  }

  function I_TITLE() {
    return `About two in three texts are put to a vote, before 2016 and since ` +
      `(${I_DATA.early.pct}% and ${I_DATA.late.pct}%)`;
  }

  /* ---------------- chart J: how States voted ---------------- */
  const J_YES = "#2a78d6", J_ABS = "#c9c8c3", J_NO = "#eb6834";
  const J_SEATS = 47, J_MAJORITY = 24;
  const J_DATA = (() => {
    const per = new Map(YEARS.map(y => {
      const v = TEXTS.filter(r => (r.year || 0) === y && r.adoption_mode === "Recorded vote");
      const avg = (f) => v.length ? v.reduce((a, r) => a + (r[f] || 0), 0) / v.length : 0;
      return [y, { n: v.length, yes: avg("votes_yes"), no: avg("votes_no"), abs: avg("votes_abstain") }];
    }));
    const win = (from, to) => {
      const v = TEXTS.filter(r => r.year >= from && r.year <= to && r.adoption_mode === "Recorded vote");
      const avg = (f) => v.length ? v.reduce((a, r) => a + (r[f] || 0), 0) / v.length : 0;
      return { n: v.length, yes: avg("votes_yes"), abs: avg("votes_abstain"),
        below: v.filter(r => (r.votes_yes || 0) < J_MAJORITY).length };
    };
    return { per, early: win(YEARS[0], 2015), late: win(2016, YEARS[YEARS.length - 1]) };
  })();

  function drawJ(host) {
    const padL = 72, padR = 40;
    const iw = D_W - padL - padR;
    const svg = svgRoot(D_W, D_H);
    svg.setAttribute("style", "display:block;width:100%;height:auto");

    const titleLines = wrapTo(J_TITLE(), 26, iw);
    titleLines.forEach((ln, i) => text(svg, ln, { x: padL - 4, y: 44 + i * 32, "font-size": 26, "font-weight": 650, fill: PAL.ink }));

    const legendY = 44 + titleLines.length * 32 + 22;
    let lx = padL - 4;
    [["average Yes", J_YES], ["abstentions", J_ABS], ["No", J_NO]].forEach(([lbl, c]) => {
      svg.appendChild(el("rect", { x: lx, y: legendY - 11, width: 13, height: 13, rx: 2.5, fill: c }));
      text(svg, lbl, { x: lx + 19, y: legendY, "font-size": 15, fill: PAL.ink2 });
      lx += 19 + textW(lbl, 15) + 26;
    });

    const plotT = legendY + 34, plotB = 540;
    const ih = plotB - plotT;
    const yAt = (v) => plotB - ih * v / J_SEATS;
    [0, 12, 24, 36, J_SEATS].forEach(v => {
      svg.appendChild(el("line", { x1: padL, x2: D_W - padR, y1: yAt(v), y2: yAt(v), stroke: PAL.grid, "stroke-width": 1 }));
      text(svg, v, { x: padL - 10, y: yAt(v) + 5, "text-anchor": "end", "font-size": 14, fill: PAL.muted });
    });
    text(svg, `members (of ${J_SEATS} seats)`, { x: padL, y: yAt(J_SEATS) - 10, "font-size": 12.5, fill: PAL.muted });

    const slot = iw / YEARS.length, bw = Math.min(34, slot - 20);
    YEARS.forEach((yr, i) => {
      const d = J_DATA.per.get(yr);
      const x = padL + slot * i + (slot - bw) / 2;
      if (d.n) {
        let yCur = plotB;
        [["yes", J_YES], ["abs", J_ABS], ["no", J_NO]].forEach(([k, c]) => {
          const h = ih * d[k] / J_SEATS;
          if (h <= 0) return;
          svg.appendChild(el("rect", { x, y: yCur - h, width: bw, height: Math.max(1, h - 1), rx: 1.5, fill: c,
            _tip: `${yr} — average ${k === "yes" ? "Yes" : k === "abs" ? "abstentions" : "No"}: ${d[k].toFixed(1)} of ${J_SEATS} seats` +
              `\nacross ${plural(d.n, "recorded vote")} that year` +
              `\nYes ${d.yes.toFixed(1)} · abstain ${d.abs.toFixed(1)} · No ${d.no.toFixed(1)}` }));
          if (k === "yes" && h >= 18) {
            text(svg, d.yes.toFixed(1), { x: x + bw / 2, y: yCur - h / 2 + 5, "text-anchor": "middle",
              "font-size": 13.5, "font-weight": 650, fill: "#ffffff" });
          }
          yCur -= h;
        });
      }
      text(svg, yr, { x: x + bw / 2, y: plotB + 22, "text-anchor": "middle", "font-size": 14, fill: d.n ? PAL.ink2 : PAL.muted });
      text(svg, d.n ? `n = ${d.n}` : "n = 0", { x: x + bw / 2, y: plotB + 40, "text-anchor": "middle",
        "font-size": 12, fill: PAL.muted });
    });
    svg.appendChild(el("line", { x1: padL, x2: D_W - padR, y1: plotB, y2: plotB, stroke: PAL.baseline, "stroke-width": 1 }));

    svg.appendChild(el("line", { x1: padL, x2: D_W - padR, y1: yAt(J_MAJORITY), y2: yAt(J_MAJORITY),
      stroke: PAL.ink, "stroke-width": 1.4, "stroke-dasharray": "6 4", opacity: 0.75 }));
    const emptyIdx = YEARS.findIndex(y => !J_DATA.per.get(y).n);
    const labX = emptyIdx >= 0 ? padL + slot * emptyIdx : padL + 8;
    text(svg, `${J_MAJORITY} = more than half of the ${J_SEATS} seats`,
      { x: labX, y: yAt(J_MAJORITY) - 9, "font-size": 14, "font-weight": 600, fill: PAL.ink });

    const NOTE = `Averages per voted text in each year (n under the bars). Abstentions do not count as votes: ` +
      `a text passes with more Yes than No among those voting, so it can be adopted with fewer than ${J_MAJORITY} in ` +
      `favour — ${J_DATA.late.below} of the ${J_DATA.late.n} texts voted since 2016 were. The gap to ${J_SEATS} is ` +
      `members absent or not voting.`;
    const noteLines = wrapTo(NOTE, 14, iw);
    noteLines.forEach((ln, i) => text(svg, ln, { x: padL - 4, y: 614 + i * 20, "font-size": 14, fill: PAL.muted }));
    text(svg, SOURCE_LINE, { x: padL - 4, y: 614 + noteLines.length * 20 + 6, "font-size": 13, fill: PAL.muted });
    host.textContent = "";
    host.appendChild(svg);
  }

  function J_TITLE() {
    const e = J_DATA.early, l = J_DATA.late;
    return `Since 2016 the average Yes has fallen from ${e.yes.toFixed(1)} to ${l.yes.toFixed(1)} of ${J_SEATS} seats, ` +
      `and abstentions have risen from ${e.abs.toFixed(1)} to ${l.abs.toFixed(1)}`;
  }

  /* ---------------- PNG export ---------------- */
  function downloadPNG(card, filename) {
    const host = $(".sg-chart", card);
    // Re-draw with the light palette so the PNG is legible on its white background,
    // whichever theme the site is in.
    const prev = PAL;
    PAL = LIGHT;
    const stage = document.createElement("div");
    stage.style.cssText = `position:fixed;left:-99999px;top:0;width:${Math.max(host.clientWidth || 960, 960)}px`;
    document.body.appendChild(stage);
    try {
      card._draw(stage);
      const svg = stage.querySelector("svg");
      const W = +svg.getAttribute("width"), H = +svg.getAttribute("height");
      const str = new XMLSerializer().serializeToString(svg);
      const img = new Image();
      img.onload = () => {
        const cv = document.createElement("canvas");
        cv.width = W * 2; cv.height = H * 2;
        const ctx = cv.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.drawImage(img, 0, 0, cv.width, cv.height);
        cv.toBlob((blob) => {
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = filename;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        }, "image/png");
        stage.remove();
      };
      img.onerror = () => { stage.remove(); };
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(str);
    } finally {
      PAL = prev;
    }
  }

  /* ---------------- cards ---------------- */
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const legendHTML = (items) => items.map(([k, t]) =>
    `<span class="lg"><span class="sw" style="background:${ROLE_COLOR[k] || REGION_COLOR[k] || k}"></span>${esc(t)}</span>`).join("");

  const CARDS = [
    {
      id: "A",
      file: "chart-a-resolutions-per-year-by-role.png",
      title: () => `${A_DATA.total} texts, 2006–${YEAR_MAX}: ${A_DATA.totals[1]} extend an existing mechanism, ` +
        `${A_DATA.totals[0]} create one`,
      legend: () => legendHTML(A_LEGEND),
      note: () => "Each column is one calendar year, split by the role of the text; the figure above the column is the year's total.",
      draw: drawA,
    },
    {
      id: "B",
      file: "chart-b-texts-and-bodies-per-situation.png",
      title: () => `${word(B_DATA.rows.length)} situations — four account for ` +
        `${Math.round(100 * B_DATA.top4Texts / TEXTS.length)}% of all texts (${B_DATA.top4Texts} of ${TEXTS.length})`,
      legend: () => `<span class="sg-legend-title">Region of the situation</span>` +
        B_DATA.regionCounts.map(({ region, n }) =>
          `<span class="lg"><span class="sw" style="background:${REGION_COLOR[region]}"></span>${esc(region)} ${n}</span>`).join(""),
      note: () => `OPT / Israel is counted in both Asia-Pacific (the territory) and Western European and others ` +
        `(Israel, a member of that group in Geneva since 1 January 2014). The five counts therefore add up to ` +
        `${B_DATA.regionCounts.reduce((a, x) => a + x.n, 0)} for ${B_DATA.rows.length} situations.` +
        (B_DATA.unassigned
          ? ` ${word(B_DATA.unassigned)} further text created no body and is not shown.`
          : ""),
      draw: drawB,
    },
    {
      id: "C",
      file: "chart-c-bodies-running-per-year.png",
      title: () => `Council-mandated bodies running at the same time: ${C_DATA.first} in ${C_DATA.firstYear}, ` +
        `${C_DATA.recentMin}–${C_DATA.recentMax} every year since 2021`,
      legend: () => `<span class="lg"><span class="sw" style="background:${C_RECENT}"></span>2021 onwards</span>` +
        `<span class="lg"><span class="sw" style="background:${C_EARLY}"></span>2006–2020</span>`,
      note: () => `A body is counted in every calendar year in which its mandate is in force; ` +
        `${lower(word(C_DATA.openEnded.length))} ${C_DATA.openEnded.length === 1 ? "body has" : "bodies have"} ` +
        `no end date in the dataset and are counted through ${YEAR_MAX}. ` +
        `The OPT fact-finding mission of July 2006 (S-1/1), never implemented, is not counted.`,
      draw: drawC,
    },
    {
      id: "D",
      head: "The term each mandate sets",
      // the SVG carries its own title, legend, note and source so the PNG is
      // a finished slide; the card head only holds the controls
      selfContained: true,
      modes: [["counts", "Counts"], ["shares", "Shares"]],
      file: (mode) => `chart-d-mandate-terms-${mode}.png`,
      draw: drawD,
    },
    {
      id: "E",
      head: "Task verbs in each founding mandate",
      selfContained: true,
      file: "chart-e-verbs-per-founding-text.png",
      draw: drawE,
    },
    {
      id: "F",
      head: "Four features of each founding mandate",
      selfContained: true,
      file: "chart-f-founding-mandate-features.png",
      draw: drawF,
    },
    {
      id: "G",
      head: "The fifteen task verbs",
      selfContained: true,
      file: "chart-g-task-verbs-table.png",
      draw: drawG,
    },
    {
      id: "H",
      head: "Groups named, and groups the body is told to look at",
      selfContained: true,
      file: "chart-h-groups-named-vs-instructed.png",
      draw: drawH,
    },
    {
      id: "I",
      head: "How texts were adopted",
      selfContained: true,
      modes: [["counts", "Counts"], ["shares", "Shares"]],
      file: (mode) => `chart-i-adoption-by-year-${mode}.png`,
      draw: drawI,
    },
    {
      id: "J",
      head: "How States voted",
      selfContained: true,
      file: "chart-j-votes-by-year.png",
      draw: drawJ,
    },
    {
      id: "E2",
      head: "Task verbs: what rose is the floor",
      selfContained: true,
      file: "chart-e2-verbs-floor.png",
      draw: drawE2,
    },
    {
      id: "K",
      head: "How each regional group votes, year by year",
      selfContained: true,
      modes: [["all", "All voted texts"], ["noisrael", "Without the Israel docket"]],
      file: (mode) => mode === "noisrael"
        ? "chart-k-regional-groups-by-year-without-israel-docket.png"
        : "chart-k-regional-groups-by-year-all.png",
      draw: drawK,
    },
    {
      id: "L",
      head: "The eight habitual opponents",
      selfContained: true,
      file: "chart-l-habitual-opponents.png",
      draw: drawL,
    },
  ];


  /* ---------------- K. How each regional group votes, year by year ---------------- */
  const K_GROUPS = [
    ["African Group", "African Group"],
    ["Asia-Pacific Group", "Asia-Pacific Group"],
    ["GRULAC (Latin America & Caribbean)", "Latin America and Caribbean"],
    ["Eastern European Group", "Eastern European Group"],
    ["WEOG (Western Europe & Others)", "WEOG"],
  ];
  // Body countries that make a text part of the Israel docket, plus Lebanon 2006 by symbol.
  const K_ISRAEL_COUNTRY = "OPT and Israel";
  const K_ISRAEL_SYMBOL = "A/HRC/RES/S-2/1";
  const K_DATA = (() => {
    const idx = new Map();           // regional group -> indices into D.states
    D.states.forEach((s, i) => {
      if (!idx.has(s.regional_group)) idx.set(s.regional_group, []);
      idx.get(s.regional_group).push(i);
    });
    const bodyCountry = new Map(D.bodies.map(b => [b.short_name, b.country]));
    const isIsrael = (r) => r.symbol === K_ISRAEL_SYMBOL ||
      (r.bodies || []).some(n => bodyCountry.get(n) === K_ISRAEL_COUNTRY);
    const voted = TEXTS.filter(r => r.adoption_mode === "Recorded vote" && D.votes[r.symbol]);
    let absent = 0;
    voted.forEach(r => { for (const ch of D.votes[r.symbol]) if (ch === "X") absent++; });
    const build = (texts) => K_GROUPS.map(([key, label]) => {
      const cols = idx.get(key) || [];
      const per = new Map(YEARS.map(y => [y, { y: 0, a: 0, n: 0 }]));
      texts.forEach(r => {
        const v = D.votes[r.symbol], d = per.get(r.year);
        if (!v || !d) return;
        cols.forEach(i => {
          const c = v[i];
          if (c === "Y") d.y++; else if (c === "A") d.a++; else if (c === "N") d.n++;
        });
      });
      const win = (from, to) => {
        const t = { y: 0, a: 0, n: 0 };
        YEARS.filter(x => x >= from && x <= to).forEach(x => {
          const d = per.get(x); t.y += d.y; t.a += d.a; t.n += d.n;
        });
        t.tot = t.y + t.a + t.n;
        return t;
      };
      return { key, label, per, early: win(YEARS[0], 2015), late: win(2016, YEARS[YEARS.length - 1]) };
    });
    return {
      all: build(voted),
      noIsrael: build(voted.filter(r => !isIsrael(r))),
      nVoted: voted.length,
      nIsrael: voted.filter(isIsrael).length,
      absent,
    };
  })();
  const K_PCT = (part, tot) => (tot ? Math.round(100 * part / tot) : 0);

  function K_TITLE(mode) {
    const rows = mode === "noisrael" ? K_DATA.noIsrael : K_DATA.all;
    const yesLate = (r) => K_PCT(r.late.y, r.late.tot);
    const absLate = (r) => K_PCT(r.late.a, r.late.tot);
    const abstainers = rows.filter(r => absLate(r) > yesLate(r)).map(r => r.label.replace(" Group", ""));
    const yesers = rows.filter(r => yesLate(r) >= 60).map(r => r.label.replace(" Group", ""));
    const list = (a) => a.length < 2 ? (a[0] || "") :
      a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
    if (abstainers.length && yesers.length) {
      return `Since 2016 the ${list(abstainers)} groups mostly abstain; ` +
        `the ${list(yesers)} groups vote Yes`;
    }
    return "How each regional group voted, year by year";
  }

  function drawK(host, mode) {
    const rows = mode === "noisrael" ? K_DATA.noIsrael : K_DATA.all;
    const padL = 58, padR = 34;
    const iw = D_W - padL - padR;
    const svg = svgRoot(D_W, D_H);
    svg.setAttribute("style", "display:block;width:100%;height:auto");

    const titleLines = wrapTo(K_TITLE(mode), 24, iw);
    titleLines.forEach((ln, i) => text(svg, ln, { x: padL - 4, y: 36 + i * 29, "font-size": 24,
      "font-weight": 650, fill: PAL.ink }));

    const legendY = 36 + titleLines.length * 29 + 20;
    let lx = padL - 4;
    [["Yes", J_YES], ["Abstain", J_ABS], ["No", J_NO]].forEach(([lbl, c]) => {
      svg.appendChild(el("rect", { x: lx, y: legendY - 10, width: 12, height: 12, rx: 2.5, fill: c }));
      text(svg, lbl, { x: lx + 17, y: legendY, "font-size": 14, fill: PAL.ink2 });
      lx += 17 + textW(lbl, 14) + 22;
    });

    const top = legendY + 20;
    const axisH = 22;                       // shared year axis under the bottom panel
    const bottom = 612 - axisH;
    const panelH = (bottom - top) / rows.length;
    const headH = 24;                       // room for the panel title inside each panel
    const slot = iw / YEARS.length;
    const bw = Math.min(26, slot * 0.68);

    rows.forEach((row, pi) => {
      const pTop = top + pi * panelH;
      const plotT = pTop + headH, plotB = pTop + panelH - 8;
      const ih = plotB - plotT;

      const e = K_PCT(row.early.y, row.early.tot), l = K_PCT(row.late.y, row.late.tot);
      text(svg, `${row.label} — Yes ${e}% → ${l}%`, { x: padL - 4, y: pTop + 15,
        "font-size": 15, "font-weight": 650, fill: PAL.ink });
      const detail = `abstain ${K_PCT(row.early.a, row.early.tot)}% → ${K_PCT(row.late.a, row.late.tot)}%, ` +
        `No ${K_PCT(row.early.n, row.early.tot)}% → ${K_PCT(row.late.n, row.late.tot)}%`;
      text(svg, detail, { x: D_W - padR, y: pTop + 15, "text-anchor": "end",
        "font-size": 14, fill: PAL.muted });

      svg.appendChild(el("line", { x1: padL, x2: D_W - padR, y1: plotB, y2: plotB,
        stroke: PAL.baseline, "stroke-width": 1 }));
      ["0%", "100%"].forEach((lbl, i) => text(svg, lbl, { x: padL - 10,
        y: i ? plotT + 5 : plotB + 4, "text-anchor": "end", "font-size": 11.5, fill: PAL.muted }));

      YEARS.forEach((yr, i) => {
        const d = row.per.get(yr), tot = d.y + d.a + d.n;
        const x = padL + slot * i + (slot - bw) / 2;
        if (!tot) return;
        let yCur = plotB;
        [["y", J_YES], ["a", J_ABS], ["n", J_NO]].forEach(([k, c]) => {
          const h = ih * d[k] / tot;
          if (h <= 0) return;
          svg.appendChild(el("rect", { x, y: yCur - h, width: bw, height: h, fill: c,
            _tip: `${row.label}, ${yr}\n${k === "y" ? "Yes" : k === "a" ? "Abstain" : "No"}: ` +
              `${d[k]} of ${tot} positions (${Math.round(100 * d[k] / tot)}%)\n` +
              `Yes ${d.y} · abstain ${d.a} · No ${d.n}` }));
          yCur -= h;
        });
      });

      svg.appendChild(el("line", { x1: padL, x2: D_W - padR, y1: plotT + ih / 2, y2: plotT + ih / 2,
        stroke: PAL.ink, "stroke-width": 1, "stroke-dasharray": "5 4", opacity: 0.45 }));

      if (pi === rows.length - 1) {
        YEARS.forEach((yr, i) => {
          text(svg, yr, { x: padL + slot * i + slot / 2, y: plotB + 17, "text-anchor": "middle",
            "font-size": 14, fill: PAL.ink2 });
        });
      }
    });

    const NOTE = `Shares of each group's members voting or abstaining on the texts put to a vote that ` +
      `year (absences excluded). Council membership changes every year. ‘Israel docket’: texts on the ` +
      `Occupied Palestinian Territory and Israel, and Lebanon 2006.`;
    const noteLines = wrapTo(NOTE, 13.5, iw);
    noteLines.forEach((ln, i) => text(svg, ln, { x: padL - 4, y: 640 + i * 18,
      "font-size": 13.5, fill: PAL.muted }));
    text(svg, SOURCE_LINE, { x: padL - 4, y: 640 + noteLines.length * 18 + 6,
      "font-size": 13, fill: PAL.muted });

    host.textContent = "";
    host.appendChild(svg);
  }


  /* ---------------- L. The eight habitual opponents ---------------- */
  const L_MIN_VOTES = 20, L_TOP = 8;
  const L_NO = "#eb6834", L_ABS = "#c9c8c3", L_YES_ISR = "#86b6ef", L_YES_OTH = "#2a78d6";
  const L_SEG_LABEL = { no: "No", abs: "Abstain", yesIsr: "Yes on texts concerning Israel", yesOther: "Yes on other texts" };
  const L_SHORT = {
    "Venezuela (Bolivarian Republic of)": "Venezuela",
    "Bolivia (Plurinational State of)": "Bolivia",
  };
  const L_DATA = (() => {
    const bodyCountry = new Map(D.bodies.map(b => [b.short_name, b.country]));
    const isIsrael = (r) => r.symbol === K_ISRAEL_SYMBOL ||
      (r.bodies || []).some(n => bodyCountry.get(n) === K_ISRAEL_COUNTRY);
    const voted = TEXTS.filter(r => r.adoption_mode === "Recorded vote" && D.votes[r.symbol]);
    const rec = new Map();
    voted.forEach(r => {
      const v = D.votes[r.symbol], isr = isIsrael(r);
      D.states.forEach((s, i) => {
        const c = v[i];
        if (c !== "Y" && c !== "A" && c !== "N") return;
        if (!rec.has(s.state)) rec.set(s.state, { state: s.state, yes: 0, abs: 0, no: 0, yesIsr: 0, other: [] });
        const d = rec.get(s.state);
        if (c === "N") d.no++;
        else if (c === "A") d.abs++;
        else { d.yes++; if (isr) d.yesIsr++; else d.other.push(r.symbol); }
      });
    });
    const rows = [...rec.values()]
      .map(d => Object.assign(d, { cast: d.yes + d.abs + d.no }))
      .filter(d => d.cast >= L_MIN_VOTES)
      .map(d => Object.assign(d, { pctNo: Math.round(100 * d.no / d.cast), yesOther: d.yes - d.yesIsr }))
      .sort((a, b) => (b.no / b.cast) - (a.no / a.cast))
      .slice(0, L_TOP);
    return { rows, maxCast: Math.max(...rows.map(d => d.cast)),
      yesIsr: rows.reduce((a, d) => a + d.yesIsr, 0) };
  })();
  // Short right-hand label naming the texts behind the "Yes on other texts" segment.
  function L_OTHER_LABEL(d) {
    if (!d.other.length) return "";
    const nums = d.other.map(s => s.replace("A/HRC/RES/", "").replace("A/HRC/DEC/", ""));
    const burundi = nums.filter(n => n === "36/2");
    const rest = nums.filter(n => n !== "36/2");
    if (burundi.length && rest.length) return `36/2 + ${rest.length === 4 ? "four" : rest.length} texts in 2026`;
    if (burundi.length) return "36/2 Burundi (2017)";
    return nums.join(", ");
  }

  function drawL(host) {
    const padL = 40, padR = 34;
    const iw = D_W - padL - padR;
    const svg = svgRoot(D_W, D_H);
    svg.setAttribute("style", "display:block;width:100%;height:auto");

    const title = `The ${L_DATA.rows.length === 8 ? "eight" : L_DATA.rows.length} habitual opponents vote No ` +
      `on almost every investigation; ${L_DATA.yesIsr} of their ${L_DATA.rows.reduce((a, d) => a + d.yes, 0)} ` +
      `Yes votes are on texts concerning Israel`;
    const titleLines = wrapTo(title, 25, iw);
    titleLines.forEach((ln, i) => text(svg, ln, { x: padL, y: 42 + i * 31, "font-size": 25,
      "font-weight": 650, fill: PAL.ink }));

    const legendY = 42 + titleLines.length * 31 + 24;
    let lx = padL;
    [["No", L_NO], ["Abstain", L_ABS], ["Yes on texts concerning Israel", L_YES_ISR],
     ["Yes on other texts", L_YES_OTH]].forEach(([lbl, c]) => {
      svg.appendChild(el("rect", { x: lx, y: legendY - 11, width: 13, height: 13, rx: 2.5, fill: c }));
      text(svg, lbl, { x: lx + 19, y: legendY, "font-size": 14, fill: PAL.ink2 });
      lx += 19 + textW(lbl, 14) + 24;
    });

    const nameR = padL + 150;          // state names end here
    const pctR = nameR + 54;           // share of No ends here
    const barL = pctR + 18;
    const barR = D_W - padR - 230;     // leave room for the right-hand label
    const scale = (barR - barL) / L_DATA.maxCast;
    const top = legendY + 30;
    const rowH = (588 - top) / L_DATA.rows.length;
    const bh = Math.min(34, rowH - 14);

    L_DATA.rows.forEach((d, i) => {
      const cy = top + rowH * i + rowH / 2;
      text(svg, L_SHORT[d.state] || d.state, { x: nameR, y: cy + 5, "text-anchor": "end",
        "font-size": 15, "font-weight": 600, fill: PAL.ink });
      text(svg, d.pctNo + "%", { x: pctR, y: cy + 5, "text-anchor": "end",
        "font-size": 15, "font-weight": 650, fill: L_NO });

      let x = barL;
      [["no", L_NO, "#ffffff"], ["abs", L_ABS, "#0b0b0b"],
       ["yesIsr", L_YES_ISR, "#0b0b0b"], ["yesOther", L_YES_OTH, "#ffffff"]].forEach(([k, c, ink]) => {
        const v = d[k], w = v * scale;
        if (w <= 0) return;
        svg.appendChild(el("rect", { x, y: cy - bh / 2, width: w, height: bh, fill: c,
          _tip: `${L_SHORT[d.state] || d.state}\n${L_SEG_LABEL[k]}: ${v} of ${d.cast} votes cast ` +
            `(${Math.round(100 * v / d.cast)}%)\nNo ${d.no} · abstain ${d.abs} · Yes ${d.yes} ` +
            `(${d.yesIsr} on texts concerning Israel, ${d.yesOther} on other texts)` }));
        if (textW(String(v), 14) + 8 <= w) {
          text(svg, v, { x: x + w / 2, y: cy + 5, "text-anchor": "middle", "font-size": 14,
            "font-weight": 600, fill: ink });
        }
        x += w;
      });

      const lab = L_OTHER_LABEL(d);
      if (lab) text(svg, lab, { x: x + 10, y: cy + 5, "font-size": 14, fill: PAL.ink2 });
    });

    const NOTE = `Council members with ${L_MIN_VOTES} or more votes cast on the ` +
      `${TEXTS.filter(r => r.adoption_mode === "Recorded vote").length} recorded votes; years of ` +
      `membership differ (Eritrea 2019–24; the Russian Federation until April 2022), so totals are not ` +
      `comparable across States. ‘Texts concerning Israel’: OPT/Israel and Lebanon 2006.`;
    const noteLines = wrapTo(NOTE, 14, iw);
    noteLines.forEach((ln, i) => text(svg, ln, { x: padL, y: 626 + i * 19, "font-size": 14, fill: PAL.muted }));
    text(svg, SOURCE_LINE, { x: padL, y: 626 + noteLines.length * 19 + 8, "font-size": 13, fill: PAL.muted });

    host.textContent = "";
    host.appendChild(svg);
  }

  /* ---------------- render ---------------- */
  let built = false;
  function build() {
    const host = $("#summary-content");
    if (!host) return;
    PAL = screenPalette();
    host.innerHTML = CARDS.map(c => `
      <div class="panel sg-card" data-card="${c.id}">
        <div class="panel-head"><h2>${esc(c.head || c.title())}</h2>
          <span class="spacer"></span>
          ${c.modes ? `<div class="seg sg-seg" data-card="${c.id}">${c.modes.map((m, i) =>
            `<button data-mode="${m[0]}" aria-pressed="${i === 0}">${esc(m[1])}</button>`).join("")}</div>` : ""}
          <button class="icon-btn sg-png" data-card="${c.id}" title="Save this chart as a PNG image at 2× resolution">⤓ Download PNG</button>
        </div>
        <div class="panel-body">
          <div class="chart-host sg-chart"></div>
          ${c.selfContained ? "" : `<div class="legend sg-legend">${c.legend()}</div>`}
        </div>
        ${c.selfContained ? "" : `<div class="panel-note">${esc(c.note())}</div>
        <div class="sg-source">${esc(SOURCE_LINE)}</div>`}
      </div>`).join("");
    CARDS.forEach(c => {
      const card = host.querySelector(`.sg-card[data-card="${c.id}"]`);
      card._mode = c.modes ? c.modes[0][0] : null;
      card._draw = (h) => c.draw(h, card._mode);
      card._file = () => (typeof c.file === "function" ? c.file(card._mode) : c.file);
      card._draw($(".sg-chart", card));
    });
    host.addEventListener("click", (e) => {
      const b = e.target.closest(".sg-seg button");
      if (!b) return;
      const card = b.closest(".sg-card");
      card._mode = b.dataset.mode;
      $$(".sg-seg button", card).forEach(x => x.setAttribute("aria-pressed", String(x === b)));
      card._draw($(".sg-chart", card));
    });
    host.addEventListener("click", (e) => {
      const b = e.target.closest(".sg-png");
      if (!b) return;
      const card = host.querySelector(`.sg-card[data-card="${b.dataset.card}"]`);
      downloadPNG(card, card._file());
    });
    built = true;
  }
  function redraw() {
    PAL = screenPalette();
    CARDS.forEach(c => {
      const card = document.querySelector(`.sg-card[data-card="${c.id}"]`);
      if (card) card._draw($(".sg-chart", card));
    });
  }
  function activate() {
    if (!built) build(); else redraw();
  }

  /* ---------------- self-registration ---------------- */
  const view = $("#view-summary");
  if (view) {
    const isOn = () => view.classList.contains("active");
    new MutationObserver(() => { if (isOn()) activate(); })
      .observe(view, { attributes: true, attributeFilter: ["class"] });
    let t = null;
    window.addEventListener("resize", () => {
      if (!isOn()) return;
      clearTimeout(t);
      t = setTimeout(redraw, 120);
    });
    // theme switch: the chrome colours change, the series colours do not
    new MutationObserver(() => { if (isOn() && built) redraw(); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    // Direct load / refresh on #/summary: app.js's boot() does not know this route and
    // falls through to Mechanisms, rewriting the hash as it goes — which is why this file
    // is loaded before app.js and reads the entry hash now, then acts once boot() is done.
    const open = () => { if (window.HRCApp) window.HRCApp.setTab("summary"); };
    const wanted = location.hash === "#/summary";
    if (wanted) {
      // after every script in the page has run, so HRCApp exists and boot() is done
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", open, { once: true });
      else open();
      // On a first-ever visit the tour (tour.js, loaded after this file) starts and walks
      // the visitor through the other tabs. Re-open this one once the tour is gone, so a
      // shared #/summary link lands here for someone who has never opened the site.
      const mo = new MutationObserver(() => {
        if (document.querySelector(".tour-backdrop")) { seen = true; return; }
        if (seen) { mo.disconnect(); open(); }
      });
      let seen = !!document.querySelector(".tour-backdrop");
      mo.observe(document.body, { childList: true });
      setTimeout(() => { if (!seen) mo.disconnect(); }, 4000);
    }
    window.addEventListener("hashchange", () => { if (location.hash === "#/summary") open(); });
  }

  window.HRCSummary = { activate, data: { A: A_DATA, B: B_DATA, C: C_DATA, texts: TEXTS.length, bodies: BODIES.length } };
})();
