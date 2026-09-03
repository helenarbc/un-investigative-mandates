/* HRC Investigative Mandates — Reports tab: paragraph explorer + verbatim "Ask".
   Original code for this project (2026). Retrieval concepts (BM25 ranking,
   boolean syntax, zero-hit vocabulary hints) follow published IR practice and
   the spirit of L. Szoszkiewicz's UNHRDB — implemented from scratch.
   NO text is ever generated: results are verbatim paragraphs with citations. */
(function () {
  "use strict";
  const A = () => window.HRCApp;
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const $ = (sel, root) => (root || document).querySelector(sel);
  const fold = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const wsOn = (k) => !!(window.HRCWorkspace && window.HRCWorkspace.has(k));

  const M = window.HRC_PARAGRAPHS || null; // manifest, present once corpus is built
  const state = {
    booted: false,
    shards: new Map(),      // shardName -> true (loaded)
    pending: new Map(),     // shardName -> Promise
    paras: [],              // all loaded paragraphs (search order)
    docs: new Map(),        // rec_id -> doc entry (from shards)
    docShard: new Map(),    // rec_id -> shard file name
    avgdl: 0,
    fBody: "", fType: "", fY0: "", fY1: "",
    lastQuery: "",
  };

  /* ---------- shard loading (script injection: works from file://) ---------- */
  const shardResolvers = new Map(); // shard id -> resolve
  window.__HRC_SHARD = function (payload) {
    (payload.documents || []).forEach(d => {
      state.docs.set(d.rec_id, d);
      state.docShard.set(d.rec_id, payload.shard);
    });
    (payload.paragraphs || []).forEach(p => { p._f = fold(p.text); state.paras.push(p); });
    const res = shardResolvers.get(payload.shard);
    if (res) { res(); shardResolvers.delete(payload.shard); }
  };
  function loadShard(name) {
    if (state.shards.get(name)) return Promise.resolve();
    if (state.pending.has(name)) return state.pending.get(name);
    const p = new Promise((resolve, reject) => {
      shardResolvers.set(name.replace(/\.json$/, ""), resolve);
      const s = document.createElement("script");
      // the shard's content hash from the (versioned) manifest busts stale caches after a rebuild
      const sha = ((window.HRC_PARAGRAPHS || {}).shards || {})[name];
      s.src = "data/paragraphs/" + name.replace(/\.json$/, ".js") + (sha && sha.sha256_16 ? "?h=" + sha.sha256_16 : "");
      s.onerror = () => reject(new Error("Failed to load " + name));
      s.onload = () => setTimeout(resolve, 0); // fallback if ids mismatch
      document.head.appendChild(s);
    }).then(() => { state.shards.set(name, true); state.pending.delete(name); });
    state.pending.set(name, p);
    return p;
  }
  function loadAllShards(onProgress) {
    const names = Object.keys(M.shards || {});
    let done = names.filter(n => state.shards.get(n)).length;
    return Promise.all(names.map(n => loadShard(n).then(() => {
      done++;
      if (onProgress) onProgress(done, names.length);
    })));
  }
  const allLoaded = () => M && Object.keys(M.shards || {}).every(n => state.shards.get(n));

  /* ---------- query parsing (words AND; OR; -exclude; "phrase"; prefix*) ---------- */
  function parseQuery(q) {
    const toks = q.match(/-?"[^"]*"|\S+/g) || [];
    const groups = [];   // array of arrays of alternatives (OR within, AND across)
    const negs = [];
    let cur = null, pendingOr = false;
    for (const t of toks) {
      if (t.toUpperCase() === "OR") { pendingOr = true; continue; }
      if (t.toUpperCase() === "AND") { continue; }
      let neg = false, body = t;
      if (/^-/.test(body) && body.length > 1) { neg = true; body = body.slice(1); }
      if (body.toUpperCase() === "NOT") { continue; }
      let alt = null;
      if (/^"/.test(body)) {
        const phrase = body.replace(/^"|"$/g, "").trim();
        if (phrase) alt = { kind: "phrase", text: phrase };
      } else {
        const prefix = /\*$/.test(body);
        const word = body.replace(/\*+$/, "").replace(/[^\p{L}\p{N}''\-./]/gu, "");
        if (word) alt = { kind: "term", text: word, prefix };
      }
      if (!alt) { pendingOr = false; continue; }
      if (neg) { negs.push(alt); pendingOr = false; continue; }
      if (pendingOr && cur) { cur.push(alt); pendingOr = false; }
      else { cur = [alt]; groups.push(cur); }
    }
    return { groups, negs };
  }
  function syntaxIssue(q) {
    if ((q.match(/"/g) || []).length % 2) return "Close the quoted phrase — quotes come in pairs.";
    const { groups, negs } = parseQuery(q);
    if (!groups.length && negs.length) return "Add at least one positive search term — a query of only exclusions would match everything else.";
    if (!groups.length) return "Type one or more search words, a \"quoted phrase\", or combine them with OR and -exclusions.";
    return null;
  }
  function altRegex(alt) {
    const escRe = (s) => fold(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (alt.kind === "phrase")
      return new RegExp("(^|[^\\p{L}\\p{N}])" + escRe(alt.text).replace(/\s+/g, "[\\s\\u00a0]+") + (alt.prefix ? "" : "($|[^\\p{L}\\p{N}])"), "gu");
    return new RegExp("(^|[^\\p{L}\\p{N}])" + escRe(alt.text) + (alt.prefix ? "" : "($|[^\\p{L}\\p{N}])"), "gu");
  }

  /* ---------- search + BM25 ranking ---------- */
  function docOf(p) { return state.docs.get(p.rec_id) || {}; }
  function paraAllowed(p) {
    const d = docOf(p);
    if (state.fBody && !(d.bodies || []).includes(state.fBody)) return false;
    if (state.fType && d.type !== state.fType) return false;
    if (state.fY0 && (d.year || 0) < +state.fY0) return false;
    if (state.fY1 && (d.year || 0) > +state.fY1) return false;
    return true;
  }
  function runSearch(q) {
    const ast = parseQuery(q);
    const regs = ast.groups.map(g => g.map(altRegex));
    const negRegs = ast.negs.map(altRegex);
    const cand = state.paras.filter(paraAllowed);
    const N = cand.length || 1;
    if (!state.avgdl) state.avgdl = state.paras.reduce((a, p) => a + p._f.length, 0) / (state.paras.length || 1);

    const hits = [];
    const dfs = regs.map(() => 0);
    for (const p of cand) {
      let ok = true;
      const tfs = [];
      for (let gi = 0; gi < regs.length; gi++) {
        let tf = 0;
        for (const re of regs[gi]) {
          re.lastIndex = 0;
          let m;
          while ((m = re.exec(p._f))) { tf++; re.lastIndex = m.index + 1; }
        }
        if (!tf) { ok = false; break; }
        tfs.push(tf);
      }
      if (!ok) continue;
      let neg = false;
      for (const re of negRegs) { re.lastIndex = 0; if (re.test(p._f)) { neg = true; break; } }
      if (neg) continue;
      hits.push({ p, tfs });
      tfs.forEach((_, gi) => dfs[gi]++);
    }
    // BM25 over the AND-matched set
    const k1 = 1.2, b = 0.75;
    for (const h of hits) {
      let s = 0;
      const dl = h.p._f.length;
      h.tfs.forEach((tf, gi) => {
        const idf = Math.log(1 + (N - dfs[gi] + 0.5) / (dfs[gi] + 0.5));
        s += idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * dl / state.avgdl));
      });
      if (h.p.section) s *= 1.02;
      h.score = s;
    }
    hits.sort((a, b2) => b2.score - a.score);
    return { hits, ast };
  }

  /* ---------- citations ---------- */
  function citeOf(p) {
    const d = docOf(p);
    const body = (d.bodies || [])[0] || "";
    const date = d.date ? ` (${A().fmtDate(d.date)})` : "";
    const sym = d.symbol ? `, UN Doc ${d.symbol}` : "";
    const para = p.unnumbered
      ? `, unnumbered paragraph ${p.seq + 1}${p.annex ? ` (annex ${p.annex})` : ""}`
      : `, para. ${p.n}${p.annex ? ` (annex ${p.annex})` : ""}${p.printed ? ` (misprinted as ${p.printed} in the document)` : ""}`;
    return `${body}, "${d.title || d.doc_id}"${sym}${date}${para}.`;
  }
  function paraAnchor(p) { return `#/reports/doc/${encodeURIComponent(p.rec_id)}/${encodeURIComponent(p.id)}`; }

  /* ---------- UI ---------- */
  let sub = "ask"; // ask | browse
  let browseFocus = ""; // mechanism short name set from the Mechanisms tab
  function activate() {
    if (state.booted) return;
    state.booted = true;
    render();
  }
  function showMechanism(bodyName) {
    state.booted = true;
    sub = "browse";
    browseFocus = bodyName;
    render();
  }
  function render() {
    const host = $("#reports-content");
    if (!M) {
      host.innerHTML = `<div class="panel"><div class="panel-body">
        The reports corpus has not been built yet (<code>scripts/build_paragraphs.py</code> +
        <code>scripts/build_dashboard_data.py</code>). The Votes tab works without it.</div></div>`;
      return;
    }
    host.innerHTML = `
      <nav class="subnav" aria-label="Reports views">
        <button data-rsub="ask" aria-selected="${sub === "ask"}">Ask the corpus</button>
        <button data-rsub="browse" aria-selected="${sub === "browse"}">Browse documents</button>
      </nav>
      <div id="reports-body"></div>`;
    host.querySelector(".subnav").addEventListener("click", (e) => {
      const s = e.target.dataset && e.target.dataset.rsub;
      if (!s) return;
      sub = s; render();
    });
    if (sub === "ask") renderAsk();
    else renderBrowse();
  }

  function corpusStats() {
    return `${M.documents} documents · ${M.paragraphs.toLocaleString("en")} paragraphs`;
  }
  function filterRow(docsForOptions) {
    const bodies = [...new Set([...docsForOptions.values()].flatMap(d => d.bodies || []))].sort();
    const types = [...new Set([...docsForOptions.values()].map(d => d.type).filter(Boolean))].sort();
    const years = [...new Set([...docsForOptions.values()].map(d => d.year).filter(Boolean))].sort();
    const opt = (v, l, sel) => `<option value="${esc(v)}"${String(sel) === String(v) ? " selected" : ""}>${esc(l)}</option>`;
    return `<div class="filter-row">
      <div class="f-item"><label>Mechanism</label><select id="rf-body">${opt("", "All")}${bodies.map(b => opt(b, b, state.fBody)).join("")}</select></div>
      <div class="f-item"><label>Document type</label><select id="rf-type">${opt("", "All")}${types.map(t => opt(t, t, state.fType)).join("")}</select></div>
      <div class="f-item"><label>From</label><select id="rf-y0">${opt("", "—")}${years.map(y => opt(y, y, state.fY0)).join("")}</select></div>
      <div class="f-item"><label>To</label><select id="rf-y1">${opt("", "—")}${years.map(y => opt(y, y, state.fY1)).join("")}</select></div>
    </div>`;
  }
  function bindFilterRow(rerun) {
    [["rf-body", "fBody"], ["rf-type", "fType"], ["rf-y0", "fY0"], ["rf-y1", "fY1"]].forEach(([id, key]) => {
      const el = $("#" + id);
      if (el) el.addEventListener("change", (e) => { state[key] = e.target.value; rerun(); });
    });
  }

  /* ---------- Ask view ---------- */
  function renderAsk() {
    const body = $("#reports-body");
    const EXAMPLES = [
      '"crimes against humanity" Myanmar',
      'attacks on hospitals',
      '"enforced disappearance" -Syria',
    ];
    body.innerHTML = `
      <div class="panel"><div class="panel-body">
        <div class="ask-help" style="margin:0 0 8px;font-size:13.5px;color:var(--ink-2)">
          Type any words: you get the exact paragraphs of the mechanisms' reports that contain them, each with its
          citation and UN source — verbatim, nothing is AI-generated.
          <details class="more"><summary>How search works</summary>
            <div><b>What is searched:</b> ${M.documents} documents — the mechanisms' official reports, conference room
            papers (CRPs), annexes and terms of reference. Press releases, oral statements and hearing transcripts
            are <b>not</b> included. Results are ranked by relevance; all your words must appear in the paragraph.<br>
            <b>Syntax:</b> words are combined with AND · <code>"quoted phrase"</code> = exact phrase · <code>OR</code>
            for alternatives · <code>-word</code> excludes · <code>wildcar*</code> matches word beginnings.</div></details></div>
        <div class="ask-box">
          <input type="search" id="ask-input" placeholder='Try: sexual violence detention — or "crimes against humanity"'
            value="${esc(state.lastQuery)}" autocomplete="off">
          <button id="ask-go">Search</button>
        </div>
        <div class="ask-help">Try:
          ${EXAMPLES.map(x => `<button class="chip ask-example" data-q="${esc(x)}">${esc(x)}</button>`).join(" ")}</div>
        <div class="filterbar" style="box-shadow:none;margin:0">${filterRow(state.docs.size ? state.docs : new Map())}</div>
        <div id="ask-status" class="ask-status"></div>
        <div id="ask-progress"></div>
      </div></div>
      <div id="ask-results"></div>`;
    bindFilterRow(() => { if (state.lastQuery) doAsk(state.lastQuery); });
    const go = () => { const q = $("#ask-input").value.trim(); if (q) doAsk(q); };
    $("#ask-go").addEventListener("click", go);
    $("#ask-input").addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
    body.querySelectorAll(".ask-example").forEach(b => b.addEventListener("click", () => {
      $("#ask-input").value = b.dataset.q;
      doAsk(b.dataset.q);
    }));
    if (state.lastQuery && allLoaded()) doAsk(state.lastQuery);
    else if (!allLoaded()) {
      $("#ask-status").textContent = `Corpus: ${corpusStats()}. Shards load on your first search and are then cached by the browser.`;
    }
  }

  function doAsk(q) {
    state.lastQuery = q;
    const status = $("#ask-status"), results = $("#ask-results"), prog = $("#ask-progress");
    const issue = syntaxIssue(q);
    if (issue) { status.textContent = issue; results.innerHTML = ""; return; }
    const t0 = performance.now();
    const proceed = () => {
      const { hits } = runSearch(q);
      const ms = Math.round(performance.now() - t0);
      renderResults(q, hits, ms);
    };
    if (allLoaded()) { proceed(); return; }
    status.textContent = "Loading the corpus for the first search…";
    prog.innerHTML = `<div class="progress"><i style="width:5%"></i></div>`;
    loadAllShards((done, total) => {
      prog.querySelector("i").style.width = Math.round(done / total * 100) + "%";
    }).then(() => { prog.innerHTML = ""; proceed(); })
      .catch(() => { status.textContent = "Some corpus files failed to load — results may be incomplete."; proceed(); });
  }

  function renderResults(q, hits, ms) {
    const status = $("#ask-status"), results = $("#ask-results");
    if (!hits.length) {
      status.textContent = `No paragraph matches "${q}" (searched ${state.paras.filter(paraAllowed).length.toLocaleString("en")} paragraphs in ${ms} ms).`;
      const syn = (window.HRC_SYNONYMS || {})[q.toLowerCase().replace(/\s+/g, " ").trim()];
      results.innerHTML = `<div class="panel"><div class="panel-body">
        ${syn ? `<p style="margin:0 0 6px"><b>Did you also try:</b> ${syn.map(s =>
          `<button class="chip" data-try="${esc(s)}">${esc(s)}</button>`).join(" ")}</p>` : ""}
        <p style="color:var(--muted);font-size:13px;margin:6px 0 0">Tips: UN reports use formal vocabulary
        (e.g. "sexual and gender-based violence", "arbitrary detention", "enforced disappearance").
        Try fewer or broader words, a <code>wildcar*</code> prefix, or OR-alternatives.</p>
      </div></div>`;
      results.addEventListener("click", (e) => {
        const t = e.target.dataset && e.target.dataset.try;
        if (t) { $("#ask-input").value = t; doAsk(t); }
      }, { once: true });
      return;
    }
    const uniqueDocs = new Set(hits.map(h => h.p.rec_id)).size;
    status.textContent = `${hits.length.toLocaleString("en")} matching paragraphs in ${uniqueDocs} documents (${ms} ms). Ranked by relevance; every result is verbatim.`;
    const top = hits.slice(0, 100);
    const hlRegs = parseQuery(q).groups.flat().map(altRegex);
    results.innerHTML = top.map(({ p }) => paraCard(p, hlRegs)).join("") +
      (hits.length > 100 ? `<div class="panel-note" style="padding:10px 4px">Showing the 100 most relevant of ${hits.length.toLocaleString("en")} matches — narrow the query or the filters to see the rest.</div>` : "");
    bindParaCards(results);
  }

  function highlight(text, regs) {
    // find match spans on the folded text, then mark the same spans in the original
    const f = fold(text);
    const spans = [];
    for (const re of regs) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(f))) {
        const lead = m[1] ? m[1].length : 0;
        spans.push([m.index + lead, m.index + m[0].length - (m[2] ? m[2].length : 0)]);
        re.lastIndex = m.index + 1;
      }
    }
    if (!spans.length) return esc(text);
    spans.sort((a, b) => a[0] - b[0]);
    const merged = [spans[0]];
    for (const s of spans.slice(1)) {
      const last = merged[merged.length - 1];
      if (s[0] <= last[1]) last[1] = Math.max(last[1], s[1]);
      else merged.push(s);
    }
    let out = "", pos = 0;
    for (const [a, b] of merged) {
      out += esc(text.slice(pos, a)) + "<mark>" + esc(text.slice(a, b)) + "</mark>";
      pos = b;
    }
    return out + esc(text.slice(pos));
  }

  function paraCard(p, hlRegs) {
    const d = docOf(p);
    const paraLabel = p.unnumbered
      ? `<span class="unnumbered-flag">unnumbered ¶${p.seq + 1}</span>`
      : `¶ ${esc(p.n)}${p.annex ? ` <span class="unnumbered-flag">annex ${p.annex}</span>` : ""}${p.printed ? ` <span class="unnumbered-flag" title="The document misprints this paragraph's number; it is shown in its position in the sequence.">printed as ${esc(p.printed)}</span>` : ""}`;
    let text = p.text;
    let clipped = false;
    if (text.length > 900) {
      const f = fold(text);
      let first = 0;
      for (const re of hlRegs) { re.lastIndex = 0; const m = re.exec(f); if (m) { first = m.index; break; } }
      const start = Math.max(0, Math.min(first - 200, text.length - 900));
      text = (start > 0 ? "… " : "") + text.slice(start, start + 850) + " …";
      clipped = true;
    }
    return `<article class="para-card" data-pid="${esc(p.id)}" data-rec="${esc(p.rec_id)}">
      <div class="pc-head">
        <span class="sym">${esc(d.symbol || d.doc_id || "")}</span>
        <span>${paraLabel}</span>
        <span>·</span><span>${esc((d.bodies || [])[0] || "")}</span>
        <span>·</span><span>${esc(d.title || "")}</span>
        <span>·</span><span>${esc(d.date ? A().fmtDate(d.date) : (d.year || ""))}</span>
      </div>
      <div class="pc-text">${highlight(text, hlRegs)}</div>
      ${clipped ? `<div style="margin:-2px 0 6px"><button class="chip pc-expand">Show the full paragraph</button></div>` : ""}
      <div class="pc-actions">
        <button class="pc-copy">Copy paragraph</button>
        <button class="pc-cite">Copy citation</button>
        <button class="pc-open">Open in document</button>
        <button data-ws-key="p:${esc(p.id)}" data-ws-off="Save to workspace" data-ws-on="Saved ✓" aria-pressed="${wsOn("p:" + p.id)}">${wsOn("p:" + p.id) ? "Saved ✓" : "Save to workspace"}</button>
        ${d.symbol ? `<a href="${esc(A().unLink(d.symbol))}" target="_blank" rel="noopener">UN source ↗</a>` : ""}
      </div>
    </article>`;
  }
  function bindParaCards(root) {
    root.addEventListener("click", (e) => {
      const card = e.target.closest(".para-card");
      if (!card) return;
      const p = state.paras.find(x => x.id === card.dataset.pid);
      if (!p) return;
      if (e.target.classList.contains("pc-copy")) {
        navigator.clipboard.writeText(p.text + "\n\n— " + citeOf(p));
        e.target.textContent = "Copied ✓";
      } else if (e.target.classList.contains("pc-cite")) {
        navigator.clipboard.writeText(citeOf(p));
        e.target.textContent = "Copied ✓";
      } else if (e.target.classList.contains("pc-open")) {
        openDoc(p.rec_id, p.id);
      } else if (e.target.classList.contains("pc-expand")) {
        const div = card.querySelector(".pc-text");
        div.innerHTML = highlight(p.text, parseQuery(state.lastQuery).groups.flat().map(altRegex));
        e.target.remove();
      }
    });
  }

  /* ---------- Browse view ---------- */
  function renderBrowse() {
    const body = $("#reports-body");
    const allDocs = (window.HRC_DATA.documents || []).filter(d => d.type !== "Press Release");
    const withText = new Set([...state.docs.keys()]);
    // group by first body; a focus from the Mechanisms tab narrows to one group
    const byBody = new Map();
    allDocs.forEach(d => {
      const b = (d.bodies || [])[0] || "(unattributed)";
      if (browseFocus && !(d.bodies || []).includes(browseFocus)) return;
      if (!byBody.has(b)) byBody.set(b, []);
      byBody.get(b).push(d);
    });
    // same order as the Mechanisms tab: still-active mandates first, then most recent start
    const bodyMeta = new Map((window.HRC_DATA.bodies || []).map(b => [b.short_name, b]));
    const latestOf = (b) => byBody.get(b).reduce((a, d) => (d.date || "") > a ? d.date : a, "");
    const bodies = [...byBody.keys()].sort((a, b) => {
      const A = bodyMeta.get(a), B = bodyMeta.get(b);
      if (!A || !B) return A ? -1 : (B ? 1 : latestOf(b).localeCompare(latestOf(a)));
      return ((A.end_date ? 1 : 0) - (B.end_date ? 1 : 0)) ||
        (B.start_date || "").localeCompare(A.start_date || "");
    });
    // heading: full name with the mandate years in brackets
    const mechLabel = (short) => {
      const b = bodyMeta.get(short);
      if (!b) return short;
      const y0 = (b.start_date || "").slice(0, 4), y1 = (b.end_date || "").slice(0, 4);
      const yrs = y0 ? (y1 ? (y0 === y1 ? y0 : `${y0}–${y1}`) : `${y0}–ongoing`) : "";
      return `${b.full_name || short}${yrs ? ` (${yrs})` : ""}`;
    };
    const allBodies = [...new Set(allDocs.flatMap(d => d.bodies || []))].sort();
    const shardDocCount = M.documents;
    body.innerHTML = `
      <div class="panel">
        <div class="panel-head"><h2>${browseFocus ? esc(mechLabel(browseFocus)) + " — reports" : "Reports corpus"}</h2>
          ${browseFocus
            ? `<span class="count">showing one mechanism</span>`
            : `<span class="count">${shardDocCount} of ${allDocs.length} documents have searchable text (${corpusStats()})</span>`}
          <span class="spacer"></span>
          <div class="f-item"><label for="browse-mech">Mechanism</label>
            <select id="browse-mech">${browseFocus ? "" : `<option value="">All mechanisms</option>`}
              ${browseFocus ? `<option value="">All mechanisms</option>` : ""}
              ${allBodies.map(b => `<option value="${esc(b)}"${b === browseFocus ? " selected" : ""}>${esc(b)}</option>`).join("")}
            </select></div></div>
        <div class="panel-note">Documents without searchable text are mostly image-only annexes and files awaiting OCR;
        they are listed with their records but cannot be searched yet.</div>
        <div class="panel-body">
          ${bodies.map(b => {
            const docs = byBody.get(b).slice().sort((x, y) => (y.date || "").localeCompare(x.date || ""));
            return `<details ${bodies.length < 4 || browseFocus ? "open" : ""}>
              <summary style="cursor:pointer;font-weight:600;padding:5px 0">${esc(mechLabel(b))}
                <span style="color:var(--muted);font-weight:400">· ${docs.length} document${docs.length > 1 ? "s" : ""}</span></summary>
              <div class="tblwrap"><table class="data"><thead><tr>
                <th class="no-sort">Symbol</th><th class="no-sort">Title</th><th class="no-sort">Type</th>
                <th class="no-sort">Date</th><th class="no-sort num" title="Number of searchable paragraphs extracted from this document">Paragraphs</th>
              </tr></thead><tbody>
              ${docs.map(d => {
                const rec = [...state.docs.values()].find(x => x.rec_id === d.rec_id);
                return `<tr data-rec="${esc(d.rec_id)}" ${rec ? 'class="has-text"' : ""}>
                  <td style="white-space:nowrap" class="sym">${esc(d.un_ref || "")}</td>
                  <td>${rec ? `<a class="doclink" data-rec="${esc(d.rec_id)}">${esc(d.title || d.doc_id)}</a>` : esc(d.title || d.doc_id)}
                    ${rec && rec.unnumbered ? ` <span class="unnumbered-flag">(no printed paragraph numbers)</span>` : ""}
                    ${!rec ? ` <span class="unnumbered-flag">(no searchable text)</span>` : ""}</td>
                  <td style="white-space:nowrap">${esc(d.type || "")}</td>
                  <td style="white-space:nowrap">${esc(d.date ? A().fmtDate(d.date) : d.year || "")}</td>
                  <td class="num">${rec ? rec.paragraphCount : ""}</td>
                </tr>`;
              }).join("")}
              </tbody></table></div></details>`;
          }).join("")}
        </div>
      </div>`;
    const mechSel = $("#browse-mech");
    if (mechSel) mechSel.addEventListener("change", (e) => { browseFocus = e.target.value; render(); });
    body.addEventListener("click", (e) => {
      const a = e.target.closest("a.doclink");
      if (a) openDoc(a.dataset.rec);
    });
    // ensure shard doc metadata is present so links exist: load all lazily in background
    if (!allLoaded()) loadAllShards().then(() => { if (sub === "browse") renderBrowse(); });
  }

  /* ---------- document reader ---------- */
  function openDoc(recId, paraId) {
    const shard = state.docShard.get(recId);
    const show = () => {
      const d = state.docs.get(recId);
      if (!d) return;
      const paras = state.paras.filter(p => p.rec_id === recId).sort((a, b) => a.seq - b.seq);
      const body = $("#reports-body");
      body.innerHTML = `
        <div class="panel doc-reader">
          <div class="panel-head" style="padding-bottom:10px">
            <div><h2 style="margin:0">${esc(d.title || d.doc_id)}</h2>
              <div style="font-size:12.5px;color:var(--ink-2);margin-top:3px">
                ${esc((d.bodies || []).join(", "))} · ${esc(d.type || "")} ·
                ${esc(d.date ? A().fmtDate(d.date) : d.year || "")}
                ${d.symbol ? ` · <span class="sym">${esc(d.symbol)}</span>` : ""}
                ${d.unnumbered ? ` · <span class="unnumbered-flag">no printed paragraph numbers — positions shown are sequential</span>` : ""}
              </div></div>
            <span class="spacer"></span>
            <button class="icon-btn" id="doc-back">← Back</button>
            ${d.symbol ? `<a class="icon-btn" href="${esc(A().unLink(d.symbol))}" target="_blank" rel="noopener">UN source ↗</a>` : ""}
          </div>
          ${(d.gaps || []).length ? `<div class="panel-note">Note: paragraph number${d.gaps.length > 1 ? "s" : ""}
            ${esc(d.gaps.join(", "))} ${d.gaps.length > 1 ? "do" : "does"} not appear in the source text — the document's own numbering skips ${d.gaps.length > 1 ? "them" : "it"}, or the paragraph sits inside a table or image. Nothing was invented to fill the hole.</div>` : ""}
          ${(d.misprints || []).length ? `<div class="panel-note">Note: ${d.misprints.map(m => `paragraph ${esc(m.n)} is misprinted as “${esc(m.printed)}” in the document`).join("; ")} — shown here in its position in the sequence.</div>` : ""}
          <div class="panel-body" id="doc-paras">
            ${paras.map(p => `<div class="para" id="p-${esc(p.id)}" data-pid="${esc(p.id)}">
              <div class="pn" title="${p.unnumbered ? "sequential position (no printed number)" : p.printed ? `misprinted as ${esc(p.printed)} in the document` : "printed paragraph number"}">${p.unnumbered ? "·" + (p.seq + 1) : esc(p.n)}${p.annex ? `<div style="font-size:9px">ax${p.annex}</div>` : ""}${p.printed ? `<div style="font-size:9px">(${esc(p.printed)})</div>` : ""}</div>
              <div class="pt">${esc(p.text)}</div>
              <div style="flex:0 0 auto;display:flex;gap:4px;align-items:flex-start"><button class="chip pc-cite" data-pid="${esc(p.id)}" title="Copy citation">cite</button><button class="chip" data-ws-key="p:${esc(p.id)}" data-ws-off="save" data-ws-on="saved ✓" aria-pressed="${wsOn("p:" + p.id)}">${wsOn("p:" + p.id) ? "saved ✓" : "save"}</button></div>
            </div>`).join("")}
          </div>
        </div>`;
      $("#doc-back").addEventListener("click", () => { render(); });
      $("#doc-paras").addEventListener("click", (e) => {
        const b = e.target.closest("button.pc-cite");
        if (!b) return;
        const p = paras.find(x => x.id === b.dataset.pid);
        navigator.clipboard.writeText(citeOf(p));
        b.textContent = "✓";
        setTimeout(() => { b.textContent = "cite"; }, 1200);
      });
      if (paraId) {
        const el = document.getElementById("p-" + paraId);
        if (el) { el.scrollIntoView({ block: "center" }); el.classList.add("flash"); }
      }
      history.replaceState(null, "", "#/reports/doc/" + encodeURIComponent(recId) + (paraId ? "/" + encodeURIComponent(paraId) : ""));
    };
    if (shard && !state.shards.get(shard + ".json") && !allLoaded()) {
      loadShard(shard + ".json").then(show);
    } else if (!state.docs.has(recId)) {
      loadAllShards().then(show);
    } else show();
  }

  /* ---------- deep links ---------- */
  function handleHash() {
    const m = /^#\/reports\/doc\/([^/]+)(?:\/(.+))?$/.exec(location.hash);
    if (m) {
      activate();
      openDoc(decodeURIComponent(m[1]), m[2] ? decodeURIComponent(m[2]) : null);
    }
  }
  window.addEventListener("load", handleHash);

  /* ---------- workspace items ("p:<paragraph id>") ---------- */
  function wsItem(id) {
    const p = state.paras.find(x => x.id === id);
    if (!p) return null;
    const d = docOf(p);
    const label = p.unnumbered
      ? `unnumbered ¶${p.seq + 1}${p.annex ? ` (annex ${p.annex})` : ""}`
      : `¶ ${p.n}${p.annex ? ` (annex ${p.annex})` : ""}${p.printed ? ` (printed as ${p.printed})` : ""}`;
    return { id: p.id, rec_id: p.rec_id, symbol: d.symbol || "", doc_id: d.doc_id || "", title: d.title || "",
      body: (d.bodies || [])[0] || "", date: d.date ? A().fmtDate(d.date) : String(d.year || ""),
      label, text: p.text, cite: citeOf(p), unlink: d.symbol ? A().unLink(d.symbol) : "" };
  }

  window.HRCReports = { activate, showMechanism, openDoc, wsItem, loadAll: () => loadAllShards() };
})();
