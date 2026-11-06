/*! © 2026 Helena Rodríguez-Bronchú Carceller. All rights reserved.
 *  UN Investigative Mandates — https://mandates.helenarbc.com/
 *  Original work. Text and data mining rights expressly reserved:
 *  art. 4(3) Directive (EU) 2019/790; art. L.122-5-3 French Intellectual Property Code;
 *  art. 67 Spanish Consolidated Copyright Act (TRLPI). No licence is granted for the
 *  training of artificial-intelligence models. See LICENSE and /tdm-policy.json.
 */
/* Presentation tab.

   The same cards as the Overview tab, one to a slide, sized for a projector.
   Charts are drawn by the SAME draw functions the Overview uses, into a host
   in the slide, so every chart keeps its hover tooltips. That is the whole
   point of this tab: a slide deck of images loses the one thing that makes
   these charts worth showing live.

   Navigation: arrow keys, space, Page Up/Down, Home/End, or the controls.
   F (or the button) asks the browser for full screen on the stage.

   Original code for this project (2026). */

(function () {
  "use strict";
  const $ = (sel, root) => (root || document).querySelector(sel);

  // Every chart carries its own notice: slides get screenshotted, reproduced and
  // exported to PDF one by one, and a credit in the footer of the site does not
  // travel with them.
  const CREDIT =
    '<p class="pr-credit">\u00a9 2026 Helena Rodr\u00edguez-Bronch\u00fa Carceller \u00b7 mandates.helenarbc.com</p>';

  let built = false, idx = 0, slides = [], stage = null, deck = null;

  // The talk is a curated deck, not every chart on the Overview: a selection of
  // the same card objects, with some shown two to a slide. Fall back to the full
  // set if an older summary.js is cached.
  function cards() {
    const S = window.HRCSummary;
    if (!S) return [];
    const d = S.deck ? S.deck() : null;
    return (d && d.length) ? d : (S.cards ? S.cards() : []);
  }

  function slideFor(c, n, total) {
    const el = document.createElement("section");
    el.className = "pr-slide" + (c.prose ? " pr-prose" : (c.pair ? " pr-chart pr-pair" : " pr-chart"));
    el.setAttribute("aria-hidden", "true");
    if (c.prose) {
      el.innerHTML = `<div class="pr-inner">${c.html()}</div>`;
    } else if (c.pair) {
      // Two charts on one slide. Each keeps its own legend, because the colours
      // mean different things on either side.
      const cell = (p) => {
        // A self-contained chart draws its own title inside the SVG, so repeating
        // it above the cell would print it twice.
        const lg = (!p.selfContained && p.legend) ? p.legend() : "";
        const sub = p.selfContained ? "" : `<h3 class="pr-sub">${(p.head || p.title())}</h3>`;
        return `<div class="pr-cell">
            ${sub}
            ${lg ? `<div class="legend pr-legend">${lg}</div>` : ""}
            <div class="pr-chart-host"></div>
            ${CREDIT}
          </div>`;
      };
      el.innerHTML =
        `<div class="pr-inner">
           ${c.eyebrow ? `<p class="pr-eyebrow">${c.eyebrow}</p>` : ""}
           <h2 class="pr-title">${c.head}</h2>
           <div class="pr-pair-grid"${c.cols ? ` style="grid-template-columns:${c.cols}"` : ""}>${c.parts.map(cell).join("")}</div>
           <p class="pr-note">${c.note || ""}</p>
         </div>`;
    } else {
      // The legend is a sibling of the chart on the Overview, not part of the SVG.
      // A slide without it is a slide of unexplained colours - the exact fault
      // that made the exported PNGs useless.
      const legend = (!c.selfContained && c.legend) ? c.legend() : "";
      el.innerHTML =
        `<div class="pr-inner">
           ${c.section ? `<p class="pr-eyebrow">${c.section}</p>` : ""}
           <h2 class="pr-title">${(c.head || c.title())}</h2>
           ${legend ? `<div class="legend pr-legend">${legend}</div>` : ""}
           <div class="pr-chart-host"></div>
           <p class="pr-note"></p>
           ${CREDIT}
         </div>`;
      const note = $(".pr-note", el);
      if (note && c.note && !c.selfContained) note.textContent = c.note();
    }
    const num = document.createElement("p");
    num.className = "pr-num";
    num.textContent = n + " / " + total;
    el.appendChild(num);
    el._card = c;
    el._drawn = false;
    return el;
  }

  // Draw on demand: drawing fifteen charts up front is slow and most are not
  // on screen. Re-draw when the slide is shown again so it fits the stage.
  function drawSlide(el) {
    const c = el._card;
    if (!c || c.prose) return;
    if (c.pair) {
      const hosts = el.querySelectorAll(".pr-chart-host");
      c.parts.forEach((p, i) => {
        const h = hosts[i];
        if (!h) return;
        h.innerHTML = "";
        try { p.draw(h, p.modes ? p.modes[0][0] : null); }
        catch (err) {
          h.innerHTML = '<p class="pr-fail">This chart could not be drawn here.</p>';
          console.warn("present: draw failed for card", p.id, err);
        }
      });
      el._drawn = true;
      return;
    }
    const host = $(".pr-chart-host", el);
    if (!host) return;
    host.innerHTML = "";
    try {
      c.draw(host, c.modes ? c.modes[0][0] : null);
      el._drawn = true;
    } catch (err) {
      host.innerHTML = '<p class="pr-fail">This chart could not be drawn here. It is on the Overview tab.</p>';
      console.warn("present: draw failed for card", c.id, err);
    }
  }

  function show(i) {
    if (!slides.length) return;
    idx = Math.max(0, Math.min(slides.length - 1, i));
    slides.forEach((el, k) => {
      const on = k === idx;
      el.classList.toggle("is-on", on);
      el.setAttribute("aria-hidden", String(!on));
    });
    drawSlide(slides[idx]);
    const pos = $(".pr-pos", deck);
    if (pos) pos.textContent = (idx + 1) + " / " + slides.length;
    const prev = $(".pr-prev", deck), next = $(".pr-next", deck);
    if (prev) prev.disabled = idx === 0;
    if (next) next.disabled = idx === slides.length - 1;
  }

  function onKey(e) {
    if (!deck || !deck.isConnected) return;
    const view = document.getElementById("view-present");
    if (!view || !view.classList.contains("active")) return;
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    switch (e.key) {
      case "ArrowRight": case "PageDown": case " ": case "Spacebar":
        e.preventDefault(); show(idx + 1); break;
      case "ArrowLeft": case "PageUp":
        e.preventDefault(); show(idx - 1); break;
      case "Home": e.preventDefault(); show(0); break;
      case "End": e.preventDefault(); show(slides.length - 1); break;
      case "f": case "F": e.preventDefault(); toggleFull(); break;
      default: break;
    }
  }

  function toggleFull() {
    const el = stage;
    if (!el) return;
    if (document.fullscreenElement) {
      if (document.exitFullscreen) document.exitFullscreen();
    } else if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    }
  }

  function build() {
    const host = document.getElementById("present-content");
    if (!host) return;
    const list = cards();
    if (!list.length) {
      host.innerHTML = '<div class="panel"><div class="panel-body">' +
        '<p>The charts have not been built yet. Open the Overview tab once, then come back.</p></div></div>';
      return;
    }
    host.innerHTML =
      `<div class="pr-deck">
         <div class="pr-stage" tabindex="0" aria-label="Presentation"></div>
         <div class="pr-bar">
           <button class="btn pr-prev" type="button" aria-label="Previous slide">&larr;</button>
           <span class="pr-pos">1 / ${list.length}</span>
           <button class="btn pr-next" type="button" aria-label="Next slide">&rarr;</button>
           <span class="spacer"></span>
           <span class="pr-hint">Arrow keys or space to move &middot; F for full screen</span>
           <button class="btn pr-full" type="button">Full screen</button>
         </div>
       </div>`;
    deck = $(".pr-deck", host);
    stage = $(".pr-stage", deck);
    slides = list.map((c, i) => slideFor(c, i + 1, list.length));
    slides.forEach(el => stage.appendChild(el));
    $(".pr-prev", deck).addEventListener("click", () => show(idx - 1));
    $(".pr-next", deck).addEventListener("click", () => show(idx + 1));
    $(".pr-full", deck).addEventListener("click", toggleFull);
    stage.addEventListener("click", (e) => {
      // a click on the slide advances, but not on a link or a chart mark
      if (e.target.closest("a, button, [data-tip], .pr-bar")) return;
      show(idx + 1);
    });
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", () => {
      clearTimeout(build._t);
      build._t = setTimeout(() => { if (slides[idx]) drawSlide(slides[idx]); }, 180);
    });
    document.addEventListener("fullscreenchange", () => {
      if (slides[idx]) setTimeout(() => drawSlide(slides[idx]), 60);
    });
    built = true;
    show(0);
  }

  function activate() {
    // The cards are defined by summary.js at load, but their data is only
    // built when the Overview tab first renders; drawing works either way.
    if (!built) build(); else { show(idx); }
    if (stage) stage.focus({ preventScroll: true });
  }

  window.HRCPresent = { activate, show: (i) => show(i) };
})();
