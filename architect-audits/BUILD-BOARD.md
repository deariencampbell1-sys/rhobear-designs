# rhobear-designs — Editor Build Board

Orchestrated by Iron Man (lane: rhobear-designs). UX is built BY HAND by Iron Man + owner — never dispatched.
Integration branch: build/editor-v1 (off feat/website-editor). Workers = MiniMax-M3 / high. Neo gates each wave.

## Architecture (fork & own)
Two-mode editor on an owned core. Mode A "Edit Live Site": real site renders live in an iframe (scripts/WebGL
intact) + an overlay edit layer → annotate, never re-render → functions never lost. Mode B "Build from scratch":
vendored GrapesJS. Shared owned headless core (doc model / command bus / serializer) so the AI phase slots in.

## Waves (queue: 1 → 2 → 3, then STOP; owner+Iron Man build UX together)
- [x] **Wave 1 — make-it-ours** ✅ merged + build-verified (HEAD dd5d2bd)
  - [ ] g1-vendor-grapes — vendor GrapesJS+plugins into src/vendor, NOTICES, build off vendored
  - [x] core1-doc-model — relocated to editor/src/core; node --test green (PR #3 merged)
- [x] **Wave 2 — live-fidelity engine** ✅ merged + verified (PRs #5/#6/#7; build+tests green; HEAD 51e99b6)
  - [ ] iframe live-render (scripts/CSS/fonts intact)
  - [ ] overlay picker + postMessage bridge + inline-text
  - [ ] style-override injector + diff serializer
- [x] **Wave 3 — functions round-out** ✅ merged (PRs #8/#9/#10); verify: ci=ok build=ok core=ok engine=ok fidelity=ok (HEAD 900d4e1)
  - [ ] GrapesJS-as-ModeB behind shell
  - [ ] import/folder/asset + embed hardening
  - [ ] export HTML/ZIP + round-trip fidelity tests (51 samples)
- [x] **UX phase — built, branded (Aurora Teal), smoke-tested 20/20, stood up @ http://127.0.0.1:5180.** Two modes wired to engine, intent inspector, onboarding, AI seam. Iterating with owner from here. Top tune: overlay selection-box offset.

_Updated as each wave lands._

---
## SWARM BUILD PHASE COMPLETE 2026-06-20T23:24:01Z
Editor is ours end-to-end and fully functional WITHOUT AI: vendored engine, headless core, live-fidelity edit engine, both modes, hardened IO, fidelity-proven. Next = hand-built UX (Aurora Teal), then AI chat-bubble layer.
