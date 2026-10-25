/* ═══════════════════════════════════════════════════════════
   RHOBEAR Designs — Redesign Hooks Bridge (Layer 1)
   Adds redesign SVG marks, constellation loader animation,
   and class mixins to the existing `.rb-*` DOM.

   Additive only — never replaces existing DOM or handlers.
   Loaded LAST via import in main.js.
   ═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ─── SVG: constellation bear mark ───────────────────────────
  // The redesign's faceted-constellation bear SVG, injected into
  // the start screen hero area alongside the existing mark.

  const CONSTELLATION_SVG = `<svg viewBox="0 0 160 160" fill="none">
    <circle cx="80" cy="28" r="2.5" fill="#e05252"/>
    <circle cx="56" cy="44" r="2.5" fill="#e05252"/>
    <circle cx="104" cy="44" r="2.5" fill="#e05252"/>
    <circle cx="42" cy="68" r="2" fill="#e05252"/>
    <circle cx="118" cy="68" r="2" fill="#e05252"/>
    <circle cx="50" cy="88" r="2" fill="#e05252"/>
    <circle cx="110" cy="88" r="2" fill="#e05252"/>
    <circle cx="58" cy="106" r="1.8" fill="#e05252"/>
    <circle cx="102" cy="106" r="1.8" fill="#e05252"/>
    <circle cx="64" cy="122" r="1.5" fill="#e05252"/>
    <circle cx="96" cy="122" r="1.5" fill="#e05252"/>
    <circle cx="80" cy="66" r="3" fill="#e05252" opacity="0.9"/>
    <line x1="80" y1="28" x2="56" y2="44" stroke="#e05252" stroke-width="0.6" opacity="0.3"/>
    <line x1="80" y1="28" x2="104" y2="44" stroke="#e05252" stroke-width="0.6" opacity="0.3"/>
    <line x1="56" y1="44" x2="42" y2="68" stroke="#e05252" stroke-width="0.6" opacity="0.3"/>
    <line x1="104" y1="44" x2="118" y2="68" stroke="#e05252" stroke-width="0.6" opacity="0.3"/>
    <line x1="42" y1="68" x2="50" y2="88" stroke="#e05252" stroke-width="0.6" opacity="0.3"/>
    <line x1="118" y1="68" x2="110" y2="88" stroke="#e05252" stroke-width="0.6" opacity="0.3"/>
    <line x1="50" y1="88" x2="58" y2="106" stroke="#e05252" stroke-width="0.6" opacity="0.3"/>
    <line x1="110" y1="88" x2="102" y2="106" stroke="#e05252" stroke-width="0.6" opacity="0.3"/>
    <line x1="58" y1="106" x2="64" y2="122" stroke="#e05252" stroke-width="0.6" opacity="0.3"/>
    <line x1="102" y1="106" x2="96" y2="122" stroke="#e05252" stroke-width="0.6" opacity="0.3"/>
    <line x1="56" y1="44" x2="80" y2="66" stroke="#e05252" stroke-width="0.6" opacity="0.3"/>
    <line x1="104" y1="44" x2="80" y2="66" stroke="#e05252" stroke-width="0.6" opacity="0.3"/>
    <line x1="42" y1="68" x2="80" y2="66" stroke="#e05252" stroke-width="0.6" opacity="0.3"/>
    <line x1="118" y1="68" x2="80" y2="66" stroke="#e05252" stroke-width="0.6" opacity="0.3"/>
  </svg>`;

  // ─── 1. Inject constellation bear mark into start screen ────
  function injectConstellationMark() {
    var mark = document.querySelector('.rb-empty__mark');
    if (!mark) return;

    // Wrap the existing <img> in the constellation container
    var wrapper = document.createElement('div');
    wrapper.className = 'rb-start__mark-constellation';
    wrapper.innerHTML = CONSTELLATION_SVG;

    // Move the existing mark inside the wrapper
    var existingImg = mark.querySelector('img');
    if (existingImg) {
      existingImg.style.display = 'none';
    }
    mark.appendChild(wrapper);

    // Also add the redesign glow-ring animation to the mark
    var glowRing = document.createElement('div');
    glowRing.className = 'rb-constellation-glow';
    glowRing.style.cssText =
      'position:absolute;inset:-8px;border-radius:50%;' +
      'border:2px solid #e05252;opacity:0.2;' +
      'animation:rb-constellation-pulse 2.5s cubic-bezier(0.16,1,0.3,1) infinite;' +
      'pointer-events:none;';
    mark.style.position = 'relative';
    mark.appendChild(glowRing);
  }

  // ─── 2. Add constellation pulse keyframes ───────────────────
  function addPulseKeyframes() {
    if (document.getElementById('rb-redesign-pulse-style')) return;
    var style = document.createElement('style');
    style.id = 'rb-redesign-pulse-style';
    style.textContent =
      '@keyframes rb-constellation-pulse {' +
      '  0%, 100% { opacity:0.15; transform:scale(1); }' +
      '  50% { opacity:0.35; transform:scale(1.05); }' +
      '}' +
      '@media (prefers-reduced-motion: reduce) {' +
      '  .rb-constellation-glow { animation:none !important; }' +
      '}';
    document.head.appendChild(style);
  }

  // ─── 3. Add .designs-* class mixins to existing elements ────
  // Maps redesign-destined elements to a set of added classes.
  // These let redesign-glass.css target the correct surfaces.
  function applyClassMixins() {
    // Toolbar bear mark area → add redesign logo class reference
    var logo = document.querySelector('.rb-logo');
    if (logo) {
      logo.classList.add('rb-redesign-logo');
    }

    // AI FAB → mark for teal accent treatment
    var aiFab = document.querySelector('.rb-ai-fab');
    if (aiFab) {
      aiFab.classList.add('rb-redesign-ai-fab');
    }

    // Status bar → mono font
    var status = document.querySelector('.rb-status');
    if (status) {
      status.classList.add('rb-redesign-status');
    }
  }

  // ─── 4. Teal AI bubble glow animation ────────────────────────
  // Adds a subtle teal glow-pulse to the AI FAB (matching the
  // redesign's teal AI bubble treatment).
  function addTealGlow() {
    if (document.getElementById('rb-teal-glow-style')) return;
    var style = document.createElement('style');
    style.id = 'rb-teal-glow-style';
    style.textContent =
      '@keyframes rb-teal-breathe {' +
      '  0%, 100% { box-shadow: 0 0 20px rgba(42, 143, 168, 0.2); }' +
      '  50% { box-shadow: 0 0 32px rgba(42, 143, 168, 0.35); }' +
      '}' +
      '.rb-redesign-ai-fab {' +
      '  animation: rb-teal-breathe 4s cubic-bezier(0.16,1,0.3,1) infinite;' +
      '}' +
      '@media (prefers-reduced-motion: reduce) {' +
      '  .rb-redesign-ai-fab { animation:none !important; }' +
      '}';
    document.head.appendChild(style);
  }

  // ─── 5. Font check — log if Google Fonts didn't load ────────
  function checkFonts() {
    // Deferred check to let fonts finish loading
    setTimeout(function () {
      var el = document.createElement('span');
      el.style.cssText =
        'font-family:"Lato";position:absolute;visibility:hidden;top:-999px;' +
        'font-size:72px;letter-spacing:0;';
      el.textContent = 'iiiiii';
      document.body.appendChild(el);
      var loaded = el.offsetWidth !== 0;
      document.body.removeChild(el);
      if (!loaded) {
        console.warn('[Redesign] Google Fonts did not load — using system fallback.');
      }
    }, 3000);
  }

  // ─── INIT ────────────────────────────────────────────────────
  function init() {
    addPulseKeyframes();
    addTealGlow();
    applyClassMixins();

    // Wait for DOM to be ready before injecting marks
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        injectConstellationMark();
        checkFonts();
      });
    } else {
      injectConstellationMark();
      checkFonts();
    }
  }

  // Run on the right timing — shell.js bootstraps on DOMContentLoaded
  // so we run slightly after (hooks are additive, no race condition).
  if (document.readyState === 'complete') {
    init();
  } else {
    document.addEventListener('readystatechange', function () {
      if (document.readyState === 'complete') init();
    });
  }

  // Expose for debugging / tests
  window.__RB_REDESIGN__ = {
    injectConstellationMark: injectConstellationMark,
    applyClassMixins: applyClassMixins,
    version: '1.0.0',
  };
})();
