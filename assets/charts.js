/* Minimal dependency-free SVG chart helpers.
   Original code for this project (2026). */
(function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";

  function el(name, attrs) {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }

  /* Stacked column chart.
     opts: {categories:[x labels], series:[{key,label,color,values:[]}],
            height, onBarClick(catIndex, seriesKey), tooltip(catIndex) -> [{label,color,value}]} */
  function stackedColumns(host, opts) {
    host.textContent = "";
    const W = Math.max(host.clientWidth || 640, 320);
    const H = opts.height || 220;
    const padL = 34, padR = 6, padT = 8, padB = 22;
    const iw = W - padL - padR, ih = H - padT - padB;
    const n = opts.categories.length;
    if (!n) { host.textContent = "No data for the current filters."; return; }
    const totals = opts.categories.map((_, i) =>
      opts.series.reduce((a, s) => a + (s.values[i] || 0), 0));
    const maxT = Math.max(1, ...totals);
    const yMax = niceCeil(maxT);
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img" });

    // gridlines + y ticks
    const ticks = 4;
    for (let t = 0; t <= ticks; t++) {
      const v = Math.round(yMax * t / ticks);
      const y = padT + ih - ih * t / ticks;
      svg.appendChild(el("line", { x1: padL, x2: W - padR, y1: y, y2: y, stroke: css("--grid"), "stroke-width": 1 }));
      const lbl = el("text", { x: padL - 6, y: y + 4, "text-anchor": "end", "font-size": 10.5, fill: css("--muted") });
      lbl.textContent = v;
      svg.appendChild(lbl);
    }

    const slot = iw / n;
    const bw = Math.min(24, Math.max(3, slot - 2));
    const gap = 2; // surface gap between stacked segments
    opts.categories.forEach((cat, i) => {
      const x = padL + slot * i + (slot - bw) / 2;
      let y = padT + ih;
      opts.series.forEach((s) => {
        const v = s.values[i] || 0;
        if (!v) return;
        const h = ih * v / yMax;
        const hh = Math.max(0, h - gap);
        const seg = el("rect", {
          x, y: y - h, width: bw, height: hh, fill: s.color,
          rx: 2, "data-cat": i, "data-series": s.key, tabindex: -1
        });
        seg.style.cursor = opts.onBarClick ? "pointer" : "default";
        svg.appendChild(seg);
        y -= h;
      });
      // x labels: every k-th to avoid collisions
      const step = Math.ceil(n / Math.floor(iw / 34));
      if (i % step === 0) {
        const xl = el("text", { x: x + bw / 2, y: H - 6, "text-anchor": "middle", "font-size": 10.5, fill: css("--muted") });
        xl.textContent = cat;
        svg.appendChild(xl);
      }
      // transparent hit strip for hover (bigger than the marks)
      const hit = el("rect", { x: padL + slot * i, y: padT, width: slot, height: ih, fill: "transparent", "data-cat": i });
      hit.style.cursor = opts.onBarClick ? "pointer" : "default";
      svg.appendChild(hit);
    });

    svg.appendChild(el("line", { x1: padL, x2: W - padR, y1: padT + ih, y2: padT + ih, stroke: css("--baseline"), "stroke-width": 1 }));

    svg.addEventListener("pointermove", (e) => {
      const t = e.target.getAttribute && e.target.getAttribute("data-cat");
      if (t === null || t === undefined || !opts.tooltip) { return; }
      const rows = opts.tooltip(+t);
      if (rows) window.HRCTooltip.show(e, opts.categories[+t], rows);
    });
    svg.addEventListener("pointerleave", () => window.HRCTooltip.hide());
    if (opts.onBarClick) {
      svg.addEventListener("click", (e) => {
        const c = e.target.getAttribute && e.target.getAttribute("data-cat");
        if (c !== null && c !== undefined) opts.onBarClick(+c, e.target.getAttribute("data-series"));
      });
    }
    host.appendChild(svg);
  }

  /* Horizontal stacked bars (leaderboards).
     opts: {rows:[{label, parts:[{key,label,color,value}], onClick}], width, max} */
  function hBars(host, opts) {
    host.textContent = "";
    const rows = opts.rows;
    if (!rows.length) { host.textContent = "No data for the current filters."; return; }
    const W = Math.max(host.clientWidth || 640, 320);
    const labelW = Math.min(190, W * 0.34);
    const rowH = 24, barH = 14;
    const H = rows.length * rowH + 4;
    const max = opts.max || Math.max(1, ...rows.map(r => r.parts.reduce((a, p) => a + p.value, 0)));
    const iw = W - labelW - 46;
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img" });
    rows.forEach((r, i) => {
      const y = i * rowH + 2;
      const lbl = el("text", { x: labelW - 8, y: y + barH - 3, "text-anchor": "end", "font-size": 12, fill: css("--ink-2") });
      lbl.textContent = r.label;
      if (r.onClick) { lbl.style.cursor = "pointer"; lbl.addEventListener("click", r.onClick); }
      svg.appendChild(lbl);
      let x = labelW;
      let total = 0;
      r.parts.forEach((p) => {
        if (!p.value) return;
        const w = iw * p.value / max;
        svg.appendChild(el("rect", { x, y, width: Math.max(0, w - 2), height: barH, rx: 2, fill: p.color, "data-row": i }));
        x += w; total += p.value;
      });
      const val = el("text", { x: x + 5, y: y + barH - 3, "font-size": 11.5, fill: css("--muted") });
      val.textContent = r.valueText != null ? r.valueText : total;
      svg.appendChild(val);
      const hit = el("rect", { x: 0, y: y - 2, width: W, height: rowH, fill: "transparent", "data-row": i });
      if (r.onClick) { hit.style.cursor = "pointer"; hit.addEventListener("click", r.onClick); }
      svg.appendChild(hit);
    });
    svg.addEventListener("pointermove", (e) => {
      const t = e.target.getAttribute && e.target.getAttribute("data-row");
      if (t === null || t === undefined) return;
      const r = rows[+t];
      window.HRCTooltip.show(e, r.label, r.parts.filter(p => p.value).map(p => ({ label: p.label, color: p.color, value: p.value })));
    });
    svg.addEventListener("pointerleave", () => window.HRCTooltip.hide());
    host.appendChild(svg);
  }

  function niceCeil(v) {
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    for (const m of [1, 2, 2.5, 4, 5, 8, 10]) if (m * p >= v) return m * p;
    return 10 * p;
  }

  /* singleton tooltip */
  const tipEl = () => document.getElementById("tooltip");
  window.HRCTooltip = {
    show(evt, title, rows) {
      const t = tipEl();
      t.textContent = "";
      const h = document.createElement("div");
      h.className = "tt-title";
      h.textContent = title;
      t.appendChild(h);
      (rows || []).forEach((r) => {
        const row = document.createElement("div");
        row.className = "tt-row";
        const l = document.createElement("span");
        if (r.color) {
          const k = document.createElement("i");
          k.className = "dotkey";
          k.style.background = r.color;
          l.appendChild(k);
        }
        l.appendChild(document.createTextNode(r.label));
        const v = document.createElement("span");
        v.className = "tt-val";
        v.textContent = r.value;
        row.appendChild(l); row.appendChild(v);
        t.appendChild(row);
      });
      t.style.display = "block";
      this.move(evt);
    },
    move(evt) {
      const t = tipEl();
      const pad = 14;
      let x = evt.clientX + pad, y = evt.clientY + pad;
      const r = t.getBoundingClientRect();
      if (x + r.width > innerWidth - 8) x = evt.clientX - r.width - pad;
      if (y + r.height > innerHeight - 8) y = evt.clientY - r.height - pad;
      t.style.left = x + "px"; t.style.top = y + "px";
    },
    hide() { tipEl().style.display = "none"; },
  };
  document.addEventListener("pointermove", (e) => {
    const t = tipEl();
    if (t && t.style.display === "block") window.HRCTooltip.move(e);
  });

  window.HRCCharts = { stackedColumns, hBars };
})();
