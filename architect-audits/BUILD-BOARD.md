# rhobear-designs — Editor Build Board

Orchestrated by Iron Man (lane: rhobear-designs). UX is built BY HAND by Iron Man + owner — never dispatched.
Integration branch: build/editor-v1 (off feat/website-editor). Workers = MiniMax-M3 / high. Neo gates each wave.

## Architecture (fork & own)
Two-mode editor on an owned core. Mode A "Edit Live Site": real site renders live in an iframe (scripts/WebGL
intact) + an overlay edit layer → annotate, never re-render → functions never lost. Mode B "Build from scratch":
vendored GrapesJS. Shared owned headless core (doc model / command bus / serializer) so the AI phase slots in.

## Waves (queue: 1 → 2 → 3, then STOP; owner+Iron Man build UX together)
- [~] **Wave 1 — make-it-ours** (DISPATCHED 2026-06-20T21:28:41Z; wave-watch armed; Neo on completion)
  - [ ] g1-vendor-grapes — vendor GrapesJS+plugins into src/vendor, NOTICES, build off vendored
  - [ ] core1-doc-model — headless doc model + command bus + serializer (no UI)
- [ ] **Wave 2 — live-fidelity engine** (queued)
  - [ ] iframe live-render (scripts/CSS/fonts intact)
  - [ ] overlay picker + postMessage bridge + inline-text
  - [ ] style-override injector + diff serializer
- [ ] **Wave 3 — functions round-out** (queued)
  - [ ] GrapesJS-as-ModeB behind shell
  - [ ] import/folder/asset + embed hardening
  - [ ] export HTML/ZIP + round-trip fidelity tests (51 samples)
- [ ] **Post-wave-3 — UX (Iron Man + owner, by hand): React shell, contextual toolbar, intent inspector, onboarding, polish**

_Updated as each wave lands._
