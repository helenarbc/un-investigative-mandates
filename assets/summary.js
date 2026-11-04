/* HRC Investigative Mandates — "Summary graphs" tab.
   Presentation-ready charts, drawn live from window.HRC_DATA (never pasted images),
   each with a Download PNG button (2x, white background).

   CHARTS ON THIS TAB
     A. Resolutions per year, by role          — stacked columns, 2006-2026
     B. Texts and bodies per situation         — horizontal bars + bodies column
     C. Bodies running at the same time        — columns per calendar year, 2006-2026
     D. The term each mandate sets             — stacked columns, counts or shares

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
    for (const k in attrs) if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
    return n;
  }
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
        svg.appendChild(el("rect", { x, y: yCur - h, width: bw, height: Math.max(1, h - 1), rx: 1.5, fill: ROLE_COLOR[ROLES[k]] }));
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
  // Founding and renewal texts only; expansions and taskings set no term.
  // mandate_term is coded in scripts/export.py from the verbatim mandate paragraphs.
  const TERMS = ["not stated", "other set term", "12 months", "24 months", "ongoing"];
  const TERM_COLOR = {
    "not stated": "#c9c8c3",
    "other set term": "#eda100",
    "12 months": "#86b6ef",
    "24 months": "#2a78d6",
    "ongoing": "#1d3f73",
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
    const titleLines = (() => {
      const full = D_TITLE();
      if (textW(full, T_SIZE) <= iw) return [full];
      const parts = full.split("; ");
      const lines = [];
      let cur = "";
      parts.forEach((part, i) => {
        const piece = part + (i < parts.length - 1 ? ";" : "");
        const test = cur ? cur + " " + piece : piece;
        if (cur && textW(test, T_SIZE) > iw) { lines.push(cur); cur = piece; }
        else cur = test;
      });
      if (cur) lines.push(cur);
      return lines;
    })();
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
        svg.appendChild(el("rect", { x, y: yCur - h, width: bw, height: Math.max(1, h - 1), rx: 1.5, fill: TERM_COLOR[TERMS[k]] }));
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
      if (n.dot) svg.appendChild(el("circle", { cx, cy: Math.max(ry + 12, top - (shares ? 6 : 26)), r: 3.5, fill: TERM_COLOR.ongoing }));
    });

    text(svg, "Founding and renewal texts only, coded from the mandate paragraphs. " +
      "‘Other set term’: under twelve months, until a final report, or until an event.",
      { x: padL - 4, y: 640, "font-size": 14, fill: PAL.muted });
    text(svg, SOURCE_LINE, { x: padL - 4, y: 666, "font-size": 13, fill: PAL.muted });

    host.textContent = "";
    host.appendChild(svg);
  }

  function D_TITLE() {
    const i12 = TERMS.indexOf("12 months");
    return `Twelve months is the usual term (${D_DATA.totals[i12]} of ${D_DATA.total} texts); ` +
      `two-year terms since ${D_DATA.first24}; ` +
      `${lower(word(D_DATA.ongoing.length))} bodies created with no end date`;
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
      file: "resolutions-per-year-by-role.png",
      title: () => `${A_DATA.total} texts, 2006–${YEAR_MAX}: ${A_DATA.totals[1]} extend an existing mechanism, ` +
        `${A_DATA.totals[0]} create one`,
      legend: () => legendHTML(A_LEGEND),
      note: () => "Each column is one calendar year, split by the role of the text; the figure above the column is the year's total.",
      draw: drawA,
    },
    {
      id: "B",
      file: "texts-and-bodies-per-situation.png",
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
      file: "bodies-running-per-year.png",
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
  ];

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
