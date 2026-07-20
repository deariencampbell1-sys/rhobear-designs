# Pathway Manifest - rhobear-designs

> Read-only mapping. Each interactive element in every HTML/CSS/JS sample is catalogued
> so a downstream verifier can mechanically check every design's working pathways.

## Repository Overview

- URL: https://github.com/deariencampbell1-sys/rhobear-designs
- Samples: 62 HTML files across 3 models
- Generated: 2026-06-21

## Anti-pattern Counts (site-wide)

| Anti-pattern | Count |
|--------------|-------|
| href="#" / javascript:void links | 594 |
| Unwired <button> (no onclick/data-action) | 75 |
| Unwired <form> (no action) | 4 |
| CDN script references | 81 |
| TODO/FIXME/XXX in code | 2 |
| Localhost fetch() calls | 0 |
| Total unwired elements | 673 |

## Top Suspicious Interactive Elements (site-wide)

| Rank | File | Element ID | Type | Href/Handler |
|------|------|------------|------|--------------|
| 1 | minimax-m3-high/lisovskiy-work.html | unnamed | button | UNWIRED |
| 2 | minimax-m3-high/lisovskiy-work.html | Music-Videos-I-Like | link | # |
| 3 | minimax-m3-high/lisovskiy-work.html | Wendy-Andrade | link | # |
| 4 | minimax-m3-high/lisovskiy-work.html | Manychat-careers | link | # |
| 5 | minimax-m3-high/lisovskiy-work.html | Polkaswap | link | # |
| 6 | minimax-m3-high/lisovskiy-work.html | Fearless-wallet | link | # |
| 7 | minimax-m3-high/lisovskiy-work.html | Polecat-Agency | link | # |
| 8 | minimax-m3-high/lisovskiy-work.html | Elena-Borisova | link | # |
| 9 | minimax-m3-high/lisovskiy-work.html | SORA-Card | link | # |
| 10 | minimax-m3-high/lisovskiy-work.html | Style-Reptile-Figma-plugin | link | # |
| 11 | minimax-m3-high/lisovskiy-work.html | Fraud-Intelligence-Limited | link | # |
| 12 | minimax-m3-high/lisovskiy-work.html | SORA | link | # |
| 13 | minimax-m3-high/lisovskiy-work.html | Sekelyk-amp-Partners-Law-Bureau | link | # |
| 14 | minimax-m3-high/lisovskiy-work.html | Manychat-websites | link | # |
| 15 | minimax-m3-high/lisovskiy-work.html | Personal-page | link | # |
| 16 | minimax-m3-high/lisovskiy-work.html | Instagram-summit-2022 | link | # |
| 17 | minimax-m3-high/lisovskiy-work.html | Recycling-guide | link | # |
| 18 | minimax-m3-high/lisovskiy-work.html | Get-a-topic | link | # |
| 19 | minimax-m3-high/lisovskiy-work.html | Burn-the-tickets-game | link | # |
| 20 | minimax-m3-high/lisovskiy-work.html | Big-traffic-rules-exam | link | # |
| 21 | minimax-m3-high/lisovskiy-work.html | 98-agency | link | # |
| 22 | minimax-m3-high/lisovskiy-work.html | Ovvverrrflowww-Figma-plugin | link | # |
| 23 | minimax-m3-high/lisovskiy-work.html | 20-stories-of-2020-Yandex-Taxi | link | # |
| 24 | minimax-m3-high/lisovskiy-work.html | Manymoji | link | # |
| 25 | minimax-m3-high/lisovskiy-work.html | Manychat-contributor | link | # |
| 26 | minimax-m3-high/lisovskiy-work.html | Manychat-banners | link | # |
| 27 | minimax-m3-high/lisovskiy-work.html | Pro-40 | link | # |
| 28 | minimax-m3-high/lisovskiy-work.html | NWPC | link | # |
| 29 | minimax-m3-high/lisovskiy-work.html | Norkpalm | link | # |
| 30 | minimax-m3-high/lisovskiy-work.html | Megafon-big-data | link | # |

## Per-Sample Pathway Tables

### 109ichiki.html

**Model:** minimax-m2.7 | **File size:** 14,298 bytes | **Total elements:** 10 | **Unwired:** 9 (links=7, btns=2, forms=0)

**CDN scripts:** https://cdn.tailwindcss.com

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | lightBtn | 404 | button | button#lightBtn | UNWIRED | **YES** |
| 2 | darkBtn | 405 | button | button#darkBtn | UNWIRED | **YES** |
| 3 | unnamed | 472 | link | a.event-item | # | **YES** |
| 4 | unnamed | 476 | link | a.event-item | # | **YES** |
| 5 | unnamed | 480 | link | a.event-item | # | **YES** |
| 6 | unnamed | 490 | link | a | # | **YES** |
| 7 | unnamed | 491 | link | a | # | **YES** |
| 8 | unnamed | 492 | link | a | # | **YES** |
| 9 | unnamed | 493 | link | a | # | **YES** |
| 10 | unnamed | 500 | button | button.modal-close | closeModal() |  |

---

### active-theory.html

**Model:** minimax-m2.7 | **File size:** 17,444 bytes | **Total elements:** 8 | **Unwired:** 4 (links=4, btns=0, forms=0)

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 510 | link | a | #work |  |
| 2 | unnamed | 511 | link | a | #services |  |
| 3 | unnamed | 512 | link | a | #contact |  |
| 4 | unnamed | 652 | link | a.contact-email | mailto:hello@activetheory.net |  |
| 5 | unnamed | 660 | link | a | # | **YES** |
| 6 | unnamed | 661 | link | a | # | **YES** |
| 7 | unnamed | 662 | link | a | # | **YES** |
| 8 | unnamed | 663 | link | a | # | **YES** |

---

### alche-studio.html

**Model:** minimax-m2.7 | **File size:** 18,882 bytes | **Total elements:** 45 | **Unwired:** 26 (links=21, btns=5, forms=0)

**CDN scripts:** https://cdn.tailwindcss.com, https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 325 | link | a | # | **YES** |
| 2 | unnamed | 326 | link | a | # | **YES** |
| 3 | unnamed | 327 | link | a | # | **YES** |
| 4 | unnamed | 328 | link | a | # | **YES** |
| 5 | unnamed | 329 | link | a | # | **YES** |
| 6 | unnamed | 333 | link | a | # | **YES** |
| 7 | soundBtn | 338 | button | button#soundBtn | UNWIRED | **YES** |
| 8 | unnamed | 353 | link | a | # | **YES** |
| 9 | unnamed | 356 | link | a | # | **YES** |
| 10 | unnamed | 359 | link | a | # | **YES** |
| 11 | unnamed | 362 | link | a | # | **YES** |
| 12 | unnamed | 370 | link | a | # | **YES** |
| 13 | unnamed | 371 | link | a | # | **YES** |
| 14 | unnamed | 372 | link | a | # | **YES** |
| 15 | unnamed | 373 | link | a | # | **YES** |
| 16 | unnamed | 374 | link | a | # | **YES** |
| 17 | unnamed | 375 | link | a | # | **YES** |
| 18 | unnamed | 376 | link | a | # | **YES** |
| 19 | unnamed | 377 | link | a | # | **YES** |
| 20 | unnamed | 387 | button | button.ctrl-btn | UNWIRED | **YES** |
| 21 | unnamed | 388 | button | button.ctrl-btn | UNWIRED | **YES** |
| 22 | unnamed | 389 | button | button.ctrl-btn | UNWIRED | **YES** |
| 23 | matR | 397 | input:range | input#matR | range input | - |
| 24 | matRval | 398 | input:text | input#matRval | text input | - |
| 25 | matG | 402 | input:range | input#matG | range input | - |
| 26 | matGval | 403 | input:text | input#matGval | text input | - |
| 27 | matB | 407 | input:range | input#matB | range input | - |
| 28 | matBval | 408 | input:text | input#matBval | text input | - |
| 29 | quatX | 416 | input:range | input#quatX | range input | - |
| 30 | quatXval | 417 | input:text | input#quatXval | text input | - |
| 31 | quatY | 421 | input:range | input#quatY | range input | - |
| 32 | quatYval | 422 | input:text | input#quatYval | text input | - |
| 33 | quatZ | 426 | input:range | input#quatZ | range input | - |
| 34 | quatZval | 427 | input:text | input#quatZval | text input | - |
| 35 | quatW | 431 | input:range | input#quatW | range input | - |
| 36 | quatWval | 432 | input:text | input#quatWval | text input | - |
| 37 | resetQuat | 434 | button | button#resetQuat | UNWIRED | **YES** |
| 38 | screenInt | 441 | input:range | input#screenInt | range input | - |
| 39 | screenIntVal | 442 | input:text | input#screenIntVal | text input | - |
| 40 | screenR | 447 | input:range | input#screenR | range input | - |
| 41 | screenG | 451 | input:range | input#screenG | range input | - |
| 42 | screenB | 455 | input:range | input#screenB | range input | - |
| 43 | unnamed | 473 | link | a | # | **YES** |
| 44 | unnamed | 474 | link | a | # | **YES** |
| 45 | unnamed | 475 | link | a | # | **YES** |

---

### brandappart.html

**Model:** minimax-m2.7 | **File size:** 14,388 bytes | **Total elements:** 15 | **Unwired:** 15 (links=15, btns=0, forms=0)

**CDN scripts:** https://cdn.tailwindcss.com

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 449 | link | a | # | **YES** |
| 2 | unnamed | 450 | link | a | # | **YES** |
| 3 | unnamed | 451 | link | a | # | **YES** |
| 4 | unnamed | 452 | link | a | # | **YES** |
| 5 | unnamed | 453 | link | a | # | **YES** |
| 6 | unnamed | 455 | link | a.cta-btn | # | **YES** |
| 7 | unnamed | 485 | link | a.work-link | # | **YES** |
| 8 | unnamed | 494 | link | a.work-link | # | **YES** |
| 9 | unnamed | 503 | link | a.work-link | # | **YES** |
| 10 | unnamed | 512 | link | a.work-link | # | **YES** |
| 11 | unnamed | 549 | link | a.cta-btn | # | **YES** |
| 12 | unnamed | 556 | link | a | # | **YES** |
| 13 | unnamed | 557 | link | a | # | **YES** |
| 14 | unnamed | 558 | link | a | # | **YES** |
| 15 | unnamed | 559 | link | a | # | **YES** |

---

### bruno-simon-portfolio.html

**Model:** minimax-m2.7 | **File size:** 29,765 bytes | **Total elements:** 0 | **Unwired:** 0 (links=0, btns=0, forms=0)

**CDN scripts:** https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js

*No interactive elements detected.*

### bychudy.html

**Model:** minimax-m2.7 | **File size:** 14,504 bytes | **Total elements:** 7 | **Unwired:** 6 (links=6, btns=0, forms=0)

**CDN scripts:** https://cdn.tailwindcss.com

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 410 | link | a | # | **YES** |
| 2 | unnamed | 411 | link | a | # | **YES** |
| 3 | unnamed | 412 | link | a | # | **YES** |
| 4 | unnamed | 550 | link | a.contact-email | mailto:hello@bychudy.com |  |
| 5 | unnamed | 557 | link | a | # | **YES** |
| 6 | unnamed | 558 | link | a | # | **YES** |
| 7 | unnamed | 559 | link | a | # | **YES** |

---

### cappen.html

**Model:** minimax-m2.7 | **File size:** 10,578 bytes | **Total elements:** 9 | **Unwired:** 5 (links=3, btns=1, forms=1)

**CDN scripts:** https://cdn.tailwindcss.com

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 313 | button | button.cookie-btn | acceptCookies() |  |
| 2 | form-349 | 349 | form | form.contact-form | GET NO_ACTION | **YES** |
| 3 | name | 352 | input:text | input[name="name"] | text input name=name | - |
| 4 | email | 356 | input:email | input[name="email"] | email input name=email | - |
| 5 | unnamed | 362 | button | button.submit-btn | UNWIRED | **YES** |
| 6 | unnamed | 370 | link | a | # | **YES** |
| 7 | unnamed | 371 | link | a | # | **YES** |
| 8 | unnamed | 372 | link | a | # | **YES** |
| 9 | unnamed | 374 | link | a | mailto:felipe@cappen.com |  |

---

### resn.html

**Model:** minimax-m2.7 | **File size:** 18,833 bytes | **Total elements:** 8 | **Unwired:** 4 (links=4, btns=0, forms=0)

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 569 | link | a | #projects |  |
| 2 | unnamed | 570 | link | a | #services |  |
| 3 | unnamed | 571 | link | a | #contact |  |
| 4 | unnamed | 717 | link | a.contact-email | mailto:hello@resn.co.nz |  |
| 5 | unnamed | 726 | link | a | # | **YES** |
| 6 | unnamed | 727 | link | a | # | **YES** |
| 7 | unnamed | 728 | link | a | # | **YES** |
| 8 | unnamed | 729 | link | a | # | **YES** |

---

### stokt.html

**Model:** minimax-m2.7 | **File size:** 18,756 bytes | **Total elements:** 21 | **Unwired:** 19 (links=18, btns=1, forms=0)

**CDN scripts:** https://cdn.tailwindcss.com

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 568 | button | button.cookie-btn | acceptCookies() |  |
| 2 | unnamed | 576 | link | a | # | **YES** |
| 3 | unnamed | 577 | link | a | # | **YES** |
| 4 | unnamed | 578 | link | a | # | **YES** |
| 5 | unnamed | 579 | link | a | # | **YES** |
| 6 | unnamed | 586 | button | button.estimate-btn | UNWIRED | **YES** |
| 7 | unnamed | 681 | link | a.cta-button | # | **YES** |
| 8 | unnamed | 694 | link | a | # | **YES** |
| 9 | unnamed | 695 | link | a | # | **YES** |
| 10 | unnamed | 696 | link | a | # | **YES** |
| 11 | unnamed | 697 | link | a | # | **YES** |
| 12 | unnamed | 703 | link | a | # | **YES** |
| 13 | unnamed | 704 | link | a | # | **YES** |
| 14 | unnamed | 705 | link | a | # | **YES** |
| 15 | unnamed | 706 | link | a | # | **YES** |
| 16 | unnamed | 712 | link | a | # | **YES** |
| 17 | unnamed | 713 | link | a | # | **YES** |
| 18 | unnamed | 714 | link | a | # | **YES** |
| 19 | unnamed | 715 | link | a | mailto:hello@wearestokt.com |  |
| 20 | unnamed | 722 | link | a | # | **YES** |
| 21 | unnamed | 723 | link | a | # | **YES** |

---

### they-call-me-giulio.html

**Model:** minimax-m2.7 | **File size:** 23,987 bytes | **Total elements:** 4 | **Unwired:** 0 (links=0, btns=0, forms=0)

**CDN scripts:** https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 402 | button | button.glitch-btn | triggerGlitch() |  |
| 2 | unnamed | 424 | button | button.glitch-btn | triggerGlitch() |  |
| 3 | unnamed | 446 | button | button.glitch-btn | triggerGlitch() |  |
| 4 | unnamed | 467 | button | button.glitch-btn | triggerGlitch() |  |

---

### 109ichiki.html

**Model:** minimax-m3-high | **File size:** 27,606 bytes | **Total elements:** 18 | **Unwired:** 14 (links=14, btns=0, forms=0)

**CDN scripts:** https://cdn.tailwindcss.com

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 267 | link | a.brand | # | **YES** |
| 2 | unnamed | 269 | link | a | #home |  |
| 3 | unnamed | 270 | link | a | #works |  |
| 4 | unnamed | 271 | link | a | #profile |  |
| 5 | unnamed | 272 | link | a | #contact |  |
| 6 | unnamed | 275 | link | a | # | **YES** |
| 7 | unnamed | 276 | link | a | # | **YES** |
| 8 | unnamed | 335 | link | a.cta | # | **YES** |
| 9 | unnamed | 346 | link | a.cta | # | **YES** |
| 10 | unnamed | 357 | link | a.cta | # | **YES** |
| 11 | unnamed | 368 | link | a.cta | # | **YES** |
| 12 | unnamed | 407 | link | a.cta | # | **YES** |
| 13 | unnamed | 421 | link | a | # | **YES** |
| 14 | unnamed | 422 | link | a | # | **YES** |
| 15 | unnamed | 423 | link | a | # | **YES** |
| 16 | unnamed | 424 | link | a | # | **YES** |
| 17 | unnamed | 425 | link | a | # | **YES** |
| 18 | unnamed | 426 | link | a | # | **YES** |

---

### abhishekjha.html

**Model:** minimax-m3-high | **File size:** 23,713 bytes | **Total elements:** 4 | **Unwired:** 4 (links=4, btns=0, forms=0)

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 516 | link | a.about-me | # | **YES** |
| 2 | unnamed | 570 | link | a | # | **YES** |
| 3 | unnamed | 571 | link | a | # | **YES** |
| 4 | unnamed | 572 | link | a | # | **YES** |

---

### adrienlamy.html

**Model:** minimax-m3-high | **File size:** 15,696 bytes | **Total elements:** 7 | **Unwired:** 7 (links=6, btns=1, forms=0)

**CDN scripts:** https://cdn.tailwindcss.com

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 138 | link | a | # | **YES** |
| 2 | unnamed | 140 | link | a | # | **YES** |
| 3 | unnamed | 141 | link | a | # | **YES** |
| 4 | unnamed | 142 | link | a | # | **YES** |
| 5 | closeSide | 253 | button | button#closeSide | UNWIRED | **YES** |
| 6 | unnamed | 273 | link | a | # | **YES** |
| 7 | unnamed | 274 | link | a | # | **YES** |

---

### alche-studio.html

**Model:** minimax-m3-high | **File size:** 25,605 bytes | **Total elements:** 9 | **Unwired:** 7 (links=6, btns=1, forms=0)

**CDN scripts:** https://cdn.tailwindcss.com, https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 211 | link | a.logo | # | **YES** |
| 2 | unnamed | 213 | link | a | # | **YES** |
| 3 | unnamed | 214 | link | a | # | **YES** |
| 4 | unnamed | 215 | link | a | # | **YES** |
| 5 | unnamed | 216 | link | a | # | **YES** |
| 6 | unnamed | 219 | link | a.pill | # | **YES** |
| 7 | m-rough | 232 | input:range | input#m-rough | range input | - |
| 8 | m-noise | 233 | input:range | input#m-noise | range input | - |
| 9 | reset-quat | 253 | button | button#reset-quat | UNWIRED | **YES** |

---

### bindery.html

**Model:** minimax-m3-high | **File size:** 25,400 bytes | **Total elements:** 10 | **Unwired:** 8 (links=3, btns=5, forms=0)

**CDN scripts:** https://cdn.tailwindcss.com

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 248 | link | a.font-display | # | **YES** |
| 2 | Talk-to-us | 274 | link | a.pill | #contact |  |
| 3 | unnamed | 287 | link | a.micro-2 | # | **YES** |
| 4 | unnamed | 313 | link | a.micro-2 | # | **YES** |
| 5 | unnamed | 372 | button | button | UNWIRED | **YES** |
| 6 | unnamed | 373 | button | button | UNWIRED | **YES** |
| 7 | unnamed | 374 | button | button | UNWIRED | **YES** |
| 8 | unnamed | 375 | button | button | UNWIRED | **YES** |
| 9 | unnamed | 376 | button | button | UNWIRED | **YES** |
| 10 | unnamed | 467 | link | a.font-display | mailto:hello@bindery.example |  |

---

### brand-appart.html

**Model:** minimax-m3-high | **File size:** 28,700 bytes | **Total elements:** 21 | **Unwired:** 12 (links=12, btns=0, forms=0)

**CDN scripts:** https://cdn.tailwindcss.com

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 242 | link | a.brand | # | **YES** |
| 2 | unnamed | 244 | link | a | #work |  |
| 3 | unnamed | 245 | link | a | #about |  |
| 4 | unnamed | 246 | link | a | #contact |  |
| 5 | EN | 249 | link | a.on | # | **YES** |
| 6 | unnamed | 249 | link | a | # | **YES** |
| 7 | unnamed | 250 | link | a.cta | #contact |  |
| 8 | unnamed | 262 | link | a.btn-primary | #contact |  |
| 9 | unnamed | 263 | link | a.btn-secondary | #work |  |
| 10 | unnamed | 472 | link | a.cta | #contact |  |
| 11 | unnamed | 486 | link | a | #work |  |
| 12 | unnamed | 487 | link | a | #about |  |
| 13 | unnamed | 488 | link | a | # | **YES** |
| 14 | unnamed | 489 | link | a | # | **YES** |
| 15 | unnamed | 493 | link | a | # | **YES** |
| 16 | unnamed | 494 | link | a | # | **YES** |
| 17 | unnamed | 495 | link | a | # | **YES** |
| 18 | unnamed | 496 | link | a | # | **YES** |
| 19 | unnamed | 500 | link | a | # | **YES** |
| 20 | unnamed | 501 | link | a | # | **YES** |
| 21 | unnamed | 502 | link | a | # | **YES** |

---

### bychudy.html

**Model:** minimax-m3-high | **File size:** 20,430 bytes | **Total elements:** 26 | **Unwired:** 24 (links=24, btns=0, forms=0)

**CDN scripts:** https://cdn.tailwindcss.com

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 188 | link | a.brand | # | **YES** |
| 2 | unnamed | 190 | link | a | # | **YES** |
| 3 | unnamed | 191 | link | a | # | **YES** |
| 4 | unnamed | 192 | link | a | # | **YES** |
| 5 | unnamed | 193 | link | a | # | **YES** |
| 6 | unnamed | 194 | link | a | # | **YES** |
| 7 | unnamed | 195 | link | a | # | **YES** |
| 8 | unnamed | 198 | link | a | #contact |  |
| 9 | unnamed | 224 | link | a.proj | # | **YES** |
| 10 | unnamed | 229 | link | a.proj | # | **YES** |
| 11 | unnamed | 235 | link | a.proj | # | **YES** |
| 12 | unnamed | 240 | link | a.proj | # | **YES** |
| 13 | unnamed | 246 | link | a.proj | # | **YES** |
| 14 | unnamed | 251 | link | a.proj | # | **YES** |
| 15 | unnamed | 257 | link | a.proj | # | **YES** |
| 16 | unnamed | 262 | link | a.proj | # | **YES** |
| 17 | unnamed | 268 | link | a.proj | # | **YES** |
| 18 | unnamed | 273 | link | a.proj | # | **YES** |
| 19 | unnamed | 279 | link | a.proj | # | **YES** |
| 20 | unnamed | 284 | link | a.proj | # | **YES** |
| 21 | unnamed | 290 | link | a.proj | # | **YES** |
| 22 | unnamed | 295 | link | a.proj | # | **YES** |
| 23 | unnamed | 312 | link | a.primary | # | **YES** |
| 24 | unnamed | 313 | link | a | # | **YES** |
| 25 | unnamed | 361 | link | a.primary | mailto:hi@bychudy.com |  |
| 26 | unnamed | 362 | link | a.ghost | # | **YES** |

---

### caffe-design.html

**Model:** minimax-m3-high | **File size:** 32,442 bytes | **Total elements:** 13 | **Unwired:** 1 (links=0, btns=1, forms=0)

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 351 | link | a.active | #galleria |  |
| 2 | unnamed | 352 | link | a | #biscottini |  |
| 3 | unnamed | 353 | link | a | #facciamo |  |
| 4 | unnamed | 354 | link | a | #librello |  |
| 5 | unnamed | 355 | link | a | #podcast |  |
| 6 | unnamed | 356 | link | a | #prodotti |  |
| 7 | unnamed | 357 | link | a | #tlif |  |
| 8 | unnamed | 358 | link | a | #retro |  |
| 9 | unnamed | 359 | link | a | #brand |  |
| 10 | unnamed | 365 | link | a | #galleria |  |
| 11 | input-548 | 548 | input:email | input | email input | - |
| 12 | input-549 | 549 | input:text | input | text input | - |
| 13 | unnamed | 551 | button | button | UNWIRED | **YES** |

---

### cappen.html

**Model:** minimax-m3-high | **File size:** 28,115 bytes | **Total elements:** 24 | **Unwired:** 18 (links=18, btns=0, forms=0)

**CDN scripts:** https://cdn.tailwindcss.com

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | Cappen | 236 | link | a.brand | # | **YES** |
| 2 | unnamed | 238 | link | a | #works |  |
| 3 | unnamed | 239 | link | a | #about |  |
| 4 | unnamed | 240 | link | a | #updates |  |
| 5 | unnamed | 243 | link | a.email | mailto:felipe@cappen.com |  |
| 6 | unnamed | 244 | link | a.cta | #start |  |
| 7 | unnamed | 258 | link | a.discover | #works |  |
| 8 | unnamed | 280 | link | a.launch | # | **YES** |
| 9 | unnamed | 300 | link | a.launch | # | **YES** |
| 10 | unnamed | 320 | link | a.launch | # | **YES** |
| 11 | unnamed | 340 | link | a.launch | # | **YES** |
| 12 | unnamed | 360 | link | a.launch | # | **YES** |
| 13 | unnamed | 380 | link | a.launch | # | **YES** |
| 14 | unnamed | 459 | link | a | # | **YES** |
| 15 | unnamed | 460 | link | a | # | **YES** |
| 16 | unnamed | 461 | link | a | # | **YES** |
| 17 | unnamed | 462 | link | a | # | **YES** |
| 18 | unnamed | 466 | link | a | # | **YES** |
| 19 | unnamed | 467 | link | a | # | **YES** |
| 20 | unnamed | 468 | link | a | # | **YES** |
| 21 | unnamed | 469 | link | a | # | **YES** |
| 22 | unnamed | 473 | link | a | # | **YES** |
| 23 | unnamed | 474 | link | a | # | **YES** |
| 24 | unnamed | 475 | link | a | # | **YES** |

---

### chipsa-design.html

**Model:** minimax-m3-high | **File size:** 25,418 bytes | **Total elements:** 14 | **Unwired:** 7 (links=4, btns=3, forms=0)

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 540 | link | a.logo | # | **YES** |
| 2 | unnamed | 558 | link | a | #works |  |
| 3 | unnamed | 559 | link | a | #about |  |
| 4 | unnamed | 560 | link | a | #services |  |
| 5 | unnamed | 561 | link | a | #contacts |  |
| 6 | unnamed | 573 | link | a.corner-cta | #tour |  |
| 7 | unnamed | 593 | link | a.all-link | # | **YES** |
| 8 | unnamed | 625 | link | a.view-details | # | **YES** |
| 9 | unnamed | 642 | button | button.play-btn | UNWIRED | **YES** |
| 10 | unnamed | 650 | button | button.play-btn | UNWIRED | **YES** |
| 11 | unnamed | 658 | button | button.play-btn | UNWIRED | **YES** |
| 12 | unnamed | 695 | link | a.email | mailto:hi@chipsa.design |  |
| 13 | unnamed | 704 | link | a.menu-pill | # | **YES** |
| 14 | unnamed | 710 | link | a.mail | mailto:hi@chipsa.design |  |

---

### clayboan.html

**Model:** minimax-m3-high | **File size:** 17,266 bytes | **Total elements:** 7 | **Unwired:** 7 (links=7, btns=0, forms=0)

**CDN scripts:** https://cdn.tailwindcss.com

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 170 | link | a | # | **YES** |
| 2 | LETS-CHAT | 172 | link | a | # | **YES** |
| 3 | unnamed | 172 | link | a | # | **YES** |
| 4 | unnamed | 266 | link | a | # | **YES** |
| 5 | unnamed | 267 | link | a | # | **YES** |
| 6 | unnamed | 268 | link | a | # | **YES** |
| 7 | unnamed | 269 | link | a | # | **YES** |

---

### cyphr-studio.html

**Model:** minimax-m3-high | **File size:** 15,203 bytes | **Total elements:** 7 | **Unwired:** 7 (links=7, btns=0, forms=0)

**CDN scripts:** https://cdn.tailwindcss.com

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 207 | link | a | # | **YES** |
| 2 | unnamed | 210 | link | a.card | # | **YES** |
| 3 | unnamed | 217 | link | a.card | # | **YES** |
| 4 | unnamed | 224 | link | a.card | # | **YES** |
| 5 | unnamed | 231 | link | a.card | # | **YES** |
| 6 | unnamed | 238 | link | a.card | # | **YES** |
| 7 | unnamed | 245 | link | a.card | # | **YES** |

---

### des-obys.html

**Model:** minimax-m3-high | **File size:** 19,712 bytes | **Total elements:** 15 | **Unwired:** 9 (links=8, btns=1, forms=0)

**CDN scripts:** https://cdn.tailwindcss.com, https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js, https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 185 | link | a.logo | # | **YES** |
| 2 | Practice | 194 | link | a | #practice |  |
| 3 | Seasons | 195 | link | a | #seasons |  |
| 4 | About | 196 | link | a | #about |  |
| 5 | unnamed | 202 | link | a.login | # | **YES** |
| 6 | unnamed | 242 | link | a | # | **YES** |
| 7 | unnamed | 242 | link | a | # | **YES** |
| 8 | are-the-titles-of-the-first-th | 242 | link | a | # | **YES** |
| 9 | unnamed | 246 | link | a.watch | # | **YES** |
| 10 | unnamed | 253 | button | button.play | UNWIRED | **YES** |
| 11 | unnamed | 337 | link | a.it | #practice |  |
| 12 | 03 | 338 | link | a.it | #seasons |  |
| 13 | unnamed | 339 | link | a.it | #about |  |
| 14 | unnamed | 343 | link | a | # | **YES** |
| 15 | unnamed | 344 | link | a | # | **YES** |

---

### doubleplay-studio.html

**Model:** minimax-m3-high | **File size:** 18,623 bytes | **Total elements:** 27 | **Unwired:** 23 (links=23, btns=0, forms=0)

**CDN scripts:** https://cdn.tailwindcss.com, https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js, https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 152 | link | a | #work |  |
| 2 | unnamed | 153 | link | a | #about |  |
| 3 | unnamed | 154 | link | a | # | **YES** |
| 4 | unnamed | 155 | link | a | # | **YES** |
| 5 | Double-Play | 157 | link | a.brand | # | **YES** |
| 6 | unnamed | 159 | link | a | # | **YES** |
| 7 | unnamed | 160 | link | a.pill | # | **YES** |
| 8 | Strategy--Design--Development | 185 | link | a.btn-cta | # | **YES** |
| 9 | Start-up | 194 | link | a.row | # | **YES** |
| 10 | Product | 195 | link | a.row | # | **YES** |
| 11 | Start-up | 196 | link | a.row | # | **YES** |
| 12 | Start-up | 197 | link | a.row | # | **YES** |
| 13 | Real-estate | 198 | link | a.row | # | **YES** |
| 14 | Product | 199 | link | a.row | # | **YES** |
| 15 | Start-up | 200 | link | a.row | # | **YES** |
| 16 | Real-estate | 201 | link | a.row | # | **YES** |
| 17 | Contact | 265 | link | a.btn-cta | # | **YES** |
| 18 | unnamed | 277 | link | a | #work |  |
| 19 | unnamed | 278 | link | a | #about |  |
| 20 | unnamed | 279 | link | a | # | **YES** |
| 21 | unnamed | 280 | link | a | # | **YES** |
| 22 | unnamed | 284 | link | a | # | **YES** |
| 23 | unnamed | 285 | link | a | # | **YES** |
| 24 | unnamed | 286 | link | a | # | **YES** |
| 25 | unnamed | 287 | link | a | # | **YES** |
| 26 | unnamed | 291 | link | a | # | **YES** |
| 27 | unnamed | 292 | link | a | # | **YES** |

---

### eduard-bodak.html

**Model:** minimax-m3-high | **File size:** 33,215 bytes | **Total elements:** 21 | **Unwired:** 11 (links=11, btns=0, forms=0)

**CDN scripts:** https://cdn.tailwindcss.com

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 427 | link | a.brand-pill | #top |  |
| 2 | Service | 432 | link | a.nav-pill | #service |  |
| 3 | unnamed | 433 | link | a.nav-pill | #prozess |  |
| 4 | unnamed | 434 | link | a.nav-pill | #preis |  |
| 5 | unnamed | 435 | link | a.nav-pill | #kontakt |  |
| 6 | FEED | 437 | link | a.feed-pill | #feed |  |
| 7 | unnamed | 653 | link | a | #top |  |
| 8 | unnamed | 654 | link | a | #prozess |  |
| 9 | unnamed | 655 | link | a | #preis |  |
| 10 | unnamed | 656 | link | a | #kontakt |  |
| 11 | unnamed | 659 | link | a | # | **YES** |
| 12 | unnamed | 660 | link | a | # | **YES** |
| 13 | unnamed | 661 | link | a | # | **YES** |
| 14 | unnamed | 662 | link | a | # | **YES** |
| 15 | unnamed | 663 | link | a | # | **YES** |
| 16 | unnamed | 666 | link | a | # | **YES** |
| 17 | unnamed | 667 | link | a | # | **YES** |
| 18 | unnamed | 668 | link | a | # | **YES** |
| 19 | unnamed | 671 | link | a | # | **YES** |
| 20 | unnamed | 672 | link | a | # | **YES** |
| 21 | unnamed | 673 | link | a | # | **YES** |

---

### firstframe.html

**Model:** minimax-m3-high | **File size:** 27,517 bytes | **Total elements:** 20 | **Unwired:** 12 (links=12, btns=0, forms=0)

**CDN scripts:** https://cdn.tailwindcss.com

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 284 | link | a.wordmark | # | **YES** |
| 2 | unnamed | 287 | link | a | #advertisement |  |
| 3 | unnamed | 288 | link | a | #originals |  |
| 4 | unnamed | 289 | link | a | #corporate |  |
| 5 | unnamed | 290 | link | a | #music |  |
| 6 | unnamed | 291 | link | a | #studio |  |
| 7 | unnamed | 294 | link | a | #about |  |
| 8 | unnamed | 295 | link | a | #contact |  |
| 9 | unnamed | 297 | link | a.text-white/60 | # | **YES** |
| 10 | unnamed | 297 | link | a.text-white/40 | # | **YES** |
| 11 | unnamed | 306 | link | a | # | **YES** |
| 12 | unnamed | 307 | link | a | # | **YES** |
| 13 | unnamed | 334 | link | a | # | **YES** |
| 14 | unnamed | 335 | link | a | # | **YES** |
| 15 | unnamed | 336 | link | a | # | **YES** |
| 16 | unnamed | 353 | link | a.discover | #advertisement |  |
| 17 | unnamed | 502 | link | a | # | **YES** |
| 18 | unnamed | 503 | link | a | # | **YES** |
| 19 | unnamed | 504 | link | a | # | **YES** |
| 20 | unnamed | 505 | link | a | # | **YES** |

---

### geex-arts.html

**Model:** minimax-m3-high | **File size:** 18,989 bytes | **Total elements:** 17 | **Unwired:** 10 (links=10, btns=0, forms=0)

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 310 | link | a.logo | # | **YES** |
| 2 | unnamed | 313 | link | a | #works |  |
| 3 | unnamed | 314 | link | a | #services |  |
| 4 | unnamed | 315 | link | a | #industries |  |
| 5 | unnamed | 316 | link | a | #about |  |
| 6 | unnamed | 317 | link | a | #contact |  |
| 7 | unnamed | 320 | link | a.cta-pill | #contact |  |
| 8 | unnamed | 432 | link | a | # | **YES** |
| 9 | unnamed | 433 | link | a | # | **YES** |
| 10 | unnamed | 434 | link | a | # | **YES** |
| 11 | unnamed | 435 | link | a | # | **YES** |
| 12 | unnamed | 441 | link | a | # | **YES** |
| 13 | unnamed | 442 | link | a | # | **YES** |
| 14 | unnamed | 443 | link | a | # | **YES** |
| 15 | unnamed | 444 | link | a | # | **YES** |
| 16 | unnamed | 450 | link | a | mailto:hi@geex-arts.com |  |
| 17 | unnamed | 451 | link | a | # | **YES** |

---

### generalcondition.html

**Model:** minimax-m3-high | **File size:** 38,166 bytes | **Total elements:** 33 | **Unwired:** 27 (links=27, btns=0, forms=0)

**CDN scripts:** https://cdn.tailwindcss.com

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 224 | link | a.logo | # | **YES** |
| 2 | unnamed | 234 | link | a | #work |  |
| 3 | unnamed | 236 | link | a | #about |  |
| 4 | unnamed | 239 | link | a | #mood |  |
| 5 | unnamed | 240 | link | a | #stories |  |
| 6 | unnamed | 242 | link | a.let | #contact |  |
| 7 | unnamed | 319 | link | a.see | #work |  |
| 8 | Identity | 405 | link | a.card | # | **YES** |
| 9 | Editorial | 406 | link | a.card | # | **YES** |
| 10 | Brand | 407 | link | a.card | # | **YES** |
| 11 | Packaging | 408 | link | a.card | # | **YES** |
| 12 | Identity | 409 | link | a.card | # | **YES** |
| 13 | Web | 410 | link | a.card | # | **YES** |
| 14 | Identity | 411 | link | a.card | # | **YES** |
| 15 | Web | 412 | link | a.card | # | **YES** |
| 16 | Honorable-Mention | 420 | link | a.h | # | **YES** |
| 17 | Website-of-the-Day | 421 | link | a.h | # | **YES** |
| 18 | Site-of-the-Day | 422 | link | a.h | # | **YES** |
| 19 | Typography-Annual | 423 | link | a.h | # | **YES** |
| 20 | Noted | 424 | link | a.h | # | **YES** |
| 21 | Certificate | 425 | link | a.h | # | **YES** |
| 22 | Wood-Pencil | 426 | link | a.h | # | **YES** |
| 23 | Honoree | 427 | link | a.h | # | **YES** |
| 24 | unnamed | 537 | link | a | # | **YES** |
| 25 | unnamed | 538 | link | a | # | **YES** |
| 26 | unnamed | 539 | link | a | # | **YES** |
| 27 | unnamed | 540 | link | a | # | **YES** |
| 28 | unnamed | 541 | link | a | # | **YES** |
| 29 | unnamed | 542 | link | a | # | **YES** |
| 30 | unnamed | 543 | link | a | # | **YES** |
| 31 | unnamed | 544 | link | a | # | **YES** |
| 32 | unnamed | 547 | link | a | # | **YES** |
| 33 | unnamed | 548 | link | a | # | **YES** |

---

### grit-pictures.html

**Model:** minimax-m3-high | **File size:** 30,504 bytes | **Total elements:** 4 | **Unwired:** 4 (links=3, btns=1, forms=0)

**CDN scripts:** https://cdn.tailwindcss.com

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 288 | button | button.menu | UNWIRED | **YES** |
| 2 | Instagram | 616 | link | a | # | **YES** |
| 3 | Vimeo | 616 | link | a | # | **YES** |
| 4 | unnamed | 616 | link | a | # | **YES** |

---

### hnine-interaction.html

**Model:** minimax-m3-high | **File size:** 24,333 bytes | **Total elements:** 7 | **Unwired:** 7 (links=7, btns=0, forms=0)

**CDN scripts:** https://cdn.tailwindcss.com

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 157 | link | a.on | # | **YES** |
| 2 | unnamed | 158 | link | a | # | **YES** |
| 3 | unnamed | 159 | link | a | # | **YES** |
| 4 | unnamed | 162 | link | a | # | **YES** |
| 5 | unnamed | 163 | link | a | # | **YES** |
| 6 | unnamed | 164 | link | a.profile | # | **YES** |
| 7 | unnamed | 173 | link | a.copy-link | # | **YES** |

---

### jensbosman-nl.html

**Model:** minimax-m3-high | **File size:** 24,444 bytes | **Total elements:** 30 | **Unwired:** 16 (links=10, btns=6, forms=0)

**CDN scripts:** https://cdn.tailwindcss.com, https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js, https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 164 | link | a.text-[13px] | # | **YES** |
| 2 | unnamed | 166 | link | a | #work |  |
| 3 | unnamed | 167 | link | a | #brands |  |
| 4 | unnamed | 168 | link | a | #about |  |
| 5 | menuBtn | 171 | button | button#menuBtn | UNWIRED | **YES** |
| 6 | unnamed | 180 | link | a.block | # | **YES** |
| 7 | unnamed | 181 | link | a.block | #brands |  |
| 8 | unnamed | 182 | link | a.block | #about |  |
| 9 | unnamed | 183 | link | a.block | #contact |  |
| 10 | unnamed | 244 | link | a.block-link | #work |  |
| 11 | unnamed | 245 | link | a.block-link | #about |  |
| 12 | unnamed | 255 | link | a | # | **YES** |
| 13 | unnamed | 287 | button | button.active | UNWIRED | **YES** |
| 14 | unnamed | 288 | button | button | UNWIRED | **YES** |
| 15 | unnamed | 289 | button | button | UNWIRED | **YES** |
| 16 | unnamed | 290 | button | button | UNWIRED | **YES** |
| 17 | unnamed | 291 | button | button | UNWIRED | **YES** |
| 18 | unnamed | 315 | link | a | # | **YES** |
| 19 | unnamed | 342 | link | a.text-2xl | mailto:mail@jensbosman.example |  |
| 20 | unnamed | 346 | link | a.text-2xl | tel:+31600000000 |  |
| 21 | unnamed | 357 | link | a | # | **YES** |
| 22 | unnamed | 358 | link | a | # | **YES** |
| 23 | unnamed | 359 | link | a | # | **YES** |
| 24 | unnamed | 373 | link | a.block | #work |  |
| 25 | unnamed | 374 | link | a.block | #brands |  |
| 26 | unnamed | 375 | link | a.block | #about |  |
| 27 | unnamed | 376 | link | a.block | #contact |  |
| 28 | unnamed | 380 | link | a.block | # | **YES** |
| 29 | unnamed | 381 | link | a.block | # | **YES** |
| 30 | unnamed | 382 | link | a.block | # | **YES** |

---

### jordan-delcros.html

**Model:** minimax-m3-high | **File size:** 17,748 bytes | **Total elements:** 1 | **Unwired:** 1 (links=1, btns=0, forms=0)

**CDN scripts:** https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js, https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 144 | link | a.linkedin | # | **YES** |

---

### joseph-san.html

**Model:** minimax-m3-high | **File size:** 37,014 bytes | **Total elements:** 25 | **Unwired:** 25 (links=19, btns=6, forms=0)

**CDN scripts:** https://cdn.tailwindcss.com, https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 302 | link | a.mark | # | **YES** |
| 2 | btn-works | 304 | button | button#btn-works | UNWIRED | **YES** |
| 3 | btn-tgn | 305 | button | button#btn-tgn | UNWIRED | **YES** |
| 4 | btn-contact | 306 | button | button#btn-contact | UNWIRED | **YES** |
| 5 | openWorks | 371 | button | button#openWorks | UNWIRED | **YES** |
| 6 | WhatsApp | 380 | link | a | # | **YES** |
| 7 | LinkedIn | 380 | link | a | # | **YES** |
| 8 | unnamed | 380 | link | a | # | **YES** |
| 9 | Codrops | 381 | link | a | # | **YES** |
| 10 | Codepen | 381 | link | a | # | **YES** |
| 11 | unnamed | 381 | link | a | # | **YES** |
| 12 | Xcom | 382 | link | a | # | **YES** |
| 13 | Dribbble | 382 | link | a | # | **YES** |
| 14 | unnamed | 382 | link | a | # | **YES** |
| 15 | close-works | 401 | button | button#close-works | UNWIRED | **YES** |
| 16 | WhatsApp | 418 | link | a | # | **YES** |
| 17 | LinkedIn | 418 | link | a | # | **YES** |
| 18 | unnamed | 418 | link | a | # | **YES** |
| 19 | Codrops | 419 | link | a | # | **YES** |
| 20 | Codepen | 419 | link | a | # | **YES** |
| 21 | unnamed | 419 | link | a | # | **YES** |
| 22 | Xcom | 420 | link | a | # | **YES** |
| 23 | Dribbble | 420 | link | a | # | **YES** |
| 24 | unnamed | 420 | link | a | # | **YES** |
| 25 | close-contact | 422 | button | button#close-contact | UNWIRED | **YES** |

---

### karim-saab.html

**Model:** minimax-m3-high | **File size:** 19,130 bytes | **Total elements:** 13 | **Unwired:** 13 (links=13, btns=0, forms=0)

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 233 | link | a.pill | # | **YES** |
| 2 | unnamed | 234 | link | a.pill | # | **YES** |
| 3 | unnamed | 235 | link | a.pill | # | **YES** |
| 4 | unnamed | 236 | link | a.pill | # | **YES** |
| 5 | unnamed | 314 | link | a.cta | # | **YES** |
| 6 | unnamed | 322 | link | a.cta | # | **YES** |
| 7 | unnamed | 339 | link | a | # | **YES** |
| 8 | unnamed | 347 | link | a.head | # | **YES** |
| 9 | unnamed | 350 | link | a.head | # | **YES** |
| 10 | unnamed | 353 | link | a.head | # | **YES** |
| 11 | SITEMAP | 357 | link | a | # | **YES** |
| 12 | unnamed | 357 | link | a | # | **YES** |
| 13 | unnamed | 359 | link | a | # | **YES** |

---

### karocrafts.html

**Model:** minimax-m3-high | **File size:** 20,730 bytes | **Total elements:** 13 | **Unwired:** 13 (links=13, btns=0, forms=0)

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 356 | link | a.brand | # | **YES** |
| 2 | unnamed | 371 | link | a.pill | # | **YES** |
| 3 | unnamed | 377 | link | a.pill | # | **YES** |
| 4 | unnamed | 383 | link | a.pill | # | **YES** |
| 5 | unnamed | 391 | link | a.pill | # | **YES** |
| 6 | unnamed | 395 | link | a.pill | # | **YES** |
| 7 | unnamed | 426 | link | a.shop-pill | # | **YES** |
| 8 | unnamed | 466 | link | a.pill2 | # | **YES** |
| 9 | unnamed | 485 | link | a.pill2 | # | **YES** |
| 10 | unnamed | 496 | link | a.view-pill | # | **YES** |
| 11 | unnamed | 503 | link | a | # | **YES** |
| 12 | unnamed | 504 | link | a | # | **YES** |
| 13 | unnamed | 505 | link | a | # | **YES** |

---

### laxspace.html

**Model:** minimax-m3-high | **File size:** 28,209 bytes | **Total elements:** 1 | **Unwired:** 1 (links=1, btns=0, forms=0)

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 337 | link | a.logo | # | **YES** |

---

### leoleo-studio.html

**Model:** minimax-m3-high | **File size:** 20,059 bytes | **Total elements:** 9 | **Unwired:** 3 (links=2, btns=1, forms=0)

**CDN scripts:** https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js, https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 255 | link | a | #work |  |
| 2 | unnamed | 256 | link | a | #services |  |
| 3 | unnamed | 257 | link | a | #about |  |
| 4 | unnamed | 258 | link | a.contact | #contact |  |
| 5 | unnamed | 378 | link | a | mailto:hello@leoleo.studio |  |
| 6 | unnamed | 380 | link | a | mailto:job@leoleo.studio |  |
| 7 | unnamed | 384 | link | a | # | **YES** |
| 8 | unnamed | 385 | link | a | # | **YES** |
| 9 | unnamed | 390 | button | button.on | UNWIRED | **YES** |

---

### letude-group.html

**Model:** minimax-m3-high | **File size:** 28,784 bytes | **Total elements:** 6 | **Unwired:** 6 (links=6, btns=0, forms=0)

**CDN scripts:** https://cdn.tailwindcss.com

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 438 | link | a.rsvp | # | **YES** |
| 2 | unnamed | 606 | link | a | # | **YES** |
| 3 | unnamed | 607 | link | a | # | **YES** |
| 4 | unnamed | 608 | link | a | # | **YES** |
| 5 | unnamed | 609 | link | a | # | **YES** |
| 6 | unnamed | 610 | link | a | # | **YES** |

---

### lisovskiy-work.html

**Model:** minimax-m3-high | **File size:** 27,117 bytes | **Total elements:** 67 | **Unwired:** 46 (links=45, btns=1, forms=0)

**CDN scripts:** https://cdn.tailwindcss.com, https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 204 | button | button.menu-button | UNWIRED | **YES** |
| 2 | unnamed | 205 | link | a.more-link | #about |  |
| 3 | F--2018 | 221 | link | a.tile | NO_HREF |  |
| 4 | Project-A | 222 | link | a.tile | NO_HREF |  |
| 5 | Project-B | 223 | link | a.tile | NO_HREF |  |
| 6 | Project-C | 226 | link | a.tile | NO_HREF |  |
| 7 | Project-D | 227 | link | a.tile | NO_HREF |  |
| 8 | Project-E | 230 | link | a.tile | NO_HREF |  |
| 9 | Project-F | 233 | link | a.tile | NO_HREF |  |
| 10 | Project-G | 234 | link | a.tile | NO_HREF |  |
| 11 | Project-H | 237 | link | a.tile | NO_HREF |  |
| 12 | Project-I | 238 | link | a.tile | NO_HREF |  |
| 13 | Project-J | 239 | link | a.tile | NO_HREF |  |
| 14 | Project-K | 242 | link | a.tile | NO_HREF |  |
| 15 | Project-L | 245 | link | a.tile | NO_HREF |  |
| 16 | Project-M | 246 | link | a.tile | NO_HREF |  |
| 17 | Project-N | 247 | link | a.tile | NO_HREF |  |
| 18 | Project-O | 250 | link | a.tile | NO_HREF |  |
| 19 | Project-P | 251 | link | a.tile | NO_HREF |  |
| 20 | Project-Q | 252 | link | a.tile | NO_HREF |  |
| 21 | Project-R | 253 | link | a.tile | NO_HREF |  |
| 22 | Project-S | 254 | link | a.tile | NO_HREF |  |
| 23 | Music-Videos-I-Like | 323 | link | a.all-row | # | **YES** |
| 24 | Wendy-Andrade | 324 | link | a.all-row | # | **YES** |
| 25 | Manychat-careers | 325 | link | a.all-row | # | **YES** |
| 26 | Polkaswap | 326 | link | a.all-row | # | **YES** |
| 27 | Fearless-wallet | 327 | link | a.all-row | # | **YES** |
| 28 | Polecat-Agency | 328 | link | a.all-row | # | **YES** |
| 29 | Elena-Borisova | 329 | link | a.all-row | # | **YES** |
| 30 | SORA-Card | 330 | link | a.all-row | # | **YES** |
| 31 | Style-Reptile-Figma-plugin | 331 | link | a.all-row | # | **YES** |
| 32 | Fraud-Intelligence-Limited | 332 | link | a.all-row | # | **YES** |
| 33 | SORA | 333 | link | a.all-row | # | **YES** |
| 34 | Sekelyk-amp-Partners-Law-Burea | 334 | link | a.all-row | # | **YES** |
| 35 | Manychat-websites | 335 | link | a.all-row | # | **YES** |
| 36 | Personal-page | 336 | link | a.all-row | # | **YES** |
| 37 | Instagram-summit-2022 | 337 | link | a.all-row | # | **YES** |
| 38 | Recycling-guide | 338 | link | a.all-row | # | **YES** |
| 39 | Get-a-topic | 339 | link | a.all-row | # | **YES** |
| 40 | Burn-the-tickets-game | 340 | link | a.all-row | # | **YES** |
| 41 | Big-traffic-rules-exam | 341 | link | a.all-row | # | **YES** |
| 42 | 98-agency | 342 | link | a.all-row | # | **YES** |
| 43 | Ovvverrrflowww-Figma-plugin | 343 | link | a.all-row | # | **YES** |
| 44 | 20-stories-of-2020-Yandex-Taxi | 344 | link | a.all-row | # | **YES** |
| 45 | Manymoji | 345 | link | a.all-row | # | **YES** |
| 46 | Manychat-contributor | 346 | link | a.all-row | # | **YES** |
| 47 | Manychat-banners | 347 | link | a.all-row | # | **YES** |
| 48 | Pro-40 | 348 | link | a.all-row | # | **YES** |
| 49 | NWPC | 349 | link | a.all-row | # | **YES** |
| 50 | Norkpalm | 350 | link | a.all-row | # | **YES** |
| 51 | Megafon-big-data | 351 | link | a.all-row | # | **YES** |
| 52 | Kerama-Marazzi | 352 | link | a.all-row | # | **YES** |
| 53 | S7-presents-A320neo | 353 | link | a.all-row | # | **YES** |
| 54 | Mercury-tower | 354 | link | a.all-row | # | **YES** |
| 55 | Akron | 355 | link | a.all-row | # | **YES** |
| 56 | Acron | 356 | link | a.all-row | # | **YES** |
| 57 | S7-inspired-by-you | 357 | link | a.all-row | # | **YES** |
| 58 | Progroup | 358 | link | a.all-row | # | **YES** |
| 59 | OKO | 359 | link | a.all-row | # | **YES** |
| 60 | Legis | 360 | link | a.all-row | # | **YES** |
| 61 | Kia-happiness | 361 | link | a.all-row | # | **YES** |
| 62 | Otkritie | 362 | link | a.all-row | # | **YES** |
| 63 | Marussia-motors | 363 | link | a.all-row | # | **YES** |
| 64 | unnamed | 368 | link | a | # | **YES** |
| 65 | unnamed | 369 | link | a | # | **YES** |
| 66 | unnamed | 370 | link | a | # | **YES** |
| 67 | unnamed | 371 | link | a | # | **YES** |

---

### madebynull.html

**Model:** minimax-m3-high | **File size:** 31,499 bytes | **Total elements:** 30 | **Unwired:** 25 (links=15, btns=10, forms=0)

**CDN scripts:** https://cdn.tailwindcss.com, https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | enterBtn | 239 | button | button#enterBtn | UNWIRED | **YES** |
| 2 | unnamed | 254 | link | a.font-serif-display | # | **YES** |
| 3 | unnamed | 256 | link | a | #studio |  |
| 4 | unnamed | 257 | link | a | #work |  |
| 5 | unnamed | 258 | link | a | #contact |  |
| 6 | unnamed | 326 | button | button | UNWIRED | **YES** |
| 7 | unnamed | 335 | button | button | UNWIRED | **YES** |
| 8 | unnamed | 344 | button | button | UNWIRED | **YES** |
| 9 | unnamed | 353 | button | button | UNWIRED | **YES** |
| 10 | unnamed | 360 | button | button | UNWIRED | **YES** |
| 11 | unnamed | 380 | button | button | UNWIRED | **YES** |
| 12 | unnamed | 381 | button | button | UNWIRED | **YES** |
| 13 | unnamed | 382 | button | button | UNWIRED | **YES** |
| 14 | unnamed | 383 | button | button | UNWIRED | **YES** |
| 15 | unnamed | 394 | link | a.underline | mailto:hello@madebynull.example |  |
| 16 | unnamed | 411 | link | a | # | **YES** |
| 17 | unnamed | 412 | link | a | # | **YES** |
| 18 | unnamed | 413 | link | a | # | **YES** |
| 19 | unnamed | 414 | link | a | # | **YES** |
| 20 | unnamed | 418 | link | a | # | **YES** |
| 21 | unnamed | 419 | link | a | # | **YES** |
| 22 | unnamed | 420 | link | a | # | **YES** |
| 23 | unnamed | 424 | link | a | mailto:hello@madebynull.example |  |
| 24 | unnamed | 425 | link | a | # | **YES** |
| 25 | unnamed | 426 | link | a | # | **YES** |
| 26 | unnamed | 427 | link | a | # | **YES** |
| 27 | unnamed | 431 | link | a | # | **YES** |
| 28 | unnamed | 432 | link | a | # | **YES** |
| 29 | unnamed | 433 | link | a | # | **YES** |
| 30 | unnamed | 434 | link | a | # | **YES** |

---

### madeinux-miux.html

**Model:** minimax-m3-high | **File size:** 20,911 bytes | **Total elements:** 18 | **Unwired:** 8 (links=8, btns=0, forms=0)

**CDN scripts:** https://cdn.tailwindcss.com, https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js, https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | Projects-11 | 179 | link | a | #projects |  |
| 2 | Work-with-us | 180 | link | a | # | **YES** |
| 3 | Meet-MIUX | 181 | link | a | #about |  |
| 4 | Read-more | 182 | link | a | #feedback |  |
| 5 | Get-in-touch | 183 | link | a | #contact |  |
| 6 | unnamed | 211 | link | a | # | **YES** |
| 7 | unnamed | 212 | link | a | # | **YES** |
| 8 | Start-a-project | 271 | link | a.btn | mailto:hi@miux.example |  |
| 9 | unnamed | 279 | link | a | # | **YES** |
| 10 | unnamed | 280 | link | a | # | **YES** |
| 11 | unnamed | 281 | link | a | #about |  |
| 12 | unnamed | 282 | link | a | #feedback |  |
| 13 | unnamed | 283 | link | a | #contact |  |
| 14 | unnamed | 289 | link | a | mailto:info@madeinux.example |  |
| 15 | input-294 | 294 | input:email | input | email input | - |
| 16 | unnamed | 300 | link | a | # | **YES** |
| 17 | unnamed | 301 | link | a | # | **YES** |
| 18 | unnamed | 305 | link | a | # | **YES** |

---

### mikkisindhunata.html

**Model:** minimax-m3-high | **File size:** 33,067 bytes | **Total elements:** 27 | **Unwired:** 23 (links=14, btns=9, forms=0)

**CDN scripts:** https://cdn.tailwindcss.com

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 255 | button | button.pill | UNWIRED | **YES** |
| 2 | unnamed | 256 | button | button.pill | UNWIRED | **YES** |
| 3 | unnamed | 257 | button | button.pill | UNWIRED | **YES** |
| 4 | unnamed | 261 | button | button.pill | UNWIRED | **YES** |
| 5 | unnamed | 262 | button | button.pill | UNWIRED | **YES** |
| 6 | unnamed | 285 | link | a.readmore | # | **YES** |
| 7 | playBtn | 287 | button | button#playBtn | UNWIRED | **YES** |
| 8 | prevBtn | 292 | button | button#prevBtn | UNWIRED | **YES** |
| 9 | nextBtn | 293 | button | button#nextBtn | UNWIRED | **YES** |
| 10 | unnamed | 309 | link | a | # | **YES** |
| 11 | unnamed | 312 | link | a | # | **YES** |
| 12 | unnamed | 347 | link | a.pill | #archive |  |
| 13 | unnamed | 353 | link | a | # | **YES** |
| 14 | unnamed | 356 | link | a | # | **YES** |
| 15 | unnamed | 367 | link | a | #contact |  |
| 16 | unnamed | 380 | link | a | # | **YES** |
| 17 | unnamed | 383 | link | a | # | **YES** |
| 18 | unnamed | 405 | link | a | # | **YES** |
| 19 | unnamed | 408 | link | a | # | **YES** |
| 20 | unnamed | 419 | link | a.phone | tel:+31629603818 |  |
| 21 | unnamed | 420 | link | a.email | mailto:mikki.sindhunata@example.com |  |
| 22 | unnamed | 428 | link | a | # | **YES** |
| 23 | unnamed | 429 | link | a | # | **YES** |
| 24 | unnamed | 430 | link | a | # | **YES** |
| 25 | unnamed | 437 | link | a | # | **YES** |
| 26 | unnamed | 440 | link | a | # | **YES** |
| 27 | consentClose | 446 | button | button#consentClose | UNWIRED | **YES** |

---

### nuageboi-hugobaron.html

**Model:** minimax-m3-high | **File size:** 20,587 bytes | **Total elements:** 6 | **Unwired:** 6 (links=3, btns=3, forms=0)

**CDN scripts:** https://cdn.tailwindcss.com, https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js, https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 208 | button | button.pill | UNWIRED | **YES** |
| 2 | unnamed | 268 | button | button.nav-btn | UNWIRED | **YES** |
| 3 | unnamed | 269 | button | button.nav-btn | UNWIRED | **YES** |
| 4 | unnamed | 279 | link | a.pill | # | **YES** |
| 5 | unnamed | 339 | link | a.pill | # | **YES** |
| 6 | unnamed | 347 | link | a | # | **YES** |

---

### olha-lazarieva.html

**Model:** minimax-m3-high | **File size:** 24,172 bytes | **Total elements:** 13 | **Unwired:** 5 (links=3, btns=1, forms=1)

**CDN scripts:** https://cdn.tailwindcss.com

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 384 | link | a | #about |  |
| 2 | unnamed | 385 | link | a | #works |  |
| 3 | unnamed | 386 | link | a | #services |  |
| 4 | unnamed | 387 | link | a | #connect |  |
| 5 | CONTACT-ME | 389 | link | a.contact | #connect |  |
| 6 | form-468 | 468 | form | form | GET NO_ACTION | **YES** |
| 7 | input-469 | 469 | input:text | input | text input | - |
| 8 | input-470 | 470 | input:tel | input | tel input | - |
| 9 | input-471 | 471 | input:email | input | email input | - |
| 10 | unnamed | 481 | button | button.cta | UNWIRED | **YES** |
| 11 | INSTAGRAM | 487 | link | a | # | **YES** |
| 12 | BEHANCE | 487 | link | a | # | **YES** |
| 13 | unnamed | 487 | link | a | # | **YES** |

---

### orage-studio.html

**Model:** minimax-m3-high | **File size:** 38,654 bytes | **Total elements:** 14 | **Unwired:** 14 (links=14, btns=0, forms=0)

**CDN scripts:** https://cdn.tailwindcss.com, https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 276 | link | a.header-logo | # | **YES** |
| 2 | unnamed | 312 | link | a | # | **YES** |
| 3 | unnamed | 313 | link | a | # | **YES** |
| 4 | unnamed | 314 | link | a | # | **YES** |
| 5 | unnamed | 315 | link | a | # | **YES** |
| 6 | unnamed | 316 | link | a | # | **YES** |
| 7 | unnamed | 386 | link | a.link | # | **YES** |
| 8 | unnamed | 387 | link | a.link | # | **YES** |
| 9 | JCOLE__THE_FALL_OF_IS_INEVITAB | 398 | link | a.card | # | **YES** |
| 10 | ADIDAS_CHOOSE_ONE | 399 | link | a.card | # | **YES** |
| 11 | SAMSUNG_GALAXY_RING | 400 | link | a.card | # | **YES** |
| 12 | DRIES_VAN_NOTEN_SS26 | 401 | link | a.card | # | **YES** |
| 13 | YVES_SAINT_LAURENT | 402 | link | a.card | # | **YES** |
| 14 | CARTIER_NATUREL | 403 | link | a.card | # | **YES** |

---

### phantom-studios.html

**Model:** minimax-m3-high | **File size:** 18,724 bytes | **Total elements:** 9 | **Unwired:** 9 (links=2, btns=7, forms=0)

**CDN scripts:** https://cdn.tailwindcss.com, https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js, https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 170 | link | a.logo | # | **YES** |
| 2 | unnamed | 194 | button | button.talk | UNWIRED | **YES** |
| 3 | unnamed | 221 | button | button.tab | UNWIRED | **YES** |
| 4 | unnamed | 222 | button | button.tab | UNWIRED | **YES** |
| 5 | unnamed | 223 | button | button.tab | UNWIRED | **YES** |
| 6 | unnamed | 228 | button | button.pill | UNWIRED | **YES** |
| 7 | unnamed | 233 | link | a | # | **YES** |
| 8 | acceptBtn | 235 | button | button#acceptBtn | UNWIRED | **YES** |
| 9 | declineBtn | 236 | button | button#declineBtn | UNWIRED | **YES** |

---

### portalone-studio.html

**Model:** minimax-m3-high | **File size:** 41,705 bytes | **Total elements:** 15 | **Unwired:** 10 (links=10, btns=0, forms=0)

**CDN scripts:** https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js, https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js

**TODOs:** xxxxxxxxxxxx, xxLIKE YOURS STEP INTO THE

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 451 | link | a.nav-link | #studio |  |
| 2 | unnamed | 452 | link | a.nav-link | #works |  |
| 3 | unnamed | 453 | link | a.nav-link | #contact |  |
| 4 | unnamed | 455 | link | a | # | **YES** |
| 5 | unnamed | 456 | link | a | # | **YES** |
| 6 | unnamed | 457 | link | a | # | **YES** |
| 7 | unnamed | 459 | link | a.pill | #services |  |
| 8 | unnamed | 571 | link | a | # | **YES** |
| 9 | unnamed | 608 | link | a.learn | #works |  |
| 10 | nbsp--nbsp | 705 | link | a | # | **YES** |
| 11 | unnamed | 705 | link | a | # | **YES** |
| 12 | unnamed | 719 | link | a | # | **YES** |
| 13 | unnamed | 725 | link | a | # | **YES** |
| 14 | accept-btn | 726 | link | a#accept-btn | # | **YES** |
| 15 | unnamed | 728 | link | a | # | **YES** |

---

### ragged-edge.html

**Model:** minimax-m3-high | **File size:** 23,281 bytes | **Total elements:** 23 | **Unwired:** 7 (links=7, btns=0, forms=0)

**CDN scripts:** https://cdn.tailwindcss.com

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 313 | link | a.pill | #home |  |
| 2 | unnamed | 314 | link | a.pill | #partners |  |
| 3 | unnamed | 315 | link | a.pill | #approach |  |
| 4 | unnamed | 316 | link | a.pill | #happenings |  |
| 5 | unnamed | 319 | link | a.pill | #join |  |
| 6 | unnamed | 320 | link | a.pill | #contact |  |
| 7 | unnamed | 457 | link | a.pill | #join |  |
| 8 | unnamed | 459 | link | a.pill | # | **YES** |
| 9 | unnamed | 460 | link | a.pill | # | **YES** |
| 10 | unnamed | 466 | link | a | #home |  |
| 11 | unnamed | 467 | link | a | #partners |  |
| 12 | unnamed | 468 | link | a | #approach |  |
| 13 | unnamed | 469 | link | a | #happenings |  |
| 14 | unnamed | 470 | link | a | #join |  |
| 15 | unnamed | 471 | link | a | #contact |  |
| 16 | unnamed | 474 | link | a | # | **YES** |
| 17 | unnamed | 475 | link | a | # | **YES** |
| 18 | unnamed | 476 | link | a | # | **YES** |
| 19 | unnamed | 477 | link | a | # | **YES** |
| 20 | unnamed | 488 | button | button | document.getElementById( |  |
| 21 | unnamed | 491 | link | a.show | # | **YES** |
| 22 | unnamed | 492 | button | button.reject | document.getElementById( |  |
| 23 | unnamed | 493 | button | button.accept | document.getElementById( |  |

---

### reform-collective.html

**Model:** minimax-m3-high | **File size:** 25,478 bytes | **Total elements:** 23 | **Unwired:** 22 (links=22, btns=0, forms=0)

**CDN scripts:** https://cdn.tailwindcss.com, https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js, https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 176 | link | a.logo | # | **YES** |
| 2 | unnamed | 178 | button | button.menu-btn | this.querySelector( |  |
| 3 | unnamed | 195 | link | a.featured-card | # | **YES** |
| 4 | unnamed | 215 | link | a.featured-card | # | **YES** |
| 5 | unnamed | 235 | link | a.featured-card | # | **YES** |
| 6 | unnamed | 258 | link | a.featured-card | # | **YES** |
| 7 | unnamed | 279 | link | a.featured-card | # | **YES** |
| 8 | unnamed | 302 | link | a | # | **YES** |
| 9 | unnamed | 407 | link | a.big | # | **YES** |
| 10 | unnamed | 408 | link | a.big | # | **YES** |
| 11 | About-Us | 410 | link | a | # | **YES** |
| 12 | Reform-Nova | 410 | link | a | # | **YES** |
| 13 | unnamed | 410 | link | a | # | **YES** |
| 14 | Careers | 411 | link | a | # | **YES** |
| 15 | unnamed | 411 | link | a | # | **YES** |
| 16 | Instagram | 413 | link | a | # | **YES** |
| 17 | Awwwards | 413 | link | a | # | **YES** |
| 18 | X | 413 | link | a | # | **YES** |
| 19 | Dribbble | 413 | link | a | # | **YES** |
| 20 | unnamed | 413 | link | a | # | **YES** |
| 21 | unnamed | 418 | link | a | # | **YES** |
| 22 | unnamed | 420 | link | a | # | **YES** |
| 23 | unnamed | 421 | link | a | # | **YES** |

---

### robot-tv.html

**Model:** minimax-m3-high | **File size:** 27,831 bytes | **Total elements:** 13 | **Unwired:** 8 (links=8, btns=0, forms=0)

**CDN scripts:** https://cdn.tailwindcss.com

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 443 | link | a.bracket | #directors |  |
| 2 | unnamed | 473 | link | a.red-link | #about |  |
| 3 | unnamed | 481 | link | a.red-link | #directors |  |
| 4 | unnamed | 578 | link | a | mailto:liam@therobot.tv |  |
| 5 | unnamed | 579 | link | a | tel:+27715642286 |  |
| 6 | unnamed | 587 | link | a | # | **YES** |
| 7 | unnamed | 588 | link | a | # | **YES** |
| 8 | unnamed | 589 | link | a | # | **YES** |
| 9 | unnamed | 590 | link | a | # | **YES** |
| 10 | unnamed | 594 | link | a | # | **YES** |
| 11 | unnamed | 595 | link | a | # | **YES** |
| 12 | unnamed | 596 | link | a | # | **YES** |
| 13 | unnamed | 597 | link | a | # | **YES** |

---

### samsy-ninja.html

**Model:** minimax-m3-high | **File size:** 26,364 bytes | **Total elements:** 3 | **Unwired:** 3 (links=3, btns=0, forms=0)

**CDN scripts:** https://cdn.tailwindcss.com

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 558 | link | a | # | **YES** |
| 2 | unnamed | 559 | link | a | # | **YES** |
| 3 | unnamed | 560 | link | a | # | **YES** |

---

### stiff-films.html

**Model:** minimax-m3-high | **File size:** 29,099 bytes | **Total elements:** 22 | **Unwired:** 17 (links=17, btns=0, forms=0)

**CDN scripts:** https://cdn.tailwindcss.com

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 226 | link | a.logo | # | **YES** |
| 2 | unnamed | 234 | link | a | #work |  |
| 3 | unnamed | 235 | link | a | #news |  |
| 4 | unnamed | 236 | link | a | #about |  |
| 5 | unnamed | 237 | link | a | #capabilities |  |
| 6 | unnamed | 238 | link | a | #contact |  |
| 7 | unnamed | 309 | link | a.card | # | **YES** |
| 8 | unnamed | 314 | link | a.card | # | **YES** |
| 9 | unnamed | 319 | link | a.card | # | **YES** |
| 10 | unnamed | 324 | link | a.card | # | **YES** |
| 11 | unnamed | 329 | link | a.card | # | **YES** |
| 12 | unnamed | 334 | link | a.view-all | # | **YES** |
| 13 | Indeed | 388 | link | a.item | # | **YES** |
| 14 | EdJones | 389 | link | a.item | # | **YES** |
| 15 | EQBank | 390 | link | a.item | # | **YES** |
| 16 | GreenBall | 391 | link | a.item | # | **YES** |
| 17 | LBB | 392 | link | a.item | # | **YES** |
| 18 | Side | 393 | link | a.item | # | **YES** |
| 19 | unnamed | 408 | link | a | # | **YES** |
| 20 | unnamed | 409 | link | a | # | **YES** |
| 21 | unnamed | 410 | link | a | # | **YES** |
| 22 | unnamed | 411 | link | a | # | **YES** |

---

### studioherrstrom.html

**Model:** minimax-m3-high | **File size:** 19,539 bytes | **Total elements:** 25 | **Unwired:** 14 (links=14, btns=0, forms=0)

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 234 | link | a | #process |  |
| 2 | unnamed | 235 | link | a | #work |  |
| 3 | unnamed | 236 | link | a | # | **YES** |
| 4 | unnamed | 237 | link | a | #about |  |
| 5 | unnamed | 238 | link | a | #contact |  |
| 6 | unnamed | 248 | link | a.cell | NO_HREF |  |
| 7 | unnamed | 252 | link | a.cell | NO_HREF |  |
| 8 | unnamed | 259 | link | a.cell | NO_HREF |  |
| 9 | unnamed | 262 | link | a.cell | NO_HREF |  |
| 10 | unnamed | 278 | link | a | # | **YES** |
| 11 | unnamed | 308 | link | a | # | **YES** |
| 12 | unnamed | 322 | link | a | # | **YES** |
| 13 | unnamed | 327 | link | a | # | **YES** |
| 14 | unnamed | 351 | link | a | # | **YES** |
| 15 | unnamed | 390 | link | a | # | **YES** |
| 16 | unnamed | 391 | link | a | # | **YES** |
| 17 | unnamed | 392 | link | a | # | **YES** |
| 18 | unnamed | 393 | link | a | # | **YES** |
| 19 | unnamed | 395 | link | a | # | **YES** |
| 20 | unnamed | 396 | link | a | # | **YES** |
| 21 | unnamed | 397 | link | a | # | **YES** |
| 22 | unnamed | 398 | link | a | # | **YES** |
| 23 | unnamed | 404 | link | a | mailto:newbiz@studioherrstrom.com |  |
| 24 | unnamed | 408 | link | a | mailto:kerstin@studioherrstrom.com |  |
| 25 | unnamed | 412 | link | a | mailto:hello@studioherrstrom.com |  |

---

### sunhung-net.html

**Model:** minimax-m3-high | **File size:** 21,569 bytes | **Total elements:** 14 | **Unwired:** 8 (links=8, btns=0, forms=0)

**CDN scripts:** https://cdn.tailwindcss.com, https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js, https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 155 | link | a | #about |  |
| 2 | unnamed | 156 | link | a | #about |  |
| 3 | unnamed | 160 | link | a.logo | # | **YES** |
| 4 | unnamed | 161 | link | a.menu-icon | # | **YES** |
| 5 | Explore-now | 231 | link | a.btn | # | **YES** |
| 6 | Explore-now | 243 | link | a.btn | # | **YES** |
| 7 | unnamed | 300 | link | a.btn | mailto:hi@sunhung.example |  |
| 8 | unnamed | 305 | link | a | #about |  |
| 9 | unnamed | 306 | link | a | #work |  |
| 10 | unnamed | 307 | link | a | # | **YES** |
| 11 | unnamed | 308 | link | a | mailto:hi@sunhung.example |  |
| 12 | unnamed | 312 | link | a | # | **YES** |
| 13 | unnamed | 313 | link | a | # | **YES** |
| 14 | unnamed | 314 | link | a | # | **YES** |

---

### supersolid-agency.html

**Model:** minimax-m3-high | **File size:** 18,320 bytes | **Total elements:** 23 | **Unwired:** 18 (links=16, btns=2, forms=0)

**CDN scripts:** https://cdn.tailwindcss.com, https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js, https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 145 | link | a.logo | # | **YES** |
| 2 | unnamed | 148 | link | a | #work |  |
| 3 | unnamed | 149 | link | a | #about |  |
| 4 | unnamed | 150 | link | a | # | **YES** |
| 5 | unnamed | 151 | link | a.pill | # | **YES** |
| 6 | See-how-we-create-outcomes | 161 | link | a.cta | #work |  |
| 7 | View-all-work | 175 | link | a.cta | # | **YES** |
| 8 | unnamed | 231 | button | button | UNWIRED | **YES** |
| 9 | unnamed | 232 | button | button | UNWIRED | **YES** |
| 10 | Tell-us-about-your-challenge | 239 | link | a.pill | # | **YES** |
| 11 | unnamed | 249 | link | a.label | # | **YES** |
| 12 | unnamed | 250 | link | a | # | **YES** |
| 13 | unnamed | 251 | link | a | # | **YES** |
| 14 | unnamed | 252 | link | a | # | **YES** |
| 15 | unnamed | 253 | link | a | # | **YES** |
| 16 | unnamed | 259 | link | a.fade | # | **YES** |
| 17 | unnamed | 260 | link | a.fade | #work |  |
| 18 | unnamed | 261 | link | a.fade | #about |  |
| 19 | unnamed | 262 | link | a.fade | # | **YES** |
| 20 | unnamed | 263 | link | a.fade | # | **YES** |
| 21 | unnamed | 264 | link | a.fade | # | **YES** |
| 22 | unnamed | 270 | link | a.fade | # | **YES** |
| 23 | unnamed | 271 | link | a.fade | # | **YES** |

---

### t-ko-space.html

**Model:** minimax-m3-high | **File size:** 19,431 bytes | **Total elements:** 0 | **Unwired:** 0 (links=0, btns=0, forms=0)

**CDN scripts:** https://cdn.tailwindcss.com, https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js

*No interactive elements detected.*

### thingy-and-thingy.html

**Model:** minimax-m3-high | **File size:** 25,907 bytes | **Total elements:** 15 | **Unwired:** 5 (links=0, btns=5, forms=0)

**CDN scripts:** https://cdn.tailwindcss.com

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | prev | 455 | button | button#prev | UNWIRED | **YES** |
| 2 | next | 456 | button | button#next | UNWIRED | **YES** |
| 3 | quickBtn | 510 | button | button#quickBtn | UNWIRED | **YES** |
| 4 | navBtn | 511 | button | button#navBtn | UNWIRED | **YES** |
| 5 | navClose | 518 | button | button#navClose | UNWIRED | **YES** |
| 6 | 01 | 521 | link | a | #top |  |
| 7 | 02 | 522 | link | a |  |  |
| 8 | 03 | 523 | link | a |  |  |
| 9 | 04 | 524 | link | a |  |  |
| 10 | 05 | 525 | link | a |  |  |
| 11 | 06 | 526 | link | a |  |  |
| 12 | 07 | 527 | link | a |  |  |
| 13 | 08 | 528 | link | a |  |  |
| 14 | 09 | 529 | link | a |  |  |
| 15 | 10 | 530 | link | a |  |  |

---

### tux-co.html

**Model:** minimax-m3-high | **File size:** 24,828 bytes | **Total elements:** 12 | **Unwired:** 9 (links=9, btns=0, forms=0)

**CDN scripts:** https://cdn.tailwindcss.com

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 224 | link | a | #work |  |
| 2 | unnamed | 225 | link | a | #news |  |
| 3 | unnamed | 226 | link | a | #cta |  |
| 4 | unnamed | 318 | link | a | # | **YES** |
| 5 | unnamed | 321 | link | a.card | # | **YES** |
| 6 | unnamed | 329 | link | a.card | # | **YES** |
| 7 | unnamed | 337 | link | a.card | # | **YES** |
| 8 | unnamed | 352 | link | a | # | **YES** |
| 9 | unnamed | 355 | link | a.article | # | **YES** |
| 10 | unnamed | 364 | link | a.article | # | **YES** |
| 11 | unnamed | 373 | link | a.article | # | **YES** |
| 12 | unnamed | 382 | link | a.article | # | **YES** |

---

### twicetwice.html

**Model:** minimax-m3-high | **File size:** 15,154 bytes | **Total elements:** 5 | **Unwired:** 5 (links=5, btns=0, forms=0)

**CDN scripts:** https://cdn.tailwindcss.com

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 152 | link | a.logo | # | **YES** |
| 2 | unnamed | 154 | link | a | # | **YES** |
| 3 | unnamed | 155 | link | a | # | **YES** |
| 4 | unnamed | 156 | link | a | # | **YES** |
| 5 | unnamed | 158 | link | a | # | **YES** |

---

### weareexample.html

**Model:** minimax-m3-high | **File size:** 22,671 bytes | **Total elements:** 15 | **Unwired:** 12 (links=8, btns=2, forms=2)

**CDN scripts:** https://cdn.tailwindcss.com

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | unnamed | 178 | link | a.font-condensed | # | **YES** |
| 2 | unnamed | 180 | link | a | # | **YES** |
| 3 | unnamed | 181 | link | a | # | **YES** |
| 4 | unnamed | 182 | link | a | # | **YES** |
| 5 | unnamed | 184 | link | a.micro | mailto:hello@weareexample.com |  |
| 6 | form-338 | 338 | form | form.sub-form | GET NO_ACTION | **YES** |
| 7 | input-339 | 339 | input:email | input | email input | - |
| 8 | unnamed | 340 | button | button | UNWIRED | **YES** |
| 9 | unnamed | 399 | link | a.underline | # | **YES** |
| 10 | unnamed | 400 | link | a.underline | # | **YES** |
| 11 | unnamed | 401 | link | a.underline | # | **YES** |
| 12 | unnamed | 402 | link | a.underline | # | **YES** |
| 13 | form-408 | 408 | form | form.sub-form | GET NO_ACTION | **YES** |
| 14 | input-409 | 409 | input:email | input | email input | - |
| 15 | unnamed | 410 | button | button | UNWIRED | **YES** |

---

### wearestokt.html

**Model:** minimax-m3-high | **File size:** 36,809 bytes | **Total elements:** 22 | **Unwired:** 14 (links=14, btns=0, forms=0)

**CDN scripts:** https://cdn.tailwindcss.com, https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js

| # | ID | Line | Type | Selector | Declared Intent | Unwired? |
|---|-----|------|------|----------|-----------------|----------|
| 1 | STKT | 257 | link | a.brand | # | **YES** |
| 2 | unnamed | 259 | link | a | #work |  |
| 3 | unnamed | 260 | link | a | #services |  |
| 4 | unnamed | 261 | link | a | #about |  |
| 5 | unnamed | 262 | link | a | #motion |  |
| 6 | unnamed | 263 | link | a | # | **YES** |
| 7 | unnamed | 267 | link | a.cta | #cta |  |
| 8 | unnamed | 384 | link | a.btn | # | **YES** |
| 9 | unnamed | 431 | link | a.btn | # | **YES** |
| 10 | unnamed | 449 | link | a.btn | # | **YES** |
| 11 | unnamed | 450 | link | a.btn | # | **YES** |
| 12 | unnamed | 466 | link | a | #work |  |
| 13 | unnamed | 467 | link | a | #services |  |
| 14 | unnamed | 468 | link | a | #about |  |
| 15 | unnamed | 469 | link | a | # | **YES** |
| 16 | unnamed | 473 | link | a | # | **YES** |
| 17 | unnamed | 474 | link | a | # | **YES** |
| 18 | unnamed | 475 | link | a | # | **YES** |
| 19 | unnamed | 476 | link | a | # | **YES** |
| 20 | unnamed | 480 | link | a | # | **YES** |
| 21 | unnamed | 481 | link | a | # | **YES** |
| 22 | unnamed | 482 | link | a | # | **YES** |

---

### bruno-simon-portfolio.html

**Model:** minimax-m3-medium | **File size:** 25,540 bytes | **Total elements:** 0 | **Unwired:** 0 (links=0, btns=0, forms=0)

**CDN scripts:** https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js

*No interactive elements detected.*


## Cross-Sample Summary: Samples with Most Unwired Pathways

| Rank | File | Model | Unwired Total | Links | Buttons | Forms |
|------|------|-------|---------------|-------|---------|-------|
| 1 | lisovskiy-work.html | minimax-m3-high | 46 | 45 | 1 | 0 |
| 2 | generalcondition.html | minimax-m3-high | 27 | 27 | 0 | 0 |
| 3 | alche-studio.html | minimax-m2.7 | 26 | 21 | 5 | 0 |
| 4 | joseph-san.html | minimax-m3-high | 25 | 19 | 6 | 0 |
| 5 | madebynull.html | minimax-m3-high | 25 | 15 | 10 | 0 |
| 6 | bychudy.html | minimax-m3-high | 24 | 24 | 0 | 0 |
| 7 | doubleplay-studio.html | minimax-m3-high | 23 | 23 | 0 | 0 |
| 8 | mikkisindhunata.html | minimax-m3-high | 23 | 14 | 9 | 0 |
| 9 | reform-collective.html | minimax-m3-high | 22 | 22 | 0 | 0 |
| 10 | stokt.html | minimax-m2.7 | 19 | 18 | 1 | 0 |
| 11 | cappen.html | minimax-m3-high | 18 | 18 | 0 | 0 |
| 12 | supersolid-agency.html | minimax-m3-high | 18 | 16 | 2 | 0 |
| 13 | stiff-films.html | minimax-m3-high | 17 | 17 | 0 | 0 |
| 14 | jensbosman-nl.html | minimax-m3-high | 16 | 10 | 6 | 0 |
| 15 | brandappart.html | minimax-m2.7 | 15 | 15 | 0 | 0 |
