/* HRC Investigative Mandates — "Summary graphs" tab.
   Presentation-ready charts, drawn live from window.HRC_DATA (never pasted images),
   each with a Download PNG button (2x, white background).

   SCROLL ORDER = THE ORDER OF THE AHRI SCRIPT (v7), which tests three propositions
   in turn. Each proposition draws on more than one kind of evidence, so the charts
   are grouped by argument rather than by variable. Renumbered 1-14 on 5 November 2026;
   the old numbering (1, 2, 2A, 3, 4, 4A, 5-12) is recorded against each entry below.

   I.  "Mechanisms are on the rise, and support is rising with them."
       1. Resolutions per year, by role            — stacked columns, 2006-2026   (was 1)
       2. Bodies running at the same time          — columns per calendar year    (was 3)
       3. Task verbs per founding mandate          — dot chart, read as two bands (was 5)
       4. How texts were adopted                   — stacked columns, counts/shares (was 9)
       5. Average Yes / abstentions / No per voted text                            (was 10)
       6. How each regional group voted, by year                                   (was 11)

   II. "The decision to create a mechanism is highly politicised."
       7. Texts and bodies per situation           — horizontal bars + bodies col (was 2)
       8. Texts and bodies by regional group       — the same two columns, summarised (was 2A)
       9. How long each body actually ran          — one bar per body, 2006-2026  (was 4A)
      10. Members with the highest share of No                                     (was 12)

   III. "Mandates are carefully crafted, and the craft determines what a body can do."
      11. The term each mandate sets               — stacked columns, counts/shares (was 4)
      12. Task verbs: when each one first appears                                  (was 6)
      13. The law named, and the criminal register — two panels, five-year bands   (was 7)
      14. Groups named vs groups instructed        — paired horizontal bars        (was 8)

   To add one: append an entry to CARDS at the bottom ({id, build(host)}) and a
   draw function above it. Nothing else needs touching — but note that the id is the
   visible number, and the exports/summary PNG filenames carry it too.

   This file registers itself: it watches #view-overview for the .active class that
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
  // founding stands apart in blue: it is the only role that brings a body into being.
  // The three roles that act on a body that already exists share one hue, darkening
  // up the stack, so the eye reads "new" against "already running" before it reads
  // the three apart. All three take white labels.
  const ROLE_COLOR = { founding: "#4a77d4", renewal: "#6fc096", expansion: "#2f8f63", tasking: "#17603f" };
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
    // "_tip" marks a data mark with the figures behind it. It is stored as an
    // attribute rather than an SVG <title> because the native tooltip only appears
    // after about a second, which reads as "nothing happens"; attachTips() below
    // puts the text in the site's own tooltip the moment the pointer arrives.
    if (tip) {
      n.setAttribute("data-tip", tip);
      n.setAttribute("cursor", "pointer");
    }
    return n;
  }
  const plural = (n, one, many) => n + " " + (n === 1 ? one : (many || one + "s"));
  // Tooltips name the records behind a mark, not just their number. Long lists are
  // capped so the tooltip stays on screen.
  const TIP_CAP = 18;
  function listTip(items, cap) {
    const n = cap || TIP_CAP;
    const shown = items.slice(0, n).map(x => "· " + x);
    if (items.length > n) shown.push("· …and " + (items.length - n) + " more");
    return shown.join("\n");
  }
  // A State casts one position per text, so a year's list repeats names; show each
  // once with how many of that year's texts it voted that way on.
  function countNames(names) {
    const m = new Map();
    names.forEach(n => m.set(n, (m.get(n) || 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([n, c]) => c > 1 ? `${n} (${c})` : n);
  }
  const shortSymbol = (sym) => String(sym).replace("A/HRC/RES/", "").replace("A/HRC/DEC/", "dec ").replace("A/HRC/", "");

  // Show the site's tooltip for any mark carrying data-tip. One delegated set of
  // listeners per chart, so redrawing a chart does not pile up handlers.
  function attachTips(svg) {
    if (!svg || svg.__tipsOn) return;
    svg.__tipsOn = true;
    const tipOf = (e) => {
      const el2 = e.target && e.target.closest ? e.target.closest("[data-tip]") : null;
      return el2 ? el2.getAttribute("data-tip") : null;
    };
    svg.addEventListener("pointerover", (e) => {
      const txt = tipOf(e);
      if (!txt || !window.HRCTooltip) return;
      const lines = txt.split("\n");
      window.HRCTooltip.show(e, lines[0], lines.slice(1).map(l => ({ label: l, value: "" })));
    });
    svg.addEventListener("pointerout", (e) => {
      if (!window.HRCTooltip) return;
      const to = e.relatedTarget;
      if (to && to.closest && to.closest("[data-tip]")) return;
      window.HRCTooltip.hide();
    });
    svg.addEventListener("pointerleave", () => { if (window.HRCTooltip) window.HRCTooltip.hide(); });
  }
  // Gridlines, bands and the labels drawn on top of the marks all sit above them
  // and would swallow the pointer, so hovering the middle of a bar hit the number
  // printed on it and no tooltip appeared. Only the marks themselves are hoverable.
  //
  // This rule used to be a <style> element appended inside each SVG, written as
  // "*{pointer-events:none}". A <style> inside inline SVG in an HTML document is
  // NOT scoped to that SVG - it applies to the whole page. The selector therefore
  // matched <body> and every tab button, and as soon as one chart had been drawn
  // nothing on the site could be clicked. Scoped to .hrc-svg and injected once.
  const SVG_POINTER_STYLE_ID = "hrc-svg-pointer-rules";
  function ensureSvgPointerRules() {
    if (document.getElementById(SVG_POINTER_STYLE_ID)) return;
    const st = document.createElement("style");
    st.id = SVG_POINTER_STYLE_ID;
    st.textContent = ".hrc-svg *{pointer-events:none}.hrc-svg [data-tip]{pointer-events:auto}";
    document.head.appendChild(st);
  }
  function svgRoot(W, H) {
    ensureSvgPointerRules();
    return el("svg", {
      xmlns: NS, viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img",
      class: "hrc-svg",
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
    const items = new Map(YEARS.map(y => [y, [[], [], [], []]]));
    const unroled = [];
    TEXTS.forEach(r => {
      const y = r.year || +String(r.date_adopted || "").slice(0, 4);
      const i = ROLES.indexOf(r.resolution_role);
      if (i < 0) { unroled.push(r.symbol); return; }
      if (per.has(y)) {
        per.get(y)[i]++;
        items.get(y)[i].push(shortSymbol(r.symbol) + " — " + ((r.bodies || [])[0] || "no body"));
      }
    });
    const totals = ROLES.map((_, i) => YEARS.reduce((a, y) => a + per.get(y)[i], 0));
    return { per, items, totals, unroled, total: TEXTS.length };
  })();

  const B_DATA = (() => {
    const countryByBody = new Map(BODIES.map(b => [b.short_name, situationOf(b.country)]));
    const texts = new Map(SITUATIONS.map(s => [s, 0]));
    const bodies = new Map(SITUATIONS.map(s => [s, 0]));
    const bodyNames = new Map(SITUATIONS.map(s => [s, []]));
    const textItems = new Map(SITUATIONS.map(s => [s, []]));
    BODIES.forEach(b => {
      const s = situationOf(b.country);
      if (s) {
        bodies.set(s, bodies.get(s) + 1);
        // Carry each body's own share of the situation's texts, so the two columns reconcile.
        const n = (b.resolutions || []).length;
        bodyNames.get(s).push({ name: b.short_name, n });
      }
    });
    let unassigned = 0;
    TEXTS.forEach(r => {
      const s = (r.bodies || []).map(n => countryByBody.get(n)).find(Boolean);
      if (!s) { unassigned++; return; }
      texts.set(s, texts.get(s) + 1);
      textItems.get(s).push(shortSymbol(r.symbol));
    });
    const rows = SITUATIONS.slice()
      .sort((a, b) => texts.get(b) - texts.get(a) || bodies.get(b) - bodies.get(a) || a.localeCompare(b))
      .map(s => ({ situation: s, texts: texts.get(s), bodies: bodies.get(s), regions: REGION_OF(s) || [],
        bodyNames: bodyNames.get(s).slice().sort((x, y) => y.n - x.n || x.name.localeCompare(y.name))
          .map(b => `${b.name} [${plural(b.n, "text")}]`),
        // A single text can create or task two bodies at once (S-37/1 did, for the DRC),
        // so the per-body figures can add to more than the situation's text count.
        bodySum: bodyNames.get(s).reduce((a, b) => a + b.n, 0),
        textItems: textItems.get(s) }));
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

  // Chart 8: the same two columns as chart 7, summarised by the regional group of
  // the situation. Each situation is counted ONCE here, so the columns reconcile with
  // the corpus totals; OPT / Israel is placed in Asia-Pacific on geography, while
  // chart 7 shows it in both groups because Israel sits in WEOG in Geneva.
  // The Western European and others group is carried here deliberately, and it is
  // always zero: on geography no situation in the corpus sits in that group. Leaving
  // the row out would hide that, so it is drawn as an explicit zero.
  const BR_ORDER = ["Africa", "Asia-Pacific (incl. Middle East)", "Eastern Europe", "Latin America",
    "Western European and others"];
  const BR_SHORT = {
    "Africa": "Africa",
    "Asia-Pacific (incl. Middle East)": "Asia-Pacific",
    "Eastern Europe": "Eastern Europe",
    "Latin America": "Latin America",
    "Western European and others": "Western Europe and others",
  };
  const BR_DATA = (() => {
    // Primary region: the first group REGION_OF returns that is not WEOG.
    const primary = (sit) => {
      const regs = REGION_OF(sit) || [];
      return regs.filter(r => r !== "Western European and others")[0] || regs[0] || null;
    };
    const blank = () => ({ situations: 0, bodies: 0, texts: 0, founding: 0, voted: 0, names: [], bodyNames: [] });
    const acc = new Map(BR_ORDER.map(r => [r, blank()]));
    const countryByBody = new Map(BODIES.map(b => [b.short_name, situationOf(b.country)]));
    SITUATIONS.forEach(s => {
      const r = primary(s); if (!acc.has(r)) return;
      acc.get(r).situations++; acc.get(r).names.push(label(s));
    });
    BODIES.forEach(b => {
      const r = primary(situationOf(b.country)); if (!acc.has(r)) return;
      acc.get(r).bodies++; acc.get(r).bodyNames.push(b.short_name);
    });
    TEXTS.forEach(t => {
      const s = (t.bodies || []).map(n => countryByBody.get(n)).find(Boolean);
      const r = s ? primary(s) : null; if (!acc.has(r)) return;
      const a = acc.get(r);
      a.texts++;
      if (t.resolution_role === "founding") a.founding++;
      if (t.adoption_mode === "Recorded vote") a.voted++;
    });
    const rows = BR_ORDER.map(r => Object.assign({ region: r }, acc.get(r)))
      .sort((a, b) => b.texts - a.texts);
    return {
      rows,
      totalTexts: rows.reduce((a, r) => a + r.texts, 0),
      totalBodies: rows.reduce((a, r) => a + r.bodies, 0),
      totalSituations: rows.reduce((a, r) => a + r.situations, 0),
    };
  })();

  const C_DATA = (() => {
    const startY = (b) => +String(b.start_date || "").slice(0, 4) || null;
    const endY = (b) => (b.end_date ? +String(b.end_date).slice(0, 4) : YEAR_MAX);
    const bodiesPer = YEARS.map(y => RUNNING.filter(b => {
      const s = startY(b);
      return s && s <= y && y <= endY(b);
    }));
    const values = bodiesPer.map(a => a.length);
    const openEnded = RUNNING.filter(b => !b.end_date);
    const since2021 = YEARS.map((y, i) => (y >= 2021 ? values[i] : null)).filter(v => v !== null);
    return {
      values, openEnded, bodiesPer,
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

  /* ---------------- chart 1 ---------------- */
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
          _tip: `${yr} — ${plural(v, "text")} that ${ROLE_TIP[ROLES[k]]}\n` +
            listTip(A_DATA.items.get(yr)[k]) }));
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
    attachTips(svg);
  }

  const A_LEGEND = [
    ["founding", "founding — creates a mechanism"],
    ["renewal", "renewal — extends it in time"],
    ["expansion", "expansion — widens the investigation itself"],
    ["tasking", "tasking — adds work without widening what is investigated"],
  ];

  /* ---------------- chart 7 (was 2) ---------------- */
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
          _tip: `${label(r.situation)} — ${plural(r.texts, "text")}, ${plural(r.bodies, "body", "bodies")}` +
            (rg ? ` · ${rg}` : "") + `\nBodies:\n` + listTip(r.bodyNames) + (r.bodySum > r.texts
              ? `\n(One text can create or task more than one body, so these add to ${r.bodySum}.)`
              : "") +
            `\nTexts:\n` + listTip(r.textItems, 24),
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
          _tip: `${label(r.situation)} — ${plural(r.bodies, "body", "bodies")}\n` + listTip(r.bodyNames) + (r.bodySum > r.texts
              ? `\n(One text can create or task more than one body, so these add to ${r.bodySum}.)`
              : ""),
        }));
      }
    });
    host.textContent = "";
    host.appendChild(svg);
    attachTips(svg);
  }

  /* ---------------- chart 8 (was 2A) ---------------- */
  // Same two columns as chart 7, one row per regional group. Texts as a bar, bodies
  // as dots, situations as a figure, so the three reconcile with the corpus totals.
  function drawBR(host) {
    // A donut rather than five bars: the question is how the corpus divides, and a
    // ring reads as a division of a whole without repeating a row per region.
    const W = Math.max(host.clientWidth || 960, 300);
    const narrow = W < 640;
    const rows = BR_DATA.rows.filter(r => r.texts > 0);
    const empty = BR_DATA.rows.filter(r => !r.texts);
    const total = BR_DATA.totalTexts;

    const H = narrow ? 420 : 360;
    const cy = narrow ? 150 : H / 2;
    const cx = narrow ? W / 2 : Math.min(230, W * 0.3);
    const R = Math.min(narrow ? 108 : 132, cy - 18);
    const r0 = R * 0.58;
    const svg = svgRoot(W, H);

    const arc = (a0, a1, rOut, rIn) => {
      const pt = (ang, rr) => [cx + rr * Math.cos(ang), cy + rr * Math.sin(ang)];
      const big = a1 - a0 > Math.PI ? 1 : 0;
      const [x0, y0] = pt(a0, rOut), [x1, y1] = pt(a1, rOut);
      const [x2, y2] = pt(a1, rIn), [x3, y3] = pt(a0, rIn);
      return `M${x0} ${y0}A${rOut} ${rOut} 0 ${big} 1 ${x1} ${y1}` +
             `L${x2} ${y2}A${rIn} ${rIn} 0 ${big} 0 ${x3} ${y3}Z`;
    };

    let ang = -Math.PI / 2;
    const seg = [];
    rows.forEach(r => {
      const sweep = 2 * Math.PI * r.texts / total;
      seg.push({ r, a0: ang, a1: ang + sweep, mid: ang + sweep / 2 });
      ang += sweep;
    });

    seg.forEach(({ r, a0, a1, mid }) => {
      const share = Math.round(100 * r.texts / total);
      svg.appendChild(el("path", {
        d: arc(a0, a1 - 0.012, R, r0), fill: REGION_COLOR[r.region] || PAL.baseline,
        _tip: `${r.region}\n${plural(r.texts, "text")} of ${total} (${share}%)` +
          `\n${plural(r.bodies, "body", "bodies")} · ${plural(r.situations, "situation")}` +
          `\n${r.founding} founding · ${r.voted} of ${r.texts} put to a recorded vote` +
          ` (${Math.round(100 * r.voted / r.texts)}%)` +
          `\nSituations:\n` + listTip(r.names.slice().sort(), 24),
      }));
      // the share inside the band, where the band is deep enough to hold it
      if (a1 - a0 > 0.34) {
        const rr = (R + r0) / 2;
        text(svg, share + "%", {
          x: cx + rr * Math.cos(mid), y: cy + rr * Math.sin(mid) + 4,
          "text-anchor": "middle", "font-size": 13, "font-weight": 650, fill: "#ffffff",
        });
      }
    });

    text(svg, total, { x: cx, y: cy - 2, "text-anchor": "middle", "font-size": 30,
      "font-weight": 650, fill: PAL.ink });
    text(svg, "mandating texts", { x: cx, y: cy + 16, "text-anchor": "middle",
      "font-size": 11.5, fill: PAL.muted });
    text(svg, `${BR_DATA.totalBodies} bodies`, { x: cx, y: cy + 32, "text-anchor": "middle",
      "font-size": 11.5, fill: PAL.muted });

    // the key carries the numbers, so the ring itself stays uncluttered
    const kx = narrow ? 18 : cx + R + 46;
    const kyTop = narrow ? cy + R + 34 : cy - (rows.length * 34 + (empty.length ? 44 : 0)) / 2 + 10;
    rows.forEach((r, i) => {
      const y = kyTop + i * 34;
      svg.appendChild(el("rect", { x: kx, y: y - 9, width: 11, height: 11, rx: 2.5,
        fill: REGION_COLOR[r.region] || PAL.baseline }));
      text(svg, BR_SHORT[r.region] || r.region, { x: kx + 18, y, "font-size": 14,
        "font-weight": 600, fill: PAL.ink });
      text(svg, `${plural(r.texts, "text")} (${Math.round(100 * r.texts / total)}%) · ` +
        `${plural(r.bodies, "body", "bodies")} · ${plural(r.situations, "situation")}`,
        { x: kx + 18, y: y + 15, "font-size": 12, fill: PAL.ink2 });
    });
    empty.forEach((r, i) => {
      const y = kyTop + rows.length * 34 + i * 44;
      svg.appendChild(el("rect", { x: kx, y: y - 9, width: 11, height: 11, rx: 2.5,
        fill: "none", stroke: PAL.baseline, "stroke-width": 1, "stroke-dasharray": "2.5 2.5" }));
      text(svg, BR_SHORT[r.region] || r.region, { x: kx + 18, y, "font-size": 14,
        "font-weight": 600, fill: PAL.muted });
      text(svg, "no situation placed in this group on geography; the only WEOG member",
        { x: kx + 18, y: y + 15, "font-size": 12, fill: PAL.muted });
      text(svg, "concerned is Israel, counted above under OPT / Israel",
        { x: kx + 18, y: y + 30, "font-size": 12, fill: PAL.muted });
    });

    host.textContent = "";
    host.appendChild(svg);
    attachTips(svg);
  }

  /* ---------------- chart 9 (was 4A) ---------------- */
  // How long each body actually ran, against chart 11's question of how long the
  // text said it could. For a body still running the bar stops at the build date,
  // not at End Date: for an active fixed-term body End Date is the expiry of its
  // CURRENT period, which is in the future and would overstate the duration.
  const DL_ENDED = "#86b6ef", DL_RUNNING = "#1d3f73";
  const DL_DATA = (() => {
    const BUILD = new Date(String(D.built || "").slice(0, 10) || "2026-11-05");
    const day = 24 * 60 * 60 * 1000;
    const months = (a, b) => (b - a) / (day * 30.4375);
    const rows = RUNNING.map(b => {
      const s = b.start_date ? new Date(b.start_date) : null;
      if (!s) return null;
      const live = /active/i.test(b.mandate_status || "");
      const e = live ? BUILD : (b.end_date ? new Date(b.end_date) : null);
      if (!e || e < s) return null;
      return {
        name: b.short_name, country: b.country, live,
        startY: s.getFullYear() + (s.getMonth() + s.getDate() / 31) / 12,
        endY: e.getFullYear() + (e.getMonth() + e.getDate() / 31) / 12,
        m: months(s, e), start: b.start_date, end: b.end_date,
        type: b.mandate_type,
      };
    }).filter(Boolean).sort((a, b) => a.startY - b.startY);
    const ms = rows.map(r => r.m).sort((a, b) => a - b);
    // True median: for an even count, the mean of the two middle values.
    const medianOf = (a) => {
      const n = a.length;
      if (!n) return 0;
      return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2;
    };
    const meanOf = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
    // Modal duration, to the nearest whole year: the single most common outcome,
    // which neither the median nor the mean shows.
    const modeOf = (a) => {
      const bins = new Map();
      a.forEach(m => { const k = Math.round(m / 12); bins.set(k, (bins.get(k) || 0) + 1); });
      let best = null;
      bins.forEach((n, k) => { if (!best || n > best.n) best = { k, n }; });
      return best || { k: 0, n: 0 };
    };
    const ended = rows.filter(r => !r.live).map(r => r.m).sort((a, b) => a - b);
    const BANDS = [[0, 12, "under a year"], [12, 24, "one to two years"],
      [24, 60, "two to five years"], [60, 120, "five to ten years"], [120, 1e9, "over ten years"]];
    const bands = BANDS.map(([lo, hi, label]) => {
      const a = rows.filter(r => r.m >= lo && r.m < hi);
      return { label, n: a.length, live: a.filter(r => r.live).length };
    });
    return {
      rows, bands, total: rows.length,
      median: medianOf(ms), medianEnded: medianOf(ended),
      mean: meanOf(ms), mode: modeOf(ms), modeEnded: modeOf(ended),
      endedCount: ended.length,
      live: rows.filter(r => r.live).length,
    };
  })();

  const DL_DUR = (m) => {
    if (m < 12) { const n = Math.round(m); return n + (n === 1 ? " month" : " months"); }
    const y = (m / 12).toFixed(m < 24 ? 1 : 0).replace(/\.0$/, "");
    return y + (y === "1" ? " year" : " years");
  };

  function drawDL(host) {
    const W = Math.max(host.clientWidth || 960, 300);
    const narrow = W < 560;
    const rows = DL_DATA.rows;
    const rowH = narrow ? 14 : 16, barH = narrow ? 8 : 10;
    const headH = 20, footH = 18;
    const H = headH + rows.length * rowH + footH + 4;
    const labelW = narrow ? Math.min(132, W * 0.42) : Math.min(230, W * 0.30);
    const durW = narrow ? 48 : 60;
    const padR = 6;
    const iw = Math.max(40, W - labelW - durW - padR);
    const y0 = YEAR_MIN, y1 = YEAR_MAX + 1;
    const X = (yr) => labelW + iw * (yr - y0) / (y1 - y0);
    const fontRow = narrow ? 8.5 : 10;
    const svg = svgRoot(W, H);

    for (let yr = y0; yr <= y1; yr += (narrow ? 5 : 2)) {
      const x = X(yr);
      svg.appendChild(el("line", { x1: x, x2: x, y1: headH - 4, y2: headH + rows.length * rowH + 2,
        stroke: PAL.grid, "stroke-width": 1 }));
      text(svg, yr, { x, y: 12, "text-anchor": "middle", "font-size": narrow ? 9 : 10.5, fill: PAL.muted });
      text(svg, yr, { x, y: H - 5, "text-anchor": "middle", "font-size": narrow ? 9 : 10.5, fill: PAL.muted });
    }

    rows.forEach((r, i) => {
      const y = headH + i * rowH;
      const cy = y + barH / 2;
      text(svg, r.name, {
        x: labelW - 7, y: cy + fontRow * 0.36, "text-anchor": "end",
        "font-size": fontRow, fill: PAL.ink,
      });
      const x1 = X(r.startY), x2 = Math.max(X(r.endY), x1 + 2);
      const tip = r.name + " — " + r.country +
        "\n" + DL_DUR(r.m) + " (" + Math.round(r.m) + " months)" +
        "\nfrom " + r.start + (r.live ? ", still running at the build date" : " to " + r.end) +
        (r.type ? "\nmandate: " + r.type : "");
      svg.appendChild(el("rect", {
        x: x1, y, width: x2 - x1, height: barH, rx: barH / 2,
        fill: r.live ? DL_RUNNING : DL_ENDED, _tip: tip,
      }));
      text(svg, DL_DUR(r.m), {
        x: W - padR, y: cy + fontRow * 0.36, "text-anchor": "end",
        "font-size": fontRow, fill: r.live ? PAL.ink : PAL.ink2,
        "font-weight": r.live ? 600 : 400,
      });
    });
    host.textContent = "";
    host.appendChild(svg);
    attachTips(svg);
  }

  /* ---------------- chart 2 (was 3) ---------------- */
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
        fill: C_RECENT,
        _tip: `${yr} — ${plural(v, "body", "bodies")} running at some point that year\n` +
          listTip(C_DATA.bodiesPer[i].map(b => b.short_name).sort()),
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
    attachTips(svg);
  }

  /* ---------------- chart 11 (was 4): the term each mandate sets ---------------- */
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
    const items = new Map(YEARS.map(y => [y, TERMS.map(() => [])]));
    texts.forEach(r => {
      const y = r.year || +String(r.date_adopted || "").slice(0, 4);
      const i = TERMS.indexOf(r.mandate_term);
      if (per.has(y) && i >= 0) {
        per.get(y)[i]++;
        // For a term set in another form, show the wording itself: "six months",
        // "until it presents a final report", and so on. Asked for 5 November 2026.
        const phrase = r.mandate_term === "other set term" && r.mandate_term_phrase
          ? " \u2014 \u201c" + r.mandate_term_phrase + "\u201d" : "";
        items.get(y)[i].push(shortSymbol(r.symbol) + " \u2014 " + ((r.bodies || [])[0] || "no body") + phrase);
      }
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
    return { per, items, totals, total: texts.length, first24, ongoing };
  })();

  // The texts that set a term in another form, grouped by the kind of term they
  // set, so the chart note states the lengths instead of gesturing at them.
  const D_OTHER_TERMS = (() => {
    const kind = (ph) => {
      const s = String(ph || "").toLowerCase();
      if (/six months/.test(s)) return "six months";
      if (/nine months/.test(s)) return "nine months";
      if (/final report/.test(s)) return "until a final report";
      if (/session/.test(s)) return "to a named session";
      if (/renewal/.test(s)) return "measured to the next renewal";
      if (/until/.test(s)) return "until a political event";
      return "term not recorded";
    };
    const ORDER = ["six months", "nine months", "to a named session", "until a final report",
      "measured to the next renewal", "until a political event", "term not recorded"];
    const texts = TEXTS.filter(r => r.mandate_term === "other set term");
    const counts = new Map();
    texts.forEach(r => { const k = kind(r.mandate_term_phrase); counts.set(k, (counts.get(k) || 0) + 1); });
    const parts = ORDER.filter(k => counts.has(k))
      .map(k => counts.get(k) > 1 ? k + " (" + counts.get(k) + ")" : k);
    return { total: texts.length, summary: parts.join(", ") };
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
          fill: TERM_COLOR[TERMS[k]],
          _tip: D_TIP(yr, TERMS[k], v, tot, shares) + "\n" + listTip(D_DATA.items.get(yr)[k]) }));
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
    const NOTE = `Texts that create or extend a body, coded from the mandate paragraphs.`;
    const noteLines = wrapTo(NOTE, 14, iw);
    noteLines.forEach((ln, i) => text(svg, ln,
      { x: padL - 4, y: 626 + i * 20, "font-size": 14, fill: PAL.muted }));
    text(svg, SOURCE_LINE, { x: padL - 4, y: 626 + noteLines.length * 20 + 6, "font-size": 13, fill: PAL.muted });

    host.textContent = "";
    host.appendChild(svg);
    attachTips(svg);
  }

  function D_TITLE() {
    const i12 = TERMS.indexOf("12 months");
    return `Duration of mandate as set by the resolution, by year`;
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

    const NOTE = `One dot per founding text (n = ${E_DATA.n}), coded from its mandate paragraphs on a ` +
      `15-verb taxonomy. The dash and line show each year's mean, which one text can move. ` +
      `No founding text in ${E_DATA.emptyYears.join(" or ")}.`;
    const noteLines = wrapTo(NOTE, 14, iw);
    noteLines.forEach((ln, i) => text(svg, ln, { x: padL - 4, y: 626 + i * 20, "font-size": 14, fill: PAL.muted }));
    text(svg, SOURCE_LINE, { x: padL - 4, y: 626 + noteLines.length * 20 + 6, "font-size": 13, fill: PAL.muted });

    host.textContent = "";
    host.appendChild(svg);
    attachTips(svg);
  }

  function E_TITLE() {
    return `Tasks assigned in each founding mandate, by year`;
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
    attachTips(svg);
  }

  function F_TITLE() {
    return `Four characteristics of each founding mandate, by year`;
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
    attachTips(svg);
  }

  /* ---------------- chart 3 (was 5): the floor rose (alternative reading of E) ---------------- */
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

    const NOTE = `One dot per founding text (n = ${E_DATA.n}); no yearly mean is drawn.`;
    const noteLines = wrapTo(NOTE, 14, iw);
    noteLines.forEach((ln, i) => text(svg, ln, { x: padL - 4, y: 640 + i * 20, "font-size": 14, fill: PAL.muted }));
    text(svg, SOURCE_LINE, { x: padL - 4, y: 640 + noteLines.length * 20 + 6, "font-size": 13, fill: PAL.muted });

    host.textContent = "";
    host.appendChild(svg);
    attachTips(svg);
  }

  function E2_TITLE() {
    return `Number of tasks in each founding mandate`;
  }

  /* ---------------- chart 14 (was 8): groups named vs groups instructed ---------------- */
  // "Named anywhere" = differentiated_analysis_whole_text; "in the instruction to the
  // body" = differentiated_analysis_mandate, i.e. the paragraphs that create, extend
  // or task the body. "age" is counted but not charted.
  const H_GROUPS = ["women", "girls", "gender", "children",
    "persons with disabilities", "older persons", "minorities"];
  const H_LIGHT = "#c9dcf5", H_DARK = "#2a78d6", H_FOCUS_DARK = "#1d3f73";
  const H_FOCUS = "gender";

  const H_DATA = (() => {
    const lbl = (r) => shortSymbol(r.symbol) + " — " + ((r.bodies || [])[0] || "no body");
    const inAny = (g) => TEXTS.filter(r => (r.differentiated_analysis_whole_text || []).indexOf(g) >= 0);
    const inMan = (g) => TEXTS.filter(r => (r.differentiated_analysis_mandate || []).indexOf(g) >= 0);
    const anywhere = (g) => inAny(g).length;
    const mandate = (g) => inMan(g).length;
    const rows = H_GROUPS.map(g => ({ group: g, anywhere: anywhere(g), mandate: mandate(g),
      anyItems: inAny(g).map(lbl), manItems: inMan(g).map(lbl) }));
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
        fill: H_LIGHT, _tip: `${r.group} — named anywhere in the text: ${plural(r.anywhere, "text")}\n` +
          listTip(r.anyItems, 24) }));
      text(svg, r.anywhere, { x: xAt(r.anywhere) + 7, y: yA + barH - 3, "font-size": 14, fill: PAL.ink2 });
      if (r.mandate > 0) {
        svg.appendChild(el("rect", { x: gridL, y: yM, width: Math.max(1, xAt(r.mandate) - gridL), height: barH, rx: 2,
          fill: focus ? H_FOCUS_DARK : H_DARK,
          _tip: `${r.group} — in the instruction to the body: ${plural(r.mandate, "text")}\n` +
            listTip(r.manItems, 24) }));
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

    const NOTE = `Counts of texts, of ${H_DATA.total}.`;
    const noteLines = wrapTo(NOTE, 14, D_W - padR - L);
    noteLines.forEach((ln, i) => text(svg, ln, { x: L, y: 622 + i * 20, "font-size": 14, fill: PAL.muted }));
    text(svg, SOURCE_LINE, { x: L, y: 622 + noteLines.length * 20 + 6, "font-size": 13, fill: PAL.muted });

    host.textContent = "";
    host.appendChild(svg);
    attachTips(svg);
  }

  function H_TITLE() {
    return `Groups named in the resolution and groups included in the mandate`;
  }
  function H_SUBTITLE() {
    return `Each group, as a count of the ${H_DATA.total} texts in the corpus.`;
  }

  /* ---------------- chart 4 (was 9): how texts were adopted ---------------- */
  const I_NOVOTE = "#c9c8c3", I_VOTE = "#2a78d6";
  const I_DATA = (() => {
    const per = new Map(YEARS.map(y => {
      const ty = TEXTS.filter(r => (r.year || +String(r.date_adopted || "").slice(0, 4)) === y);
      const vt = ty.filter(r => r.adoption_mode === "Recorded vote");
      const nv = ty.filter(r => r.adoption_mode !== "Recorded vote");
      const lbl = (r) => shortSymbol(r.symbol) + " — " + ((r.bodies || [])[0] || "no body");
      return [y, { n: ty.length, voted: vt.length, novote: nv.length,
        itemsVoted: vt.map(r => lbl(r) + (r.tally ? " (" + r.tally + ")" : "")),
        itemsNovote: nv.map(lbl) }];
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

  function drawI(host) {
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
    const yMax = Math.max(4, Math.ceil((Math.max(...totals) + 1) / 2) * 2);
    for (let t = 0; t <= 4; t++) {
      const yy = plotT + ih - ih * t / 4;
      svg.appendChild(el("line", { x1: padL, x2: D_W - padR, y1: yy, y2: yy, stroke: PAL.grid, "stroke-width": 1 }));
      text(svg, Math.round(yMax * t / 4),
        { x: padL - 10, y: yy + 5, "text-anchor": "end", "font-size": 14, fill: PAL.muted });
    }
    const slot = iw / YEARS.length, bw = Math.min(44, slot - 10);
    YEARS.forEach((yr, i) => {
      const d = I_DATA.per.get(yr);
      const x = padL + slot * i + (slot - bw) / 2;
      let yCur = plotB;
      [["novote", I_NOVOTE], ["voted", I_VOTE]].forEach(([k, c]) => {
        const v = d[k];
        if (!v) return;
        const h = ih * v / yMax;
        svg.appendChild(el("rect", { x, y: yCur - h, width: bw, height: Math.max(1, h - 1), rx: 1.5, fill: c,
          _tip: `${yr} — ${plural(v, "text")} ${k === "voted" ? "put to a recorded vote" : "adopted without a vote"}` +
            (d.n ? ` (${Math.round(100 * v / d.n)}% of ${d.n})` : "") + "\n" +
            listTip(k === "voted" ? d.itemsVoted : d.itemsNovote) }));
        const ink = k === "voted" ? "#ffffff" : "#0b0b0b";
        const pct = d.n ? Math.round(100 * v / d.n) + "%" : "";
        if (h >= 32 && pct && textW("(" + pct + ")", 11) < bw - 2) {
          // the count, with its share of the year's texts under it
          text(svg, String(v), { x: x + bw / 2, y: yCur - h / 2, "text-anchor": "middle", "font-size": 14,
            "font-weight": 600, fill: ink });
          text(svg, "(" + pct + ")", { x: x + bw / 2, y: yCur - h / 2 + 15, "text-anchor": "middle",
            "font-size": 11, fill: ink, opacity: 0.85 });
        } else if (h >= 17 && textW(String(v), 14) < bw - 4) {
          text(svg, String(v), { x: x + bw / 2, y: yCur - h / 2 + 5, "text-anchor": "middle", "font-size": 14,
            "font-weight": 600, fill: ink });
        }
        yCur -= h;
      });
      if (d.n) {
        text(svg, d.n, { x: x + bw / 2, y: plotB - ih * d.n / yMax - 8, "text-anchor": "middle",
          "font-size": 14, "font-weight": 650, fill: PAL.ink });
      }
      text(svg, yr, { x: x + bw / 2, y: plotB + 24, "text-anchor": "middle", "font-size": 14, fill: PAL.ink2 });
    });
    svg.appendChild(el("line", { x1: padL, x2: D_W - padR, y1: plotB, y2: plotB, stroke: PAL.baseline, "stroke-width": 1 }));

    const NOTE = `Each bar is the texts of that year that create, renew, expand or task a body; the bracketed figure is that segment's share of the year.`;
    const noteLines = wrapTo(NOTE, 14, iw);
    noteLines.forEach((ln, i) => text(svg, ln, { x: padL - 4, y: 622 + i * 20, "font-size": 14, fill: PAL.muted }));
    text(svg, SOURCE_LINE, { x: padL - 4, y: 622 + noteLines.length * 20 + 6, "font-size": 13, fill: PAL.muted });
    host.textContent = "";
    host.appendChild(svg);
    attachTips(svg);
  }

  function I_TITLE() {
    return `Mode of adoption of mandating texts, by year`;
  }

  /* ---------------- chart 5 (was 10): how States voted ---------------- */
  const J_YES = "#2a78d6", J_ABS = "#c9c8c3", J_NO = "#eb6834";
  const J_SEATS = 47, J_MAJORITY = 24;
  const J_DATA = (() => {
    const per = new Map(YEARS.map(y => {
      const v = TEXTS.filter(r => (r.year || 0) === y && r.adoption_mode === "Recorded vote");
      const avg = (f) => v.length ? v.reduce((a, r) => a + (r[f] || 0), 0) / v.length : 0;
      return [y, { n: v.length, yes: avg("votes_yes"), no: avg("votes_no"), abs: avg("votes_abstain"),
        items: v.map(r => shortSymbol(r.symbol) + " — " + ((r.bodies || [])[0] || "no body") +
          " (" + (r.tally || "") + ")") }];
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
            _tip: `${yr} — average Yes ${d.yes.toFixed(1)}, abstain ${d.abs.toFixed(1)}, No ${d.no.toFixed(1)}` +
              `, of ${J_SEATS} seats\n` + listTip(d.items) }));
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

    const NOTE = `Averages per voted text in each year; n under the bars.`;
    const noteLines = wrapTo(NOTE, 14, iw);
    noteLines.forEach((ln, i) => text(svg, ln, { x: padL - 4, y: 614 + i * 20, "font-size": 14, fill: PAL.muted }));
    text(svg, SOURCE_LINE, { x: padL - 4, y: 614 + noteLines.length * 20 + 6, "font-size": 13, fill: PAL.muted });
    host.textContent = "";
    host.appendChild(svg);
    attachTips(svg);
  }

  function J_TITLE() {
    const e = J_DATA.early, l = J_DATA.late;
    return `Average distribution of votes per recorded vote, by year`;
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

  /* ---------------- chart 13 (was 7): the law named, and the criminal register ----------------
     Two panels on one slide, both over founding mandates only, in five-year bands
     whose last band opens in 2021 — the breakpoint charts 3, 5 and 6 already use.
     Left:  which body of law the mandate paragraph names.
     Right: how far the same paragraph goes toward crime, as an ordered ladder.
     The dataset's ICL code is defined by naming crimes or criminal proceedings, so it
     is the same variable as the right panel's top segment; it is therefore drawn once,
     on the right, and the left panel carries only IHRL, IHL and "neither". */
  const M_FW = [["IHRL", "international human rights law", "#2a78d6"],
                ["IHL", "international humanitarian law", "#6fc096"],
                ["neither", "names violations or the situation directly", "#c9c8c3"]];
  // Terms that show a mandate naming the wrong done rather than the law it falls under.
  const M_HARM = /torture|enforced disappearance|summary execution|sexual violence|arbitrary (?:arrest|detention)|extrajudicial|killing/gi;
  const M_DATA = (() => {
    const found = TEXTS.filter(r => r.resolution_role === "founding");
    const rows = YEARS.map(y => {
      const S = found.filter(r => (r.year || 0) === y);
      const pick = (k) => k === "neither"
        ? S.filter(r => !(r.legal_frameworks || []).length)
        : S.filter(r => (r.legal_frameworks || []).includes(k));
      const lbl = (r) => shortSymbol(r.symbol) + " — " + ((r.bodies || [])[0] || "no body");
      return {
        year: y, n: S.length,
        fw: M_FW.map(([k]) => { const L = pick(k); return { k, v: L.length, items: L.map(lbl) }; }),
      };
    });
    const none = found.filter(r => !(r.legal_frameworks || []).length);
    const named = none.filter(r => { M_HARM.lastIndex = 0; return M_HARM.test(String(r.verbatim_mandate || "")); });
    return {
      rows, n: found.length,
      maxV: Math.max(1, ...rows.map(r => Math.max(...r.fw.map(f => f.v)))),
      noneN: none.length, noneHarm: named.length,
      harmItems: named.map(r => shortSymbol(r.symbol)),
      harmTerms: [...new Set(named.flatMap(r => {
        M_HARM.lastIndex = 0;
        return (String(r.verbatim_mandate || "").match(M_HARM) || []).map(t => t.toLowerCase());
      }))].sort(),
    };
  })();

  function drawM(host) {
    const padL = 72, padR = 40;
    const iw = D_W - padL - padR;
    const svg = svgRoot(D_W, D_H);
    svg.setAttribute("style", "display:block;width:100%;height:auto");

    const T_SIZE = 26;
    const titleLines = wrapTo(M_TITLE(), T_SIZE, iw);
    titleLines.forEach((ln, i) => text(svg, ln, {
      x: padL - 4, y: 44 + i * 32, "font-size": T_SIZE, "font-weight": 650, fill: PAL.ink,
    }));

    const headY = 44 + titleLines.length * 32 + 28;
    text(svg, "Which body of law the mandate paragraph names, by year",
      { x: padL, y: headY, "font-size": 18, "font-weight": 650, fill: PAL.ink });

    // legend
    let lx = padL;
    M_FW.forEach(([k, , c]) => {
      const lbl = k === "neither" ? "names violations or the situation directly, not a body of law" : k;
      svg.appendChild(el("rect", { x: lx, y: headY + 16, width: 12, height: 12, rx: 2.5, fill: c }));
      text(svg, lbl, { x: lx + 17, y: headY + 26, "font-size": 14, fill: PAL.ink2 });
      lx += 17 + textW(lbl, 14) + 22;
    });

    const plotT = headY + 58, plotB = 540;
    const ih = plotB - plotT;
    const maxV = M_DATA.maxV;
    const slot = iw / M_DATA.rows.length;
    const bw = Math.min(14, (slot - 10) / 3);

    // gridlines, one per whole mandate
    for (let t = 0; t <= maxV; t++) {
      const yy = plotB - ih * t / maxV;
      svg.appendChild(el("line", { x1: padL, x2: padL + iw, y1: yy, y2: yy,
        stroke: PAL.grid, "stroke-width": 1 }));
      text(svg, t, { x: padL - 10, y: yy + 5, "text-anchor": "end", "font-size": 13, fill: PAL.muted });
    }
    text(svg, "founding mandates", { x: padL - 10, y: plotT - 14, "text-anchor": "end",
      "font-size": 12.5, fill: PAL.muted });

    M_DATA.rows.forEach((r, i) => {
      const x0 = padL + slot * i + (slot - bw * 3 - 4) / 2;
      r.fw.forEach((f, j) => {
        const x = x0 + j * (bw + 2);
        const h = ih * f.v / maxV;
        if (f.v) {
          svg.appendChild(el("rect", { x, y: plotB - h, width: bw, height: Math.max(2, h), rx: 1.5,
            fill: M_FW[j][2],
            _tip: `${r.year} — ${M_FW[j][1]}\n${plural(f.v, "founding mandate")} of ${r.n} that year\n` +
              listTip(f.items) }));
          text(svg, f.v, { x: x + bw / 2, y: plotB - h - 5, "text-anchor": "middle",
            "font-size": 11.5, "font-weight": 650, fill: PAL.ink2 });
        }
      });
      // year label, every year, rotated so all twenty-one fit
      text(svg, String(r.year), { x: padL + slot * (i + 0.5), y: plotB + 20,
        "text-anchor": "middle", "font-size": 12, fill: r.n ? PAL.ink2 : PAL.muted });
      text(svg, r.n ? "n=" + r.n : "—", { x: padL + slot * (i + 0.5), y: plotB + 36,
        "text-anchor": "middle", "font-size": 11, fill: PAL.muted });
    });
    svg.appendChild(el("line", { x1: padL, x2: padL + iw, y1: plotB, y2: plotB,
      stroke: PAL.baseline, "stroke-width": 1 }));

    // what the third category actually contains, stated rather than left as a negative
    text(svg, `Of the ${M_DATA.noneN} mandates naming no body of law, ${M_DATA.noneHarm} name the wrong itself ` +
      `(${M_DATA.harmTerms.join(", ")}); the other ${M_DATA.noneN - M_DATA.noneHarm} speak of the human rights situation.`,
      { x: padL - 4, y: plotB + 62, "font-size": 13.5, fill: PAL.ink2 });

    const NOTE = `Founding mandates only (${M_DATA.n} texts). A text may name both bodies of law, so the bars are not a division of the year.`;
    const noteLines = wrapTo(NOTE, 14, iw);
    noteLines.forEach((ln, i) => text(svg, ln, { x: padL - 4, y: 622 + i * 20, "font-size": 14, fill: PAL.muted }));
    text(svg, SOURCE_LINE, { x: padL - 4, y: 622 + noteLines.length * 20 + 6, "font-size": 13, fill: PAL.muted });
    host.textContent = "";
    host.appendChild(svg);
    attachTips(svg);
  }

  function M_TITLE() {
    return `Which body of law founding mandates name, year by year`;
  }

  /* ---------------- cards ---------------- */
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const legendHTML = (items) => items.map(([k, t]) =>
    `<span class="lg"><span class="sw" style="background:${ROLE_COLOR[k] || REGION_COLOR[k] || k}"></span>${esc(t)}</span>`).join("");


  /* ---------------- the spoken cards ----------------
     Text panels the same width as the charts, so the whole talk is one scroll
     down this tab: what is counted, the three hypotheses, a card introducing
     each of them, and the verdicts at the end. They carry no number and no
     Download PNG; `prose: true` gives them the plain panel shell. */

  const H1_TEXT = "The number, scope and duration of investigative mandates are on the rise.";
  const H2_TEXT = "Support for them is also increasing.";

  const proseCard = (id, eyebrow, title, bodyHTML) => ({
    id, prose: true,
    html: () => `<div class="sg-prose-in">
      <p class="sg-eyebrow">${eyebrow}</p>
      <h2 class="sg-prose-h">${title}</h2>
      ${bodyHTML}
    </div>`,
  });

  const INCLUDED_CARD = proseCard("included", "What is counted", "Scope of this study", `
    <p class="sg-prose-kicker">Mechanisms that\u2026</p>
    <ol class="sg-crit">
      <li>are <b>mandated by the Human Rights Council</b> \u2014 not the General Assembly, not the Security
        Council, not the Secretary-General;</li>
      <li>are <b>country-specific</b>, not thematic;</li>
      <li>carry a mandate to <b>investigate, find facts or build accountability</b>;</li>
      <li>are a <b>stand-alone team</b>, whether independent or OHCHR-hosted.</li>
    </ol>
    <p class="sg-prose-kicker">Resolutions that\u2026</p>
    <p class="sg-prose-lead sg-prose-tight"><b>create</b> such a mechanism, <b>renew or extend</b> it in time, or
      give it a <b>new investigative, monitoring, evidence or reporting task</b>.</p>`);

  // A reminder to leave the slides and navigate the live dashboard. Presentation tab only.
  const DASHBOARD_CARD = proseCard("dashboard", "The dataset", "The dashboard", `
    <figure class="sg-shot"><img src="assets/img/dashboard.png" alt="The UN Investigative Mandates dashboard"></figure>`);

  const HYPO_CARD = proseCard("hypotheses", "Two hypotheses", "What this paper tests", `
    <ol class="sg-hyp">
      <li><span class="sg-hyp-n">1</span><span>${H1_TEXT}</span></li>
      <li><span class="sg-hyp-n">2</span><span>${H2_TEXT}</span></li>
    </ol>`);

  const H1_CARD = proseCard("h1", "Hypothesis one", H1_TEXT, `
    <p class="sg-prose-lead sg-prose-tight">Three claims in one. Each is measured separately.</p>
    <ol class="sg-crit sg-crit-lead">
      <li><b>Number.</b> How many texts the Council adopts, and how many bodies it is running at once.</li>
      <li><b>Duration.</b> How long the Council gives a body to do the work.</li>
      <li><b>Scope.</b> Which tasks a founding mandate assigns, and how many.</li>
    </ol>`);

  const H2_CARD = proseCard("h2", "Hypothesis two", H2_TEXT, `
    <p class="sg-prose-lead">If the practice has grown, the support for it should have grown too. These charts
      ask whether a text is voted at all, by what margin, how the regional groups vote, which situations recur,
      how mandates end, and who opposes and who supports.</p>`);

  const VERDICT_CARD = proseCard("verdicts", "Conclusions", "What the texts answer", `
    <div class="sg-verdict">
      <div class="sg-v-row">
        <p class="sg-v-h"><span class="sg-hyp-n">1</span>${H1_TEXT}</p>
        <p class="sg-v-a"><b class="sg-yes">Yes — but it has not happened with attention.</b> Three bodies running
          at once in 2006, between fourteen and sixteen every year since 2021. Three task verbs in the Lebanon
          mandate of 2006, and no founding mandate above five before 2014; since 2022 none below eight, averaging
          almost eleven. But term
          length and task load are uncorrelated (r = −0.05): more is asked without more time. Formulas travel word
          for word across continents and six years. And groups are named where naming is free and absent where the
          text binds — women appear in 112 texts and in seven mandates, girls in fifty-two texts and in one.</p>
      </div>
      <div class="sg-v-row">
        <p class="sg-v-h"><span class="sg-hyp-n">2</span>${H2_TEXT}</p>
        <p class="sg-v-a"><b class="sg-no">No.</b> Two thirds of the members in favour before 2016, half since, and
          it has stayed at half for ten years. The two largest groups moved to abstention rather than to opposition.
          Whether a text is voted at all depends on the consent of the State concerned, not on its wording. Four
          situations hold forty-four per cent of the texts. And both ends of the chamber reverse their position on
          one situation: the eight habitual opponents vote yes on every text concerning Israel and on three per cent
          of everything else, while the Western group votes yes on ninety-seven per cent of everything else and
          eighteen per cent of those.</p>
      </div>
    </div>
    <p class="sg-prose-note"><b>What follows.</b> The growth and the support were never connected, because the
      procedure does not connect them: an abstention is not a vote, so a narrower base costs the drafters nothing.
      What decides a vote is which government is in the dock, not how the paragraph is written — which means
      redrafting mandate language is not a route to a wider majority, whatever else it is worth. And one asymmetry
      runs under both hypotheses: every creation leaves a document, and almost no ending does.</p>`);


  const CARDS = [
    {
      id: "1",
      file: "chart-01-resolutions-per-year-by-role.png",
      title: () => `Resolutions and decisions adopted each year, by function`,
      legend: () => legendHTML(A_LEGEND),
      note: () => `One column per calendar year, split by the role of the text.`,
      long: () => `No text in the corpus closes a body: mandates end when a renewal is defeated, never tabled, or simply left to expire, so none of those endings can appear here.

What an expansion looks like: resolution 62/1 of 6 July 2026, on El Obeid, adopted without a vote. OP17 requests the fact-finding mission for the Sudan "to conduct, within its existing resources, an urgent inquiry into any violations and abuses of international human rights law and violations of international humanitarian law and related international crimes, allegedly committed in and around El Obeid". A new theatre of the same conflict, a new inquiry, and the resources clause written into the instruction.`,
      draw: drawA,
    },
    {
      id: "2",
      file: "chart-02-bodies-running-per-year.png",
      title: () => `Mandates in operation in each year`,
      legend: () => "",
      note: () => `A body is counted in every year its mandate is in force.`,
      long: () => `A body is counted in every year its mandate is in force; the ${lower(word(C_DATA.openEnded.length))} with no end date run through ${YEAR_MAX}.`,
      draw: drawC,
    },
    {
      id: "3",
      long: () => `Verbs are read from the mandate paragraphs only, on a fixed 15-verb taxonomy. No yearly mean is drawn, because one text would move it.`,
      head: "Number of tasks in each founding mandate",
      selfContained: true,
      file: "chart-03-task-verbs-per-founding-text.png",
      draw: drawE2,
    },
    {
      id: "4",
      long: () => `“Adopted without a vote” means no member asked for a vote. It does not mean every member agreed.`,
      head: "How the texts were adopted: by vote, or without one",
      selfContained: true,
      file: "chart-04-adoption-by-year.png",
      draw: drawI,
    },
    {
      id: "5",
      long: () => `Abstentions are not votes, so a text can pass with fewer than ${J_MAJORITY} in favour. The gap to ${J_SEATS} is members absent or not voting.`,
      head: "Average votes for, against and abstaining, by year",
      selfContained: true,
      file: "chart-05-votes-by-year.png",
      draw: drawJ,
    },
    {
      id: "6",
      long: () => `Shares are of each group’s members that year, and membership changes annually. The figure above each bar is the positions behind it. 2007 and 2008 are empty: both 2007 texts were adopted without a vote and 2008 produced no mandating text, so there are no recorded positions.`,
      head: "Voting record by regional group and year",
      selfContained: true,
      file: "chart-06-regional-groups-by-year.png",
      draw: drawK,
    },
    {
      id: "7",
      file: "chart-07-texts-and-bodies-per-situation.png",
      title: () => `Texts and bodies, by situation`,
      legend: () => `<span class="sg-legend-title">Region of the situation</span>` +
        B_DATA.regionCounts.map(({ region, n }) =>
          `<span class="lg"><span class="sw" style="background:${REGION_COLOR[region]}"></span>${esc(region)} ${n}</span>`).join(""),
      note: () => `One row per situation; ${B_DATA.rows.length} situations in all.`,
      long: () => `OPT / Israel is counted in two regional groups, so the regional counts total more than the number of situations.`,
      draw: drawB,
    },
    {
      id: "8",
      file: "chart-08-texts-and-bodies-by-region.png",
      title: () => `Texts and bodies, by region of the situation`,
      legend: () => "",
      note: () => `Each ring segment is a regional group's share of the ${BR_DATA.totalTexts} mandating texts; ${BR_DATA.totalBodies} bodies across ${BR_DATA.totalSituations} situations.`,
      long: () => `Each situation is counted once, placed on geography — which puts OPT / Israel in Asia-Pacific, though Israel has sat with the Western European and others group since 2014.`,
      draw: drawBR,
    },
    {
      id: "9",
      file: "chart-09-how-long-each-body-ran.png",
      title: () => `Duration of mandate in practice`,
      legend: () => `<span class="lg"><span class="sw" style="background:${DL_RUNNING}"></span>Still running (${DL_DATA.live})</span>` +
        `<span class="lg"><span class="sw" style="background:${DL_ENDED}"></span>Ended (${DL_DATA.total - DL_DATA.live})</span>`,
      note: () => `One bar per body, in the order they began; median ${DL_DUR(DL_DATA.median)}.`,
      long: () => `A body still running is drawn to the build date, not to its End Date, which for a fixed renewable term is the expiry of the current period.`,
      draw: drawDL,
    },
    {
      id: "10",
      long: () => `Years of membership differ, so totals are not comparable across States. “Texts concerning Israel”: OPT / Israel and Lebanon 2006.`,
      head: "Members with the highest proportion of votes against",
      selfContained: true,
      file: "chart-10-habitual-opponents.png",
      draw: drawL,
    },
    {
      id: "10b",
      long: () => `The other tail of chart 10, on the same members and the same bars. “Texts they did not support” lists each position that was not Yes: N for a vote against, A for an abstention.`,
      head: "Members with the highest proportion of votes in favour",
      selfContained: true,
      file: "chart-10b-habitual-supporters.png",
      draw: drawLY,
    },
    {
      id: "11",
      long: () => `Terms are read from the text that sets them. Taskings set no new period and are not counted here.`,
      head: "Duration of mandate as set by the resolution",
      // the SVG carries its own title, legend, note and source so the PNG is
      // a finished slide; the card head only holds the controls
      selfContained: true,
      modes: [["counts", "Counts"], ["shares", "Shares"]],
      file: (mode) => `chart-11-mandate-terms-${mode}.png`,
      draw: drawD,
    },
    {
      id: "12",
      long: () => `A cell marks a year in which at least one founding mandate carries that verb; the dark cell is its first use. The bracketed phrase is the object the verb recurrently takes in the mandate paragraphs. Renewals and taskings are not shown.`,
      head: "Task verbs in founding mandates",
      selfContained: true,
      file: "chart-12-task-verbs-first-use.png",
      draw: drawV,
    },
    {
      id: "13",
      long: () => `A text may name both bodies of law, so the bars are not a division of the year. The third category means the mandate paragraph names none of IHRL, IHL or international criminal law, and reaches for the conduct instead — 42/25 (Venezuela, 2019) and 4/8 (Darfur, 2007) name torture and extrajudicial killing without naming the law they breach.`,
      head: "Which body of law the mandate names",
      selfContained: true,
      file: "chart-13-law-named-and-criminal-register.png",
      draw: drawM,
    },
    {
      id: "14",
      long: () => `“In the instruction to the body” means named in the mandate paragraphs. A group named only in the body’s composition or resources is not counted.`,
      head: "Groups named in the resolution and groups included in the mandate",
      selfContained: true,
      file: "chart-14-groups-named-vs-instructed.png",
      draw: drawH,
    },
  ];

  /* ---------------- presentation order ----------------
     The Summary graphs tab is the talk, scrolled top to bottom: the spoken
     cards carry the structure and each chart sits under the hypothesis it
     tests. Charts keep their definitions and are renumbered 1-15 in this
     order, so the number on screen is the order it is spoken in.
       hypothesis 1  number and scope, then whether the growth was
                     carried out with any attention              (1-7)
       hypothesis 2  consent, margins, groups, docket, endings,
                     opponents and supporters                    (8-15)
     PNG filenames keep their original numbers; only the on-screen id moves. */
  // Which part of hypothesis one each chart measures, shown as a kicker on the slide.
  const SECTION_OF = {
    1: "1 · Number", 2: "1 · Number",
    3: "2 · Duration",
    4: "3 · Scope", 5: "3 · Scope",
  };

  (() => {
    const ORDER = ["1", "2", "11", "12", "3", "13", "14", "4", "5", "6", "7", "8", "9", "10", "10b"];
    const byId = {};
    CARDS.forEach(c => { byId[c.id] = c; });
    const missing = ORDER.filter(id => !byId[id]);
    if (missing.length) { console.warn("summary: unknown card id", missing); return; }
    const charts = ORDER.map((id, i) => {
      const c = byId[id]; c.id = String(i + 1);
      if (SECTION_OF[i + 1]) c.section = SECTION_OF[i + 1];
      return c;
    });
    CARDS.length = 0;
    CARDS.push(
      INCLUDED_CARD, DASHBOARD_CARD, HYPO_CARD,
      H1_CARD, ...charts.slice(0, 7),
      H2_CARD, ...charts.slice(7),
      VERDICT_CARD
    );
  })();



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
      const per = new Map(YEARS.map(y => [y, { y: 0, a: 0, n: 0, sy: [], sa: [], sn: [] }]));
      texts.forEach(r => {
        const v = D.votes[r.symbol], d = per.get(r.year);
        if (!v || !d) return;
        cols.forEach(i => {
          const c = v[i], st = D.states[i].state;
          if (c === "Y") { d.y++; d.sy.push(st); }
          else if (c === "A") { d.a++; d.sa.push(st); }
          else if (c === "N") { d.n++; d.sn.push(st); }
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

  function K_TITLE() {
    return "Voting record by regional group and year";
  }

  function drawK(host) {
    const rows = K_DATA.all;
    const padL = 58, padR = 34;
    const iw = D_W - padL - padR;
    const svg = svgRoot(D_W, D_H);
    svg.setAttribute("style", "display:block;width:100%;height:auto");

    const titleLines = wrapTo(K_TITLE(), 24, iw);
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
      const nH = 13;                        // strip above each bar carrying its n
      const ih = plotB - plotT - nH;

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
        y: i ? plotT + nH + 5 : plotB + 4, "text-anchor": "end", "font-size": 11.5, fill: PAL.muted }));

      YEARS.forEach((yr, i) => {
        const d = row.per.get(yr), tot = d.y + d.a + d.n;
        const x = padL + slot * i + (slot - bw) / 2;
        if (!tot) return;
        // the absolute number of positions behind the bar: 100% of three votes is not 100% of fifteen
        text(svg, tot, { x: x + bw / 2, y: plotB - ih - 4, "text-anchor": "middle",
          "font-size": 10.5, "font-weight": 600, fill: PAL.muted });
        let yCur = plotB;
        [["y", J_YES], ["a", J_ABS], ["n", J_NO]].forEach(([k, c]) => {
          const h = ih * d[k] / tot;
          if (h <= 0) return;
          svg.appendChild(el("rect", { x, y: yCur - h, width: bw, height: h, fill: c,
            _tip: `${row.label}, ${yr} — ${k === "y" ? "Yes" : k === "a" ? "Abstain" : "No"} ` +
              `${d[k]} of ${tot} positions (${Math.round(100 * d[k] / tot)}%)\n` +
              listTip(countNames(k === "y" ? d.sy : k === "a" ? d.sa : d.sn)) }));
          yCur -= h;
        });
      });

      svg.appendChild(el("line", { x1: padL, x2: D_W - padR, y1: plotB - ih / 2, y2: plotB - ih / 2,
        stroke: PAL.ink, "stroke-width": 1, "stroke-dasharray": "5 4", opacity: 0.45 }));

      if (pi === rows.length - 1) {
        YEARS.forEach((yr, i) => {
          text(svg, yr, { x: padL + slot * i + slot / 2, y: plotB + 17, "text-anchor": "middle",
            "font-size": 14, fill: PAL.ink2 });
        });
      }
    });

    const NOTE = `Shares of each group’s members voting or abstaining that year; absences excluded.`;
    const noteLines = wrapTo(NOTE, 13.5, iw);
    noteLines.forEach((ln, i) => text(svg, ln, { x: padL - 4, y: 640 + i * 18,
      "font-size": 13.5, fill: PAL.muted }));
    text(svg, SOURCE_LINE, { x: padL - 4, y: 640 + noteLines.length * 18 + 6,
      "font-size": 13, fill: PAL.muted });

    host.textContent = "";
    host.appendChild(svg);
    attachTips(svg);
  }


  /* ---------------- L. The eight habitual opponents ---------------- */
  const L_MIN_VOTES = 20, L_TOP = 15;
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
    // The mirror image of the habitual opponents: how often a Western group member did
    // NOT vote Yes, and on which texts. The point of the chart is that both tails have
    // the same exceptions, so the note needs the other tail's figures.
    const K_WEOG = "WEOG (Western Europe & Others)";
    let wNot = 0, wIsr = 0;
    const wOther = new Map();
    voted.forEach(r => {
      const v = D.votes[r.symbol], isr = isIsrael(r);
      D.states.forEach((s, i) => {
        if (s.regional_group !== K_WEOG) return;
        const c = v[i];
        if (c !== "A" && c !== "N") return;
        wNot++;
        if (isr) wIsr++;
        else wOther.set(r.symbol, (wOther.get(r.symbol) || 0) + 1);
      });
    });
    const rec = new Map();
    voted.forEach(r => {
      const v = D.votes[r.symbol], isr = isIsrael(r);
      D.states.forEach((s, i) => {
        const c = v[i];
        if (c !== "Y" && c !== "A" && c !== "N") return;
        if (!rec.has(s.state)) rec.set(s.state, { state: s.state, yes: 0, abs: 0, no: 0, yesIsr: 0,
          other: [], noItems: [], absItems: [], yesIsrItems: [], yesOthItems: [] });
        const d = rec.get(s.state);
        const lbl = shortSymbol(r.symbol) + " — " + ((r.bodies || [])[0] || "no body");
        if (c === "N") { d.no++; d.noItems.push(lbl); }
        else if (c === "A") { d.abs++; d.absItems.push(lbl); }
        else {
          d.yes++;
          if (isr) { d.yesIsr++; d.yesIsrItems.push(lbl); }
          else { d.other.push(r.symbol); d.yesOthItems.push(lbl); }
        }
      });
    });
    const rows = [...rec.values()]
      .map(d => Object.assign(d, { cast: d.yes + d.abs + d.no }))
      .filter(d => d.cast >= L_MIN_VOTES)
      .map(d => Object.assign(d, { pctNo: Math.round(100 * d.no / d.cast), yesOther: d.yes - d.yesIsr }))
      .sort((a, b) => (b.no / b.cast) - (a.no / a.cast))
      .slice(0, L_TOP);
    // the same table sorted the other way: who almost always votes Yes, and when they did not
    const eligible = [...rec.values()]
      .map(d => Object.assign(d, { cast: d.yes + d.abs + d.no }))
      .filter(d => d.cast >= L_MIN_VOTES)
      .map(d => Object.assign(d, { pctYes: Math.round(100 * d.yes / d.cast),
        notYes: d.abs + d.no,
        notYesItems: d.noItems.map(t => t + " \u2014 No").concat(d.absItems.map(t => t + " \u2014 abstained")) }));
    const rowsYes = eligible.slice()
      .sort((a, b) => (b.yes / b.cast) - (a.yes / a.cast) || a.cast - b.cast)
      .slice(0, L_TOP);
    return { rows, rowsYes, maxCastYes: Math.max(...rowsYes.map(d => d.cast)),
      maxCast: Math.max(...rows.map(d => d.cast)),
      yesIsr: rows.reduce((a, d) => a + d.yesIsr, 0),
      weog: { not: wNot, isr: wIsr, other: [...wOther.keys()] } };
  })();
  function drawL(host) {
    const padL = 40, padR = 34;
    const iw = D_W - padL - padR;
    const svg = svgRoot(D_W, D_H);
    svg.setAttribute("style", "display:block;width:100%;height:auto");

    const title = `The ${L_DATA.rows.length} members with the highest share of No, ` +
      `and how their votes divide`;
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
    const barR = D_W - padR - 40;
    const scale = (barR - barL) / L_DATA.maxCast;
    const top = legendY + 30;
    const rowH = (588 - top) / L_DATA.rows.length;
    const bh = Math.min(34, rowH - 9);
    // 15 rows is tighter than 10, so the type steps down with the row
    const fsName = rowH < 36 ? 13 : 15;
    const fsCell = Math.max(10, Math.min(14, Math.round(bh - 6)));

    L_DATA.rows.forEach((d, i) => {
      const cy = top + rowH * i + rowH / 2;
      text(svg, L_SHORT[d.state] || d.state, { x: nameR, y: cy + 5, "text-anchor": "end",
        "font-size": fsName, "font-weight": 600, fill: PAL.ink });
      text(svg, d.pctNo + "%", { x: pctR, y: cy + 5, "text-anchor": "end",
        "font-size": fsName, "font-weight": 650, fill: L_NO });

      let x = barL;
      [["no", L_NO, "#ffffff"], ["abs", L_ABS, "#0b0b0b"],
       ["yesIsr", L_YES_ISR, "#0b0b0b"], ["yesOther", L_YES_OTH, "#ffffff"]].forEach(([k, c, ink]) => {
        const v = d[k], w = v * scale;
        if (w <= 0) return;
        svg.appendChild(el("rect", { x, y: cy - bh / 2, width: w, height: bh, fill: c,
          _tip: `${L_SHORT[d.state] || d.state} — ${L_SEG_LABEL[k]}: ${v} of ${d.cast} votes cast ` +
            `(${Math.round(100 * v / d.cast)}%)\n` +
            listTip(k === "no" ? d.noItems : k === "abs" ? d.absItems : k === "yesIsr" ? d.yesIsrItems
              : d.yesOthItems) }));
        if (textW(String(v), fsCell) + 8 <= w) {
          text(svg, v, { x: x + w / 2, y: cy + fsCell / 2 - 1, "text-anchor": "middle",
            "font-size": fsCell, "font-weight": 600, fill: ink });
        }
        x += w;
      });
    });

    const W = L_DATA.weog;
    const wRest = W.other.length === 1
      ? `the remaining ${W.not - W.isr} are all on one text, ${shortSymbol(W.other[0])} (Burundi, 2017)`
      : `${W.not - W.isr} are on other texts`;
    const NOTE = `Council members with ${L_MIN_VOTES} or more votes cast on the ${TEXTS.filter(r => r.adoption_mode === "Recorded vote").length} recorded votes.`;
    const noteLines = wrapTo(NOTE, 14, iw);
    noteLines.forEach((ln, i) => text(svg, ln, { x: padL, y: 626 + i * 19, "font-size": 14, fill: PAL.muted }));
    text(svg, SOURCE_LINE, { x: padL, y: 626 + noteLines.length * 19 + 8, "font-size": 13, fill: PAL.muted });

    host.textContent = "";
    host.appendChild(svg);
    attachTips(svg);
  }


  /* ---------------- chart V: when each task verb enters a founding mandate ----------------
     Rows are the fifteen verbs, ordered by the year each first appears in a founding
     mandate; columns are years. A cell is marked when at least one founding text that
     year carries the verb, and the first one is ringed. Read down the left edge and the
     staircase is the answer to "what is new": five verbs in 2006, all fifteen by 2018. */
  const V_ORDER = ["investigate", "establish facts", "identify perpetrators", "collect",
    "consolidate", "preserve", "analyse evidence", "document", "verify", "monitor",
    "assess", "report", "make recommendations", "provide guidance", "engage"];
  const V_CELL = "#86b6ef", V_FIRST = "#1d3f73", V_GRID = "#eceae4";
  // The objects each verb actually takes, read off the founding texts themselves rather
  // than glossed by hand: the surface forms below locate the verb in the verbatim mandate
  // and the clause that follows is kept as written, up to the next semicolon. The list is
  // long and repeats little, which is the point — it belongs in a tooltip, not a label.
  const V_SURFACE = {
    "investigate": /\binvestigat(?:e|es|ing|ions? into|ion of)\b/gi,
    "establish facts": /\b(?:establish(?:ing|es)?|determin(?:e|ing))\s+(?:all\s+)?(?:the\s+)?facts?\b/gi,
    "identify perpetrators": /\bidentif(?:y|ies|ying)\b/gi,
    "collect": /\bcollect(?:s|ing)?\b/gi,
    "consolidate": /\bconsolidat(?:e|es|ing)\b/gi,
    "preserve": /\bpreserv(?:e|es|ing)\b/gi,
    "analyse evidence": /\banal(?:y|i)[sz](?:e|es|ing|se|ses|sing)\b/gi,
    "document": /\bdocument(?:s|ing)?\b/gi,
    "verify": /\bverif(?:y|ies|ying|ication of)\b/gi,
    "monitor": /\bmonitor(?:s|ing)?\b/gi,
    "assess": /\bassess(?:es|ing|ment of)?\b/gi,
    "report": /\breport(?:s|ing)?\b/gi,
    "make recommendations": /\brecommend(?:ations? (?:on|for|regarding)|ations?|s|ing)?\b/gi,
    "provide guidance": /\b(?:guidance|advice|advis(?:e|es|ing))\b/gi,
    "engage": /\bengag(?:e|es|ing|ement with)\b/gi,
  };
  const V_PHRASES = (() => {
    const founding = TEXTS.filter(r => r.resolution_role === "founding");
    const bank = {};
    Object.keys(V_SURFACE).forEach(v => {
      const seen = new Map();
      founding.forEach(r => {
        if ((r.action_verbs || []).indexOf(v) < 0) return;
        const t = String(r.verbatim_mandate || "").replace(/\s+/g, " ");
        const rx = V_SURFACE[v]; rx.lastIndex = 0;
        let m;
        while ((m = rx.exec(t))) {
          const from = m.index + m[0].length;
          const win = t.slice(from, from + 100);
          const cut = win.split(";")[0];
          // only drop a trailing part-word when the window itself cut the sentence short
          const clipped = cut.length === win.length && from + 100 < t.length;
          let tail = cut.replace(/^[\s,:]+/, "").replace(/\s+and\s+to\s+.*$/, "");
          if (clipped) tail = tail.replace(/\s+\S*$/, "");
          tail = tail.replace(/[.,]$/, "").trim();
          if (tail.length < 10) continue;
          if (tail.length > 78) tail = tail.slice(0, 76).replace(/\s+\S*$/, "") + "…";
          const key = tail.toLowerCase();
          if (!seen.has(key)) seen.set(key, { phrase: tail, syms: [] });
          const e = seen.get(key);
          if (e.syms.indexOf(r.symbol) < 0) e.syms.push(r.symbol);
        }
      });
      bank[v] = [...seen.values()].sort((a, b) => b.syms.length - a.syms.length ||
        a.phrase.localeCompare(b.phrase));
    });
    return bank;
  })();
  // tooltip body for one verb: the wording as the resolutions have it
  const vTip = (verb) => {
    const list = V_PHRASES[verb] || [];
    if (!list.length) return `${verb}\nno object recorded in the verbatim mandates`;
    const show = list.slice(0, 10)
      .map(e => "· " + e.phrase + "  [" + shortSymbol(e.syms[0]) +
        (e.syms.length > 1 ? ` +${e.syms.length - 1}` : "") + "]");
    const more = list.length > 10 ? `\n… and ${list.length - 10} other formulations` : "";
    return `${verb} — what follows the verb, as the founding texts have it\n` +
      `${list.length} distinct formulations\n\n` + show.join("\n") + more;
  };

  const V_DATA = (() => {
    const founding = TEXTS.filter(r => r.resolution_role === "founding");
    const rows = V_ORDER.map(v => {
      const per = new Map(YEARS.map(y => [y, []]));
      founding.forEach(r => {
        if ((r.action_verbs || []).indexOf(v) < 0) return;
        const y = r.year || +String(r.date_adopted || "").slice(0, 4);
        if (per.has(y)) per.get(y).push(r);
      });
      const firstYear = YEARS.find(y => per.get(y).length) || null;
      const firstText = firstYear ? per.get(firstYear)
        .slice().sort((a, b) => (a.date_adopted || "").localeCompare(b.date_adopted || ""))[0] : null;
      return { verb: v, per, firstYear, firstText, n: founding.filter(r => (r.action_verbs || []).indexOf(v) >= 0).length };
    }).sort((a, b) => (a.firstYear || 9999) - (b.firstYear || 9999) || b.n - a.n);
    // how many of the fifteen are in use in each year, counted cumulatively
    const cum = YEARS.map(y => rows.filter(r => r.firstYear !== null && r.firstYear <= y).length);
    return { rows, cum, nFounding: founding.length };
  })();

  /* ---------------- chart 10b: the other tail ---------------- */
  // The mirror of chart 10. Same members, same bars, sorted by share of Yes, so the
  // two charts can be read against each other. The right-hand column is the point:
  // for a habitual supporter the interesting fact is the handful of texts it did not
  // support, so those are named rather than left in the tooltip.
  function drawLY(host) {
    const padL = 40, padR = 34;
    const iw = D_W - padL - padR;
    const svg = svgRoot(D_W, D_H);
    svg.setAttribute("style", "display:block;width:100%;height:auto");

    const title = `The ${L_DATA.rowsYes.length} members with the highest share of Yes, ` +
      `and the texts they did not support`;
    const titleLines = wrapTo(title, 25, iw);
    titleLines.forEach((ln, i) => text(svg, ln, { x: padL, y: 42 + i * 31, "font-size": 25,
      "font-weight": 650, fill: PAL.ink }));

    const legendY = 42 + titleLines.length * 31 + 24;
    let lx = padL;
    [["Yes on other texts", L_YES_OTH], ["Yes on texts concerning Israel", L_YES_ISR],
     ["Abstain", L_ABS], ["No", L_NO]].forEach(([lbl, c]) => {
      svg.appendChild(el("rect", { x: lx, y: legendY - 11, width: 13, height: 13, rx: 2.5, fill: c }));
      text(svg, lbl, { x: lx + 19, y: legendY, "font-size": 14, fill: PAL.ink2 });
      lx += 19 + textW(lbl, 14) + 24;
    });

    const nameR = padL + 150;
    const pctR = nameR + 54;
    const barL = pctR + 18;
    const barR = D_W - padR - 236;        // room for the occasions column
    const scale = (barR - barL) / L_DATA.maxCastYes;
    const top = legendY + 30;
    const rowH = (588 - top) / L_DATA.rowsYes.length;
    const bh = Math.min(34, rowH - 9);
    // 15 rows is tighter than 10, so the type steps down with the row
    const fsName = rowH < 36 ? 13 : 15;
    const fsCell = Math.max(10, Math.min(14, Math.round(bh - 6)));

    L_DATA.rowsYes.forEach((d, i) => {
      const cy = top + rowH * i + rowH / 2;
      text(svg, L_SHORT[d.state] || d.state, { x: nameR, y: cy + 5, "text-anchor": "end",
        "font-size": fsName, "font-weight": 600, fill: PAL.ink });
      text(svg, d.pctYes + "%", { x: pctR, y: cy + 5, "text-anchor": "end",
        "font-size": fsName, "font-weight": 650, fill: L_YES_OTH });

      let x = barL;
      [["yesOther", L_YES_OTH, "#ffffff"], ["yesIsr", L_YES_ISR, "#0b0b0b"],
       ["abs", L_ABS, "#0b0b0b"], ["no", L_NO, "#ffffff"]].forEach(([k, c, ink]) => {
        const v = d[k], w = v * scale;
        if (w <= 0) return;
        svg.appendChild(el("rect", { x, y: cy - bh / 2, width: w, height: bh, fill: c,
          _tip: `${L_SHORT[d.state] || d.state} — ${L_SEG_LABEL[k]}: ${v} of ${d.cast} votes cast ` +
            `(${Math.round(100 * v / d.cast)}%)\n` +
            listTip(k === "no" ? d.noItems : k === "abs" ? d.absItems : k === "yesIsr" ? d.yesIsrItems
              : d.yesOthItems) }));
        if (textW(String(v), fsCell) + 8 <= w) {
          text(svg, v, { x: x + w / 2, y: cy + fsCell / 2 - 1, "text-anchor": "middle",
            "font-size": fsCell, "font-weight": 600, fill: ink });
        }
        x += w;
      });

      // when it was not Yes
      const ox = barR + 14;
      if (!d.notYes) {
        text(svg, "no exceptions", { x: ox, y: cy + 5, "font-size": fsName - 2, fill: PAL.muted });
      } else {
        const syms = d.noItems.map(t => t.split(" — ")[0] + " N")
          .concat(d.absItems.map(t => t.split(" — ")[0] + " A"));
        const shown = syms.slice(0, 3).join(", ") + (syms.length > 3 ? ` +${syms.length - 3}` : "");
        text(svg, shown, { x: ox, y: cy + 5, "font-size": fsName - 2, fill: PAL.ink2,
          _tip: `${L_SHORT[d.state] || d.state} — ${plural(d.notYes, "position")} that were not Yes\n` +
            listTip(d.notYesItems) });
      }
    });
    text(svg, "N = voted No · A = abstained", { x: barR + 14, y: top - 10,
      "font-size": 11.5, fill: PAL.muted });

    const NOTE = `Council members with ${L_MIN_VOTES} or more votes cast on the ${TEXTS.filter(r => r.adoption_mode === "Recorded vote").length} recorded votes.`;
    const noteLines = wrapTo(NOTE, 14, iw);
    noteLines.forEach((ln, i) => text(svg, ln, { x: padL, y: 626 + i * 19, "font-size": 14, fill: PAL.muted }));
    text(svg, SOURCE_LINE, { x: padL, y: 626 + noteLines.length * 19 + 8, "font-size": 13, fill: PAL.muted });

    host.textContent = "";
    host.appendChild(svg);
    attachTips(svg);
  }

  function drawV(host) {
    const padL = 28, padR = 26;
    const svg = svgRoot(D_W, D_H);
    svg.setAttribute("style", "display:block;width:100%;height:auto");

    const titleLines = wrapTo("Task verbs in founding mandates",
      24, D_W - padL - padR);
    titleLines.forEach((ln, i) => text(svg, ln, { x: padL, y: 36 + i * 29,
      "font-size": 24, "font-weight": 650, fill: PAL.ink }));

    const labelW = 300;
    const gridL = padL + labelW, gridR = D_W - padR - 54;
    const slot = (gridR - gridL) / YEARS.length;
    const top = 36 + titleLines.length * 29 + 34;
    const rowH = 26;

    // year headings
    YEARS.forEach((yr, i) => {
      text(svg, String(yr).slice(2), { x: gridL + slot * (i + 0.5), y: top - 10,
        "text-anchor": "middle", "font-size": 12.5, fill: PAL.muted });
    });

    V_DATA.rows.forEach((r, ri) => {
      const y0 = top + ri * rowH, mid = y0 + rowH / 2;
      if (ri % 2 === 0) {
        svg.appendChild(el("rect", { x: gridL, y: y0, width: gridR - gridL, height: rowH, fill: V_GRID }));
      }
      // the verb label carries its objects on hover; printing them crowded the axis
      svg.appendChild(el("rect", { x: gridL - labelW, y: y0, width: labelW, height: rowH,
        fill: "transparent", _tip: vTip(r.verb) }));
      text(svg, r.verb, { x: gridL - 10, y: mid + 4, "text-anchor": "end",
        "font-size": 14.5, fill: PAL.ink, "pointer-events": "none" });
      // a dotted rule under the verb signals that it carries more on hover
      svg.appendChild(el("line", { x1: gridL - 10 - textW(r.verb, 14.5), y1: mid + 8,
        x2: gridL - 10, y2: mid + 8, stroke: PAL.baseline, "stroke-width": 1,
        "stroke-dasharray": "1.5 2", "pointer-events": "none" }));
      text(svg, r.firstYear || "—", { x: gridR + 50, y: mid + 5, "text-anchor": "end",
        "font-size": 13.5, "font-weight": 650, fill: V_FIRST });

      YEARS.forEach((yr, i) => {
        const hits = r.per.get(yr);
        if (!hits.length) return;
        const first = yr === r.firstYear;
        const cx = gridL + slot * (i + 0.5);
        const w = Math.min(16, slot - 6);
        svg.appendChild(el("rect", {
          x: cx - w / 2, y: mid - 7, width: w, height: 14, rx: 3,
          fill: first ? V_FIRST : V_CELL,
          _tip: `${r.verb} — ${yr}\n${plural(hits.length, "founding text")}` +
            (first ? " · first use" : "") + "\n" +
            listTip(hits.map(t => shortSymbol(t.symbol) + " — " + ((t.bodies || [])[0] || "no body"))),
        }));
      });
    });

    const gridB = top + V_DATA.rows.length * rowH;
    text(svg, "first used", { x: gridR + 50, y: top - 10, "text-anchor": "end",
      "font-size": 12.5, fill: PAL.muted });

    // the staircase, stated: how many of the fifteen the Council had reached by each year
    const cumY = gridB + 26;
    text(svg, "verbs in use by then", { x: gridL - 10, y: cumY + 5, "text-anchor": "end",
      "font-size": 13, "font-weight": 600, fill: PAL.ink2 });
    YEARS.forEach((yr, i) => {
      text(svg, V_DATA.cum[i], { x: gridL + slot * (i + 0.5), y: cumY + 5,
        "text-anchor": "middle", "font-size": 13, "font-weight": 650,
        fill: i && V_DATA.cum[i] > V_DATA.cum[i - 1] ? V_FIRST : PAL.muted });
    });

    const NOTE = `One row per verb, by the year it first appears in a founding mandate (n = ${V_DATA.nFounding}).`;
    const noteLines = wrapTo(NOTE, 14, D_W - padL - padR);
    noteLines.forEach((ln, i) => text(svg, ln, { x: padL, y: cumY + 44 + i * 20,
      "font-size": 14, fill: PAL.muted }));
    text(svg, SOURCE_LINE, { x: padL, y: cumY + 44 + noteLines.length * 20 + 8,
      "font-size": 13, fill: PAL.muted });

    host.textContent = "";
    host.appendChild(svg);
    attachTips(svg);
  }

  /* ---------------- render ---------------- */
  let built = false;
  function build() {
    const host = $("#summary-content");
    if (!host) return;
    PAL = screenPalette();
    // Overview shows charts only; the spoken/prose cards live in the Presentation tab.
    host.innerHTML = CARDS.filter(c => !c.prose).map(c => `
      <div class="panel sg-card" data-card="${c.id}">
        <div class="panel-head"><h2><span class="sg-num">${esc(c.id)}</span>${esc(c.head || c.title())}</h2>
          <span class="spacer"></span>
          ${c.modes ? `<div class="seg sg-seg" data-card="${c.id}">${c.modes.map((m, i) =>
            `<button data-mode="${m[0]}" aria-pressed="${i === 0}">${esc(m[1])}</button>`).join("")}</div>` : ""}
          <button class="icon-btn sg-png" data-card="${c.id}" title="Save this chart as a PNG image at 2× resolution">⤓ Download PNG</button>
        </div>
        <div class="panel-body">
          <div class="chart-host sg-chart"></div>
          ${c.selfContained ? "" : `<div class="legend sg-legend">${c.legend()}</div>`}
        </div>
        ${c.selfContained ? "" : `<div class="panel-note">${esc(c.note())}</div>`}
        ${c.long ? `<div class="panel-note sg-method"><details class="more"><summary>Notes on method</summary>
          <div>${esc(c.long())}</div></details></div>` : ""}
        ${c.selfContained ? "" : `<div class="sg-source">${esc(SOURCE_LINE)}</div>`}
      </div>`).join("");
    CARDS.forEach(c => {
      if (c.prose) return;
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
      if (c.prose) return;            // spoken cards have no chart to redraw
      const card = document.querySelector(`.sg-card[data-card="${c.id}"]`);
      if (card && card._draw) card._draw($(".sg-chart", card));
    });
  }
  function activate() {
    if (!built) build(); else redraw();
  }

  /* ---------------- self-registration ---------------- */
  const view = $("#view-overview");
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
    // Direct load / refresh on #/summary: app.js's boot() does not know this route and
    // falls through to Mechanisms, rewriting the hash as it goes — which is why this file
    // is loaded before app.js and reads the entry hash now, then acts once boot() is done.
    const open = () => { if (window.HRCApp) window.HRCApp.setTab("overview"); };
    const wanted = location.hash === "#/overview" || location.hash === "#/summary";
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
    window.addEventListener("hashchange", () => { if (location.hash === "#/overview" || location.hash === "#/summary") open(); });
  }

  // CARDS is exposed so the Presentation tab can render the same cards full screen,
  // calling the same draw functions - so the charts there keep their tooltips.
  window.HRCSummary = { activate, cards: () => CARDS, palette: () => PAL,
    data: { A: A_DATA, B: B_DATA, C: C_DATA, texts: TEXTS.length, bodies: BODIES.length } };
})();
