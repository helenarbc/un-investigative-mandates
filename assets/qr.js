/* QR code to this dashboard, for projecting at a talk.
   The matrix is pre-computed for the published URL (version 4, error correction M)
   so the page needs no QR library and no build step. Regenerate if the URL changes. */
(function () {
  "use strict";
  var URL_ = "https://helenarbc.github.io/un-investigative-mandates/";
  var N = 33;
  var D = "M0 0h7v1h-7zM16 0h1v1h-1zM18 0h3v1h-3zM23 0h1v1h-1zM26 0h7v1h-7zM0 1h1v1h-1zM6 1h1v1h-1zM15 1h4v1h-4zM21 1h2v1h-2zM24 1h1v1h-1zM26 1h1v1h-1zM32 1h1v1h-1zM0 2h1v1h-1zM2 2h3v1h-3zM6 2h1v1h-1zM8 2h1v1h-1zM11 2h1v1h-1zM14 2h3v1h-3zM20 2h4v1h-4zM26 2h1v1h-1zM28 2h3v1h-3zM32 2h1v1h-1zM0 3h1v1h-1zM2 3h3v1h-3zM6 3h1v1h-1zM8 3h3v1h-3zM15 3h1v1h-1zM17 3h2v1h-2zM20 3h1v1h-1zM22 3h3v1h-3zM26 3h1v1h-1zM28 3h3v1h-3zM32 3h1v1h-1zM0 4h1v1h-1zM2 4h3v1h-3zM6 4h1v1h-1zM8 4h1v1h-1zM10 4h1v1h-1zM13 4h9v1h-9zM23 4h2v1h-2zM26 4h1v1h-1zM28 4h3v1h-3zM32 4h1v1h-1zM0 5h1v1h-1zM6 5h1v1h-1zM8 5h4v1h-4zM13 5h2v1h-2zM18 5h1v1h-1zM20 5h2v1h-2zM26 5h1v1h-1zM32 5h1v1h-1zM0 6h7v1h-7zM8 6h1v1h-1zM10 6h1v1h-1zM12 6h1v1h-1zM14 6h1v1h-1zM16 6h1v1h-1zM18 6h1v1h-1zM20 6h1v1h-1zM22 6h1v1h-1zM24 6h1v1h-1zM26 6h7v1h-7zM8 7h1v1h-1zM11 7h1v1h-1zM16 7h1v1h-1zM18 7h1v1h-1zM20 7h3v1h-3zM0 8h1v1h-1zM2 8h5v1h-5zM9 8h3v1h-3zM13 8h1v1h-1zM16 8h2v1h-2zM20 8h1v1h-1zM22 8h1v1h-1zM24 8h1v1h-1zM26 8h5v1h-5zM1 9h5v1h-5zM7 9h2v1h-2zM11 9h3v1h-3zM16 9h2v1h-2zM19 9h2v1h-2zM22 9h2v1h-2zM26 9h2v1h-2zM29 9h4v1h-4zM0 10h2v1h-2zM3 10h1v1h-1zM5 10h3v1h-3zM10 10h8v1h-8zM20 10h3v1h-3zM25 10h1v1h-1zM28 10h1v1h-1zM30 10h2v1h-2zM0 11h1v1h-1zM4 11h1v1h-1zM8 11h1v1h-1zM10 11h1v1h-1zM12 11h2v1h-2zM16 11h1v1h-1zM21 11h2v1h-2zM25 11h2v1h-2zM28 11h3v1h-3zM32 11h1v1h-1zM0 12h4v1h-4zM5 12h3v1h-3zM10 12h1v1h-1zM12 12h1v1h-1zM14 12h1v1h-1zM16 12h1v1h-1zM18 12h2v1h-2zM22 12h1v1h-1zM24 12h2v1h-2zM27 12h3v1h-3zM31 12h2v1h-2zM1 13h1v1h-1zM3 13h1v1h-1zM5 13h1v1h-1zM8 13h2v1h-2zM12 13h1v1h-1zM15 13h1v1h-1zM18 13h4v1h-4zM23 13h1v1h-1zM26 13h1v1h-1zM29 13h4v1h-4zM1 14h1v1h-1zM4 14h3v1h-3zM9 14h2v1h-2zM13 14h4v1h-4zM24 14h3v1h-3zM31 14h1v1h-1zM0 15h1v1h-1zM2 15h1v1h-1zM7 15h1v1h-1zM9 15h1v1h-1zM13 15h3v1h-3zM20 15h2v1h-2zM23 15h1v1h-1zM25 15h6v1h-6zM0 16h1v1h-1zM2 16h1v1h-1zM4 16h1v1h-1zM6 16h1v1h-1zM8 16h2v1h-2zM11 16h1v1h-1zM13 16h3v1h-3zM17 16h1v1h-1zM22 16h1v1h-1zM24 16h2v1h-2zM27 16h2v1h-2zM32 16h1v1h-1zM0 17h1v1h-1zM7 17h3v1h-3zM11 17h2v1h-2zM14 17h1v1h-1zM18 17h4v1h-4zM23 17h1v1h-1zM26 17h2v1h-2zM29 17h2v1h-2zM32 17h1v1h-1zM0 18h1v1h-1zM2 18h2v1h-2zM5 18h2v1h-2zM9 18h1v1h-1zM11 18h1v1h-1zM13 18h1v1h-1zM15 18h2v1h-2zM18 18h1v1h-1zM20 18h2v1h-2zM24 18h1v1h-1zM27 18h2v1h-2zM30 18h2v1h-2zM0 19h2v1h-2zM3 19h1v1h-1zM5 19h1v1h-1zM7 19h3v1h-3zM11 19h2v1h-2zM14 19h1v1h-1zM16 19h1v1h-1zM18 19h5v1h-5zM25 19h1v1h-1zM27 19h5v1h-5zM0 20h1v1h-1zM3 20h2v1h-2zM6 20h4v1h-4zM11 20h2v1h-2zM14 20h1v1h-1zM18 20h1v1h-1zM20 20h1v1h-1zM22 20h2v1h-2zM25 20h1v1h-1zM27 20h3v1h-3zM32 20h1v1h-1zM0 21h2v1h-2zM3 21h1v1h-1zM5 21h1v1h-1zM9 21h3v1h-3zM13 21h4v1h-4zM18 21h4v1h-4zM23 21h1v1h-1zM25 21h2v1h-2zM29 21h2v1h-2zM32 21h1v1h-1zM0 22h1v1h-1zM3 22h1v1h-1zM5 22h7v1h-7zM14 22h1v1h-1zM17 22h2v1h-2zM20 22h1v1h-1zM26 22h2v1h-2zM29 22h3v1h-3zM0 23h1v1h-1zM2 23h4v1h-4zM7 23h3v1h-3zM11 23h1v1h-1zM14 23h1v1h-1zM16 23h1v1h-1zM18 23h1v1h-1zM21 23h1v1h-1zM24 23h1v1h-1zM29 23h2v1h-2zM32 23h1v1h-1zM0 24h1v1h-1zM2 24h1v1h-1zM4 24h1v1h-1zM6 24h4v1h-4zM17 24h2v1h-2zM22 24h8v1h-8zM31 24h1v1h-1zM8 25h1v1h-1zM10 25h1v1h-1zM12 25h1v1h-1zM14 25h1v1h-1zM16 25h5v1h-5zM24 25h1v1h-1zM28 25h1v1h-1zM30 25h1v1h-1zM32 25h1v1h-1zM0 26h7v1h-7zM9 26h1v1h-1zM11 26h1v1h-1zM14 26h4v1h-4zM22 26h3v1h-3zM26 26h1v1h-1zM28 26h1v1h-1zM30 26h2v1h-2zM0 27h1v1h-1zM6 27h1v1h-1zM8 27h1v1h-1zM11 27h2v1h-2zM14 27h2v1h-2zM17 27h5v1h-5zM23 27h2v1h-2zM28 27h4v1h-4zM0 28h1v1h-1zM2 28h3v1h-3zM6 28h1v1h-1zM8 28h1v1h-1zM11 28h1v1h-1zM13 28h1v1h-1zM16 28h1v1h-1zM19 28h1v1h-1zM22 28h1v1h-1zM24 28h6v1h-6zM31 28h2v1h-2zM0 29h1v1h-1zM2 29h3v1h-3zM6 29h1v1h-1zM8 29h1v1h-1zM10 29h1v1h-1zM14 29h2v1h-2zM17 29h5v1h-5zM23 29h3v1h-3zM28 29h1v1h-1zM30 29h3v1h-3zM0 30h1v1h-1zM2 30h3v1h-3zM6 30h1v1h-1zM8 30h4v1h-4zM13 30h1v1h-1zM15 30h3v1h-3zM23 30h2v1h-2zM26 30h2v1h-2zM29 30h1v1h-1zM0 31h1v1h-1zM6 31h1v1h-1zM9 31h4v1h-4zM14 31h2v1h-2zM18 31h1v1h-1zM20 31h3v1h-3zM25 31h1v1h-1zM28 31h3v1h-3zM0 32h7v1h-7zM8 32h5v1h-5zM14 32h2v1h-2zM17 32h1v1h-1zM23 32h2v1h-2zM27 32h1v1h-1zM29 32h1v1h-1zM31 32h1v1h-1z";

  function svgEl(name, attrs) {
    var e = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }

  function qrSvg(px) {
    var quiet = 4, span = N + quiet * 2;
    var svg = svgEl("svg", {
      viewBox: (-quiet) + " " + (-quiet) + " " + span + " " + span,
      width: px, height: px, "shape-rendering": "crispEdges",
      role: "img", "aria-label": "QR code linking to " + URL_
    });
    svg.appendChild(svgEl("rect", { x: -quiet, y: -quiet, width: span, height: span, fill: "#ffffff" }));
    svg.appendChild(svgEl("path", { d: D, fill: "#000000" }));
    return svg;
  }

  var overlay = null;
  function close() {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
    document.removeEventListener("keydown", onKey);
  }
  function onKey(e) { if (e.key === "Escape") close(); }

  function open() {
    if (overlay) { close(); return; }
    overlay = document.createElement("div");
    overlay.className = "qr-backdrop";
    var card = document.createElement("div");
    card.className = "qr-card";
    // Sized to stay readable from the back of a room but fit a projected 16:9 slide.
    var px = Math.round(Math.min(window.innerWidth, window.innerHeight) * 0.52);
    card.appendChild(qrSvg(Math.max(240, Math.min(460, px))));
    var a = document.createElement("a");
    a.href = URL_; a.textContent = URL_; a.className = "qr-url";
    a.target = "_blank"; a.rel = "noopener";
    card.appendChild(a);
    var hint = document.createElement("p");
    hint.className = "qr-hint";
    hint.textContent = "Scan to open the dashboard. Press Esc or click anywhere to close.";
    card.appendChild(hint);
    overlay.appendChild(card);
    overlay.addEventListener("click", close);
    document.addEventListener("keydown", onKey);
    document.body.appendChild(overlay);
  }

  // The Presentation tab closes on a QR slide, so it needs the same matrix.
  window.HRCQr = { svg: qrSvg, url: URL_ };

  function wire() {
    var btn = document.getElementById("qr-btn");
    if (btn) btn.addEventListener("click", function (e) { e.stopPropagation(); open(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire, { once: true });
  else wire();
})();
