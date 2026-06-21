// editor/src/library/patterns/analysis.mjs
//
// Re-runnable scanner for the `samples/minimax-m3-high/` template HTML.
//
// What it does:
//   1. Walks every *.html in samples/minimax-m3-high/
//   2. Reads each file as text and detects:
//        - scroll techniques (GSAP ScrollTrigger, IntersectionObserver,
//          position:sticky, data-scroll / locomotive-scroll, AOS, scroll-driven
//          CSS, parallax via transform-on-scroll, raw window scroll listeners)
//        - 3D / WebGL (three.js loaders, geometries, materials, spin patterns)
//        - in-page links (# anchors, smooth-scroll handlers)
//        - structure tags (<header> <nav> <footer> <main>)
//        - animation libs by script src / global
//   3. Writes editor/src/library/patterns/patterns.json
//
// Hard rules:
//   - Pure node (no `node:fs` style import; only `node:fs`/`node:path`).
//     Browser-safe re-read happens via fs.readFileSync at script runtime.
//   - No deps added.
//   - generatedAt is left null — the stamping happens at publish time.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, basename, relative, resolve } from "node:path";

// ---- paths ---------------------------------------------------------------

// script lives at editor/src/library/patterns/analysis.mjs
// repo root is four levels up.
const HERE      = resolve(new URL(".", import.meta.url).pathname);
const EDITOR    = resolve(HERE, "..", "..", "..");          // editor/
const REPO_ROOT = resolve(EDITOR, "..");                    // repo root
const SAMPLES   = resolve(REPO_ROOT, "samples", "minimax-m3-high");
const OUT_FILE  = resolve(HERE, "patterns.json");

// ---- small utilities -----------------------------------------------------

/**
 * Count distinct occurrences of any of the given substrings/regexes.
 * Returns the raw match count (not files count) plus the list of markers found.
 */
function countAll(haystack, patterns) {
  let n = 0;
  const found = [];
  for (const p of patterns) {
    if (p instanceof RegExp) {
      const m = haystack.match(new RegExp(p.source, p.flags.includes("g") ? p.flags : p.flags + "g"));
      if (m) { n += m.length; found.push(p.source); }
    } else {
      let idx = -1;
      while ((idx = haystack.indexOf(p, idx + 1)) !== -1) n++;
      if (n > 0) found.push(p);
    }
  }
  return { count: n, found: [...new Set(found)] };
}

/** Return an array of line-level matches for `regex` capped at `max` entries. */
function grepLines(text, regex, max = 6) {
  const lines = text.split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length && out.length < max; i++) {
    if (regex.test(lines[i])) out.push({ line: i + 1, text: lines[i].trim().slice(0, 220) });
  }
  return out;
}

/** True if any of the patterns (string|regex) is present. */
function any(text, patterns) {
  for (const p of patterns) {
    if (p instanceof RegExp) { if (p.test(text)) return true; }
    else if (text.includes(p)) return true;
  }
  return false;
}

// ---- per-template analysis -----------------------------------------------

function analyseTemplate(absPath) {
  const text = readFileSync(absPath, "utf8");
  const id = basename(absPath, ".html");
  const rel = relative(REPO_ROOT, absPath);

  // ---------------- 1. Scroll techniques ---------------------------------

  const scroll = { techniques: [], markers: {} };

  // GSAP ScrollTrigger
  if (/ScrollTrigger/.test(text)) {
    scroll.techniques.push("gsap-scrolltrigger");
    const stSrc = grepLines(text, /ScrollTrigger\.min\.js/, 1);
    const stReg = grepLines(text, /gsap\.registerPlugin\(\s*ScrollTrigger/, 1);
    const stCalls = grepLines(text, /ScrollTrigger\s*[:{]/, 4);
    scroll.markers.gsapScrollTrigger = { src: stSrc[0] || null, register: stReg[0] || null, calls: stCalls };
  }

  // IntersectionObserver
  if (/IntersectionObserver/.test(text)) {
    scroll.techniques.push("intersection-observer");
    const opts = grepLines(text, /IntersectionObserver\([^)]*\)/, 2);
    scroll.markers.intersectionObserver = {
      opts,
      thresholds: [...new Set(grepLines(text, /threshold:\s*[0-9.]+/, 8).map(x => x.text.match(/threshold:\s*[0-9.]+/)?.[0]))],
      rootMargins: [...new Set(grepLines(text, /rootMargin:\s*['"][^'"]+['"]/, 8).map(x => x.text.match(/rootMargin:\s*['"][^'"]+['"]/)?.[0]))],
    };
  }

  // data-scroll (locomotive)
  if (/data-scroll(?:-[a-z-]+)?=/.test(text)) {
    scroll.techniques.push("locomotive-data-scroll");
  }
  // locomotive-scroll script
  if (/locomotive-scroll|LocomotiveScroll/.test(text) && !/Lenis-style|Lenis-feel/i.test(text.slice(0, text.indexOf("</head>") > 0 ? text.indexOf("</head>") : 0))) {
    // only count if it's actually a script/import, not just a comment in <head>
    const tail = text.slice(text.indexOf("<body") >= 0 ? text.indexOf("<body") : 0);
    if (/locomotive-scroll|LocomotiveScroll/.test(tail)) {
      scroll.techniques.push("locomotive-script");
    }
  }

  // Lenis smooth scroll
  if (/lenis|Lenis/i.test(text)) {
    // check it's a real import/script, not a meta-comment
    const tail = text.slice(text.indexOf("<body") >= 0 ? text.indexOf("<body") : 0);
    if (/lenis|Lenis/i.test(tail)) scroll.techniques.push("lenis");
  }

  // CSS position:sticky
  if (/position:\s*sticky/i.test(text)) {
    scroll.techniques.push("css-sticky");
    scroll.markers.stickySelectors = grepLines(text, /position:\s*sticky/i, 6);
  }

  // AOS (Animate on Scroll)
  if (/aos\.js|data-aos=/i.test(text)) {
    scroll.techniques.push("aos");
  }

  // CSS scroll-driven animations (animation-timeline, scroll())
  if (/animation-timeline|scroll\(\s*[a-z-]+\s*\)/i.test(text)) {
    scroll.techniques.push("css-scroll-driven");
  }

  // Parallax via transform on scroll (string-based detection)
  //    "translateY(" + scroll / "transform:" near "scroll" / explicit data-speed
  const parallax = any(text, [
    /dataset\.speed|data-speed\s*=/,
    /scrollY.*translateY|translateY.*scrollY/,
    /parallax/i,
  ]);
  if (parallax) scroll.techniques.push("parallax");

  // Raw scroll listener bound to something visible
  if (/addEventListener\(\s*['"]scroll['"]/i.test(text)) {
    scroll.techniques.push("raw-scroll-listener");
    scroll.markers.scrollListener = grepLines(text, /addEventListener\(\s*['"]scroll['"]/i, 4);
  }

  // CSS scroll-behavior: smooth
  if (/scroll-behavior:\s*smooth/i.test(text)) {
    scroll.techniques.push("css-smooth-scroll");
  }

  // scrollIntoView / behavior:'smooth'
  const smoothJs = /scrollIntoView\s*\(\s*\{[^}]*behavior:\s*['"]smooth['"]/.test(text);
  if (smoothJs) scroll.techniques.push("js-smooth-scroll");

  // ---------------- 2. 3D / WebGL ----------------------------------------

  const threeD = {
    usesThree: false,
    loader: null,
    canvas: false,
    webglRenderer: false,
    geometries: [],
    materials: [],
    lights: [],
    spin: null,
    autoRotate: false,
    evidence: [],
  };

  const usesThreeAny = /three(?:\.module)?(?:\.min)?\.js|from\s+['"]three['"]|importmap.*three/i.test(text);
  if (usesThreeAny) threeD.usesThree = true;

  if (threeD.usesThree) {
    // loader detection — pick the first one
    const loaders = [
      { re: /unpkg\.com\/three@[0-9.]+\/build\/three\.module\.js/, label: "unpkg-three-module" },
      { re: /unpkg\.com\/three@[0-9.]+\/build\/three\.min\.js/,   label: "unpkg-three-min"   },
      { re: /cdnjs\.cloudflare\.com\/ajax\/libs\/three\.js\/[^\s"']+\/three\.min\.js/, label: "cdnjs-three" },
      { re: /cdn\.jsdelivr\.net\/npm\/three@[^\s"']+\/build\/three\.min\.js/,          label: "jsdelivr-three" },
      { re: /importmap/i,                                            label: "importmap" },
    ];
    threeD.loader = (loaders.find(l => l.re.test(text)) || { label: "unknown" }).label;
  }

  if (/<canvas\b/i.test(text)) threeD.canvas = true;
  if (/WebGLRenderer/i.test(text)) threeD.webglRenderer = true;

  // geometries / materials / lights
  for (const g of ["SphereGeometry","BoxGeometry","TorusGeometry","IcosahedronGeometry","PlaneGeometry","CylinderGeometry","TorusKnotGeometry","BufferGeometry"]) {
    if (text.includes(g)) threeD.geometries.push(g);
  }
  for (const m of ["MeshStandardMaterial","MeshPhysicalMaterial","MeshBasicMaterial","MeshPhongMaterial","MeshLambertMaterial","ShaderMaterial","PointsMaterial"]) {
    if (text.includes(m)) threeD.materials.push(m);
  }
  for (const l of ["AmbientLight","DirectionalLight","PointLight","HemisphereLight","SpotLight","RoomEnvironment","PMREMGenerator"]) {
    if (text.includes(l)) threeD.lights.push(l);
  }

  // spin / autoRotate evidence
  const spinMatches = grepLines(text, /rotation\.[xyz]\s*\+=/, 4);
  const autoRot     = grepLines(text, /autoRotate/i, 2);
  if (spinMatches.length) {
    threeD.spin = { kind: "rotation-increment", samples: spinMatches };
  }
  if (autoRot.length) {
    threeD.autoRotate = true;
    threeD.spin = threeD.spin || { kind: "autoRotate", samples: autoRot };
  }

  // quote a tiny "evidence" block — the THREE.WebGLRenderer call site
  if (threeD.webglRenderer) {
    threeD.evidence.push(...grepLines(text, /new\s+THREE\.WebGLRenderer/, 2));
  }

  // ---------------- 3. Links / anchors -----------------------------------

  const anchors = [...text.matchAll(/href="#([^"#]+)"/g)].map(m => m[1]);
  const anchorSet = new Set(anchors);
  const links = {
    anchors: anchors.length,
    uniqueAnchorIds: anchorSet.size,
    samples: anchors.slice(0, 10),
    smoothScroll: smoothJs || /scroll-behavior:\s*smooth/i.test(text),
    smoothScrollEvidence: smoothJs
      ? grepLines(text, /scrollIntoView/, 3)
      : (text.match(/scroll-behavior:\s*smooth[^\n]*/) || []).slice(0, 2),
  };

  // ---------------- 4. Structure tags ------------------------------------

  const structure = {
    header: /<header\b/i.test(text),
    nav:    /<nav\b/i.test(text),
    footer: /<footer\b/i.test(text),
    main:   /<main\b/i.test(text),
    sections: (text.match(/<section\b/gi) || []).length,
    articles: (text.match(/<article\b/gi) || []).length,
  };

  // ---------------- 5. Animation libs (by script src / global) -----------

  const libs = [];
  if (/gsap(?:\.min)?\.js/.test(text))             libs.push("gsap");
  if (/ScrollTrigger/.test(text))                  libs.push("gsap-scrolltrigger");
  if (text.includes("anime.js") || /\banime\(/.test(text)) libs.push("animejs");
  // 'framer-motion' — match the literal package name only, not the verb "reacts"
  if (/framer-motion|framer\/motion/i.test(text))   libs.push("framer-motion");
  if (/lenis|Lenis/i.test(text))                   libs.push("lenis");
  if (/aos\.js|data-aos=/i.test(text))             libs.push("aos");
  if (threeD.usesThree)                            libs.push("three");
  if (/tailwindcss\.com/.test(text))               libs.push("tailwind-cdn");
  if (/jquery/i.test(text))                        libs.push("jquery");

  return {
    id,
    file: rel.replaceAll("\\", "/"),
    sizeBytes: Buffer.byteLength(text, "utf8"),
    scroll,
    threeD,
    links,
    structure,
    libs,
  };
}

// ---- walk + aggregate ----------------------------------------------------

function main() {
  const files = readdirSync(SAMPLES)
    .filter(f => f.endsWith(".html"))
    .map(f => join(SAMPLES, f))
    .sort();

  const templates = files.map(analyseTemplate);

  // -------- summary counts ----------------------------------------------
  const byTechnique = {
    "gsap-scrolltrigger":         0,
    "intersection-observer":      0,
    "locomotive-data-scroll":     0,
    "locomotive-script":          0,
    "lenis":                      0,
    "css-sticky":                 0,
    "aos":                        0,
    "css-scroll-driven":          0,
    "parallax":                   0,
    "raw-scroll-listener":        0,
    "css-smooth-scroll":          0,
    "js-smooth-scroll":           0,
    "three-uses":                 0,
  };
  for (const t of templates) {
    for (const k of t.scroll.techniques) byTechnique[k] = (byTechnique[k] || 0) + 1;
    if (t.threeD.usesThree) byTechnique["three-uses"]++;
  }

  const byLib = {};
  for (const t of templates) for (const l of t.libs) byLib[l] = (byLib[l] || 0) + 1;

  const structureCounts = {
    header: templates.filter(t => t.structure.header).length,
    nav:    templates.filter(t => t.structure.nav).length,
    footer: templates.filter(t => t.structure.footer).length,
    main:   templates.filter(t => t.structure.main).length,
  };

  const threeDCounts = {
    usesThree:       templates.filter(t => t.threeD.usesThree).length,
    withCanvas:      templates.filter(t => t.threeD.canvas).length,
    withWebGL:       templates.filter(t => t.threeD.webglRenderer).length,
    withSpin:        templates.filter(t => t.threeD.spin).length,
    withAutoRotate:  templates.filter(t => t.threeD.autoRotate).length,
    roughnessSet:    templates.filter(t => /\broughness\s*:/.test(readFileSync(join(SAMPLES, basename(t.file)), "utf8"))).length,
  };

  const linkStats = {
    totalAnchors:    templates.reduce((a, t) => a + t.links.anchors, 0),
    filesWithAnchors: templates.filter(t => t.links.anchors > 0).length,
    filesWithSmoothScroll: templates.filter(t => t.links.smoothScroll).length,
    topAnchorFiles: [...templates]
      .sort((a, b) => b.links.anchors - a.links.anchors)
      .slice(0, 5)
      .map(t => ({ id: t.id, anchors: t.links.anchors })),
  };

  const out = {
    generatedAt: null,                                  // stamped at publish time
    samplesDir: "samples/minimax-m3-high",
    templateCount: templates.length,
    templates,
    summary: {
      byTechnique,
      byLib,
      structureCounts,
      threeDCounts,
      linkStats,
    },
  };

  writeFileSync(OUT_FILE, JSON.stringify(out, null, 2) + "\n", "utf8");
  // eslint-disable-next-line no-console
  console.log(`wrote ${OUT_FILE}`);
  console.log(`  templates: ${templates.length}`);
  console.log(`  byTechnique: ${JSON.stringify(byTechnique, null, 2)}`);
  console.log(`  byLib: ${JSON.stringify(byLib, null, 2)}`);
}

main();