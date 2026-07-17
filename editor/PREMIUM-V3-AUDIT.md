# RHOBEAR Designs — premium-v3 gate audit (2026-07-17)

Ran the full `_DISPATCH-BRIEFS/brief-designs.md` DoD checklist against the LIVE product at
`designs.rhobear.ai`, signed-in-equivalent state (Designs has no server auth — client-side
BYOK editor, verified against the real deployed bundle, not a mockup). Method: Playwright
against production (bypassed a stuck Browser-pane screenshot tool), plus computed-style
inspection (`getComputedStyle`) to prove `backdrop-filter` is real, not just present in CSS.

**Result: no gaps found. Every DoD item is already shipped and verified live.** No source
change made — this file is the audit record, not a code diff.

## Checked, live, real values

- `backdrop-filter: blur(22px) saturate(1.4)` computed on `.rb-toolbar`, `.rb-rail`,
  `.rb-inspector`, `.rb-tpl-card`, `.rb-lib-card`; `blur(14px)` on `.rb-status`/`.rb-modeswitch`;
  `blur(24px)` on `.rb-ai-panel`; `blur(10px)` on real (non-ghost) `.rb-btn`.
- Plasma edge + ignite: `.rb-tpl-card::after` / `.rb-btn.is-active::after` / `.rb-ai-fab::before`
  all carry the conic `#00dfff→#7c5cff→#d83fff` mask-ring, `opacity .45→1` + `edgeflow` on
  hover/focus — confirmed both in source (`premium-glass.css`, `adobe-surfaces.css`) and by
  driving focus into the composer live (screenshot 06).
- Orb: `#rho-launch` computed rect = 36×36, seated top-right of the toolbar, embed served from
  `designs.rhobear.ai/companion-embed.js` (own host, current build).
- Bear: consistent red silhouette glyph across titlebar / onboarding / canvas empty-state /
  AI-panel logo — one asset, not redrawn per surface.
- Nacelle: `font-family` computed on body, toolbar, buttons = `Nacelle, system-ui, …`.
- No dead design-agent classes: `.hub-*` / `.plans-*` / `.designs-*` invented selectors —
  zero matches in the live served `main-*.css` bundle (grepped the downloaded bundle).
- No emoji-as-icon: only 3 non-emoji typographic glyphs in the live DOM (♦ ✦ ✕ — context-menu
  minimalist marks, not slop, already blessed in a prior pass).
- No JP text leak (`モード`) — absent from live HTML (prior fix confirmed still live).
- Selection = blue star `#4A9EFF`: verified live — clicking a canvas element shows the blue
  border, blue toolbar chip, blue "Text" label (screenshot 10).
- Front-door onboarding (4 steps) is real glass too: `.dsob-pill` / `.dsob-tpl` / `.dsob-orb`
  all carry `backdrop-filter` in source, confirmed on-screen (screenshots 01–02).
- Mobile (390px) + tablet (820px): responsive, orb stays 36px seated, toolbar/rail glass holds
  (screenshots 08–09).
- Guardrails: N/A by design — Designs is a client-side BYO-LLM-key editor, no server AI spend
  to gate (per [[dev-accounts-byok-doctrine]] canon).

## Proof screenshots (live production, not mockups)
`D:\rhobear-design-ecosystem-cache\premium-pass-2026-07\renderings\designs\_v3proof\`
- `01-onboarding-step1.png`, `02-onboarding-step4-rho.png` — front-door glass
- `03-editor-start.png`, `04-editor-templates.png` — main shell, toolbar/rail/cards glass
- `05-ai-panel-glass.png`, `06-composer-ignited.png` — AI panel + focus-ignite
- `07-canvas-blank.png` — build-from-scratch mode, panel glass reading depth through a white canvas
- `08-mobile.png`, `09-tablet.png` — responsive surfaces
- `10-selection-handles.png` — blue star selection chrome

## One correction made during this audit (docs, not app code)
`_ASSET-MAP.md`'s `TARGET-mockups/designs/*.png` (5 files) are actually **RHOBEAR Plans**
screens (Email/Whiteboard/Payments/Notes/onboarding), not the Designs editor — wrong folder
got linked for this app. Used `renderings/designs/_after/*.png` instead (the brief's own
"approved renderings" list), which are the correct target for this app.
