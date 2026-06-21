/**
 * @file Hand-authored fixtures for the element-library manifest.
 *
 *       Some categories — pricing, faq, divider — are thin in the
 *       `samples/minimax-m3-high/*.html` corpus (most are creative-agency
 *       portfolios, not SaaS marketing pages), so the auto-dissector in
 *       `dissect.mjs` cannot pull 6+ quality, distinct snippets per
 *       category from samples alone. Rather than fabricate noise or
 *       duplicate a single sample 8 times, this file ships a small set
 *       of carefully hand-crafted, self-contained, tasteful building
 *       blocks for those thin categories. The dissector picks them up
 *       by `import`-merging into the final manifest array.
 *
 *       Each fixture is shaped exactly like a dissected entry:
 *
 *         {
 *           id: string,         // unique across the whole manifest
 *           category: string,   // one of CATEGORIES in dissect.mjs
 *           name: string,       // human-readable label
 *           tags: string[],     // short tag set for filtering
 *           html: string,       // self-contained markup
 *           css: string,        // matching scoped CSS (may be empty)
 *           source: string,     // synthetic source label
 *         }
 *
 *       Self-containment contract:
 *         - Every CSS rule uses the `el-<id>-*` prefix on classes, so
 *           fixtures do not collide with other snippets or page chrome
 *           when dropped into the live-render iframe.
 *         - The same class-prefix appears in both `html` and `css`.
 *         - Inline styles are preferred for one-shot layout, scoped
 *           `<style>` is NOT used (the loader injects via `injectStyle`,
 *           which only handles class-scoped rules).
 *         - No JS, no external assets, no fetch calls. HTML + CSS only.
 *
 *       Source label convention:
 *         `fixture:<category>:<human-name>` — distinct from real sample
 *         filenames so tests / dashboards can tell them apart.
 */

const FIXTURE_SOURCE = (category, name) =>
  `fixture:${category}:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

// ---------------------------------------------------------------------------
// Pricing — 8 hand-authored variants
// ---------------------------------------------------------------------------

const pricing = [
  {
    id: 'fixture-pricing-3tier',
    category: 'pricing',
    name: 'Pricing — 3 tier',
    tags: ['pricing', 'tier', '3-column', 'cards'],
    html: `<section class="el-fixture-pricing-3tier-section">
  <div class="el-fixture-pricing-3tier-inner">
    <div class="el-fixture-pricing-3tier-head">
      <span class="el-fixture-pricing-3tier-eyebrow">Pricing</span>
      <h2>Simple, fair pricing</h2>
      <p>No surprises. Cancel any time. All plans include unlimited collaborators.</p>
    </div>
    <div class="el-fixture-pricing-3tier-grid">
      <article class="el-fixture-pricing-3tier-card">
        <h3>Starter</h3>
        <div class="el-fixture-pricing-3tier-price"><span class="el-fixture-pricing-3tier-amt">$9</span><span class="el-fixture-pricing-3tier-per">/mo</span></div>
        <ul>
          <li>1 project</li>
          <li>10 GB storage</li>
          <li>Email support</li>
        </ul>
        <a href="#" class="el-fixture-pricing-3tier-cta">Choose Starter</a>
      </article>
      <article class="el-fixture-pricing-3tier-card el-fixture-pricing-3tier-pop">
        <span class="el-fixture-pricing-3tier-flag">Most popular</span>
        <h3>Studio</h3>
        <div class="el-fixture-pricing-3tier-price"><span class="el-fixture-pricing-3tier-amt">$29</span><span class="el-fixture-pricing-3tier-per">/mo</span></div>
        <ul>
          <li>10 projects</li>
          <li>100 GB storage</li>
          <li>Priority support</li>
          <li>Custom domain</li>
        </ul>
        <a href="#" class="el-fixture-pricing-3tier-cta el-fixture-pricing-3tier-cta-on">Choose Studio</a>
      </article>
      <article class="el-fixture-pricing-3tier-card">
        <h3>Agency</h3>
        <div class="el-fixture-pricing-3tier-price"><span class="el-fixture-pricing-3tier-amt">$99</span><span class="el-fixture-pricing-3tier-per">/mo</span></div>
        <ul>
          <li>Unlimited projects</li>
          <li>1 TB storage</li>
          <li>Dedicated CSM</li>
          <li>SSO + audit log</li>
        </ul>
        <a href="#" class="el-fixture-pricing-3tier-cta">Choose Agency</a>
      </article>
    </div>
  </div>
</section>`,
    css: `.el-fixture-pricing-3tier-section{background:#f7f6f2;padding:96px 24px;font-family:'Inter',system-ui,sans-serif;color:#111}
.el-fixture-pricing-3tier-inner{max-width:1120px;margin:0 auto}
.el-fixture-pricing-3tier-head{text-align:center;margin-bottom:48px}
.el-fixture-pricing-3tier-eyebrow{display:inline-block;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#6b6b6b;background:#fff;border:1px solid #e5e2da;padding:6px 12px;border-radius:999px;margin-bottom:18px}
.el-fixture-pricing-3tier-head h2{font-family:'Instrument Serif','Times New Roman',serif;font-weight:400;font-size:clamp(40px,6vw,72px);margin:0 0 12px;letter-spacing:-.02em}
.el-fixture-pricing-3tier-head p{color:#6b6b6b;margin:0}
.el-fixture-pricing-3tier-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.el-fixture-pricing-3tier-card{background:#fff;border:1px solid #e5e2da;border-radius:18px;padding:28px;display:flex;flex-direction:column;gap:16px;position:relative;transition:transform .2s ease}
.el-fixture-pricing-3tier-card:hover{transform:translateY(-2px)}
.el-fixture-pricing-3tier-card h3{font-family:'Instrument Serif','Times New Roman',serif;font-weight:400;font-size:24px;margin:0;letter-spacing:-.01em}
.el-fixture-pricing-3tier-price{display:flex;align-items:baseline;gap:6px}
.el-fixture-pricing-3tier-amt{font-size:44px;font-weight:600;letter-spacing:-.03em}
.el-fixture-pricing-3tier-per{color:#6b6b6b;font-size:14px}
.el-fixture-pricing-3tier-card ul{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:8px;color:#444;font-size:14px}
.el-fixture-pricing-3tier-card ul li{padding-left:18px;position:relative}
.el-fixture-pricing-3tier-card ul li::before{content:'✓';position:absolute;left:0;color:#6b6b6b;font-size:12px;top:2px}
.el-fixture-pricing-3tier-cta{margin-top:auto;display:inline-flex;justify-content:center;padding:12px 18px;border:1px solid #111;border-radius:999px;text-decoration:none;color:#111;font-weight:500;font-size:14px;transition:all .2s ease}
.el-fixture-pricing-3tier-cta:hover{background:#111;color:#fff}
.el-fixture-pricing-3tier-pop{background:#111;color:#f7f6f2;border-color:#111}
.el-fixture-pricing-3tier-pop .el-fixture-pricing-3tier-per,.el-fixture-pricing-3tier-pop ul{color:#b6b3ad}
.el-fixture-pricing-3tier-pop ul li::before{color:#b6b3ad}
.el-fixture-pricing-3tier-cta-on{background:#c8ff4d;color:#111;border-color:#c8ff4d}
.el-fixture-pricing-3tier-flag{position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:#c8ff4d;color:#111;font-size:10px;letter-spacing:.16em;text-transform:uppercase;padding:4px 10px;border-radius:999px;font-weight:600}
@media (max-width: 880px){.el-fixture-pricing-3tier-grid{grid-template-columns:1fr}}`,
    source: FIXTURE_SOURCE('pricing', '3 tier'),
  },
  {
    id: 'fixture-pricing-table',
    category: 'pricing',
    name: 'Pricing — table',
    tags: ['pricing', 'table', 'compare'],
    html: `<section class="el-fixture-pricing-table-section">
  <div class="el-fixture-pricing-table-inner">
    <h2>Compare plans</h2>
    <div class="el-fixture-pricing-table-wrap">
      <table class="el-fixture-pricing-table-table">
        <thead><tr><th></th><th>Free</th><th>Pro</th><th>Team</th></tr></thead>
        <tbody>
          <tr><td>Projects</td><td>1</td><td>10</td><td>Unlimited</td></tr>
          <tr><td>Storage</td><td>2 GB</td><td>50 GB</td><td>1 TB</td></tr>
          <tr><td>Members</td><td>1</td><td>3</td><td>Unlimited</td></tr>
          <tr><td>Custom domain</td><td>—</td><td>✓</td><td>✓</td></tr>
          <tr><td>SSO</td><td>—</td><td>—</td><td>✓</td></tr>
          <tr><td>Support</td><td>Community</td><td>Email</td><td>Dedicated</td></tr>
          <tr><td></td><td><a href="#">Start free</a></td><td><a href="#">Choose Pro</a></td><td><a href="#">Contact sales</a></td></tr>
        </tbody>
      </table>
    </div>
  </div>
</section>`,
    css: `.el-fixture-pricing-table-section{background:#fff;padding:80px 24px;font-family:'Inter',system-ui,sans-serif;color:#111}
.el-fixture-pricing-table-inner{max-width:980px;margin:0 auto}
.el-fixture-pricing-table-section h2{font-family:'Instrument Serif','Times New Roman',serif;font-weight:400;font-size:48px;margin:0 0 32px;letter-spacing:-.02em}
.el-fixture-pricing-table-wrap{border:1px solid #e5e2da;border-radius:16px;overflow:hidden}
.el-fixture-pricing-table-table{width:100%;border-collapse:collapse;font-size:14px}
.el-fixture-pricing-table-table th,.el-fixture-pricing-table-table td{padding:14px 18px;text-align:left;border-bottom:1px solid #efece4}
.el-fixture-pricing-table-table thead th{background:#faf8f3;font-weight:600;font-size:13px;letter-spacing:.04em;text-transform:uppercase}
.el-fixture-pricing-table-table tbody tr:last-child td{border-bottom:none}
.el-fixture-pricing-table-table tbody tr:hover{background:#faf8f3}
.el-fixture-pricing-table-table a{color:#111;text-decoration:underline;font-weight:500}`,
    source: FIXTURE_SOURCE('pricing', 'table'),
  },
  {
    id: 'fixture-pricing-2tier',
    category: 'pricing',
    name: 'Pricing — 2 tier',
    tags: ['pricing', 'tier', '2-column'],
    html: `<section class="el-fixture-pricing-2tier-section">
  <div class="el-fixture-pricing-2tier-inner">
    <h2>Pick a plan</h2>
    <div class="el-fixture-pricing-2tier-grid">
      <article class="el-fixture-pricing-2tier-card">
        <h3>Personal</h3>
        <p class="el-fixture-pricing-2tier-price"><span>$0</span><small>forever</small></p>
        <p class="el-fixture-pricing-2tier-sub">For curious individuals getting started.</p>
        <a href="#" class="el-fixture-pricing-2tier-btn">Start free</a>
      </article>
      <article class="el-fixture-pricing-2tier-card el-fixture-pricing-2tier-featured">
        <h3>Pro</h3>
        <p class="el-fixture-pricing-2tier-price"><span>$19</span><small>/mo</small></p>
        <p class="el-fixture-pricing-2tier-sub">For makers who ship every week.</p>
        <a href="#" class="el-fixture-pricing-2tier-btn el-fixture-pricing-2tier-btn-on">Go Pro</a>
      </article>
    </div>
  </div>
</section>`,
    css: `.el-fixture-pricing-2tier-section{background:#0a0a0a;color:#f5f5f0;padding:88px 24px;font-family:'Inter',system-ui,sans-serif}
.el-fixture-pricing-2tier-inner{max-width:880px;margin:0 auto}
.el-fixture-pricing-2tier-section h2{font-family:'Fraunces',serif;font-weight:400;font-size:48px;margin:0 0 36px;letter-spacing:-.02em}
.el-fixture-pricing-2tier-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.el-fixture-pricing-2tier-card{background:#141414;border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:32px;display:flex;flex-direction:column;gap:16px}
.el-fixture-pricing-2tier-card h3{font-family:'Fraunces',serif;font-weight:400;font-size:24px;margin:0}
.el-fixture-pricing-2tier-price{margin:0;font-weight:600;font-size:48px;letter-spacing:-.03em;line-height:1}
.el-fixture-pricing-2tier-price small{font-size:14px;color:#9a9a92;font-weight:400;margin-left:4px}
.el-fixture-pricing-2tier-sub{color:#b8b8ae;margin:0;font-size:14px}
.el-fixture-pricing-2tier-btn{margin-top:auto;display:inline-flex;justify-content:center;padding:12px 18px;border:1px solid #f5f5f0;border-radius:999px;text-decoration:none;color:#f5f5f0;font-weight:500;transition:all .2s ease}
.el-fixture-pricing-2tier-btn:hover{background:#f5f5f0;color:#0a0a0a}
.el-fixture-pricing-2tier-featured{background:#c8ff4d;color:#0a0a0a;border-color:#c8ff4d}
.el-fixture-pricing-2tier-featured .el-fixture-pricing-2tier-sub,.el-fixture-pricing-2tier-featured .el-fixture-pricing-2tier-price small{color:#0a0a0a}
.el-fixture-pricing-2tier-btn-on{background:#0a0a0a;color:#c8ff4d;border-color:#0a0a0a}
.el-fixture-pricing-2tier-btn-on:hover{background:#f5f5f0;color:#0a0a0a;border-color:#0a0a0a}
@media (max-width: 720px){.el-fixture-pricing-2tier-grid{grid-template-columns:1fr}}`,
    source: FIXTURE_SOURCE('pricing', '2 tier'),
  },
  {
    id: 'fixture-pricing-4tier',
    category: 'pricing',
    name: 'Pricing — 4 tier',
    tags: ['pricing', 'tier', '4-column'],
    html: `<section class="el-fixture-pricing-4tier-section">
  <div class="el-fixture-pricing-4tier-inner">
    <h2>Choose your plan</h2>
    <div class="el-fixture-pricing-4tier-grid">
      <article><h3>Hobby</h3><p class="el-fixture-pricing-4tier-amt">$0</p><ul><li>1 site</li><li>Community</li></ul><a href="#">Start</a></article>
      <article><h3>Starter</h3><p class="el-fixture-pricing-4tier-amt">$12</p><ul><li>5 sites</li><li>Email</li></ul><a href="#">Pick</a></article>
      <article class="el-fixture-pricing-4tier-on"><h3>Studio</h3><p class="el-fixture-pricing-4tier-amt">$39</p><ul><li>25 sites</li><li>Priority</li></ul><a href="#">Pick</a></article>
      <article><h3>Scale</h3><p class="el-fixture-pricing-4tier-amt">$99</p><ul><li>Unlimited</li><li>CSM</li></ul><a href="#">Contact</a></article>
    </div>
  </div>
</section>`,
    css: `.el-fixture-pricing-4tier-section{background:#f6f3ee;padding:80px 24px;font-family:'Inter',system-ui,sans-serif;color:#1a1a1a}
.el-fixture-pricing-4tier-inner{max-width:1180px;margin:0 auto}
.el-fixture-pricing-4tier-section h2{font-family:'Instrument Serif',serif;font-weight:400;font-size:48px;margin:0 0 32px}
.el-fixture-pricing-4tier-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.el-fixture-pricing-4tier-grid article{background:#fff;border:1px solid #e8e3d8;border-radius:14px;padding:24px;display:flex;flex-direction:column;gap:12px}
.el-fixture-pricing-4tier-grid h3{margin:0;font-family:'Instrument Serif',serif;font-weight:400;font-size:22px}
.el-fixture-pricing-4tier-amt{margin:0;font-size:32px;font-weight:600;letter-spacing:-.02em}
.el-fixture-pricing-4tier-grid ul{list-style:none;padding:0;margin:0;font-size:13px;color:#666;display:flex;flex-direction:column;gap:6px}
.el-fixture-pricing-4tier-grid a{margin-top:auto;text-align:center;padding:10px;border:1px solid #1a1a1a;border-radius:999px;text-decoration:none;color:#1a1a1a;font-size:13px}
.el-fixture-pricing-4tier-on{background:#1a1a1a;color:#f6f3ee;border-color:#1a1a1a}
.el-fixture-pricing-4tier-on .el-fixture-pricing-4tier-amt{color:#c8ff4d}
.el-fixture-pricing-4tier-on ul{color:#a8a89f}
.el-fixture-pricing-4tier-on a{background:#c8ff4d;color:#1a1a1a;border-color:#c8ff4d}
@media (max-width: 980px){.el-fixture-pricing-4tier-grid{grid-template-columns:repeat(2,1fr)}}
@media (max-width: 540px){.el-fixture-pricing-4tier-grid{grid-template-columns:1fr}}`,
    source: FIXTURE_SOURCE('pricing', '4 tier'),
  },
  {
    id: 'fixture-pricing-toggle',
    category: 'pricing',
    name: 'Pricing — monthly/yearly toggle',
    tags: ['pricing', 'toggle', 'billing'],
    html: `<section class="el-fixture-pricing-toggle-section">
  <div class="el-fixture-pricing-toggle-inner">
    <h2>Pricing</h2>
    <div class="el-fixture-pricing-toggle-switch" role="tablist" aria-label="Billing">
      <button class="el-fixture-pricing-toggle-pill el-fixture-pricing-toggle-on" type="button">Monthly</button>
      <button class="el-fixture-pricing-toggle-pill" type="button">Yearly <span>−20%</span></button>
    </div>
    <div class="el-fixture-pricing-toggle-grid">
      <article>
        <h3>Solo</h3>
        <p><strong>$9</strong><span>/mo</span></p>
        <ul><li>1 user</li><li>10 GB</li></ul>
        <a href="#">Choose Solo</a>
      </article>
      <article>
        <h3>Team</h3>
        <p><strong>$29</strong><span>/mo</span></p>
        <ul><li>Up to 10</li><li>100 GB</li></ul>
        <a href="#">Choose Team</a>
      </article>
      <article>
        <h3>Business</h3>
        <p><strong>$79</strong><span>/mo</span></p>
        <ul><li>Unlimited</li><li>1 TB</li></ul>
        <a href="#">Choose Business</a>
      </article>
    </div>
  </div>
</section>`,
    css: `.el-fixture-pricing-toggle-section{background:#fff;padding:80px 24px;font-family:'Inter',system-ui,sans-serif;color:#111}
.el-fixture-pricing-toggle-inner{max-width:960px;margin:0 auto;text-align:center}
.el-fixture-pricing-toggle-section h2{font-family:'Instrument Serif',serif;font-weight:400;font-size:48px;margin:0 0 24px}
.el-fixture-pricing-toggle-switch{display:inline-flex;background:#f1efe9;border-radius:999px;padding:4px;gap:4px;margin-bottom:32px}
.el-fixture-pricing-toggle-pill{border:0;background:transparent;padding:8px 16px;border-radius:999px;font-size:13px;cursor:pointer;color:#666;font-weight:500}
.el-fixture-pricing-toggle-pill span{background:#c8ff4d;color:#1a1a1a;border-radius:999px;padding:2px 6px;font-size:11px;margin-left:4px}
.el-fixture-pricing-toggle-on{background:#1a1a1a;color:#f1efe9}
.el-fixture-pricing-toggle-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;text-align:left}
.el-fixture-pricing-toggle-grid article{background:#faf8f3;border:1px solid #e8e3d8;border-radius:14px;padding:24px;display:flex;flex-direction:column;gap:12px}
.el-fixture-pricing-toggle-grid h3{margin:0;font-family:'Instrument Serif',serif;font-weight:400;font-size:22px}
.el-fixture-pricing-toggle-grid p{margin:0;font-size:32px;letter-spacing:-.02em}
.el-fixture-pricing-toggle-grid p strong{font-weight:600}
.el-fixture-pricing-toggle-grid p span{font-size:13px;color:#888;font-weight:400}
.el-fixture-pricing-toggle-grid ul{list-style:none;padding:0;margin:0;font-size:13px;color:#555;display:flex;flex-direction:column;gap:6px}
.el-fixture-pricing-toggle-grid a{margin-top:auto;text-align:center;padding:10px;border:1px solid #1a1a1a;border-radius:999px;text-decoration:none;color:#1a1a1a;font-size:13px}
@media (max-width: 720px){.el-fixture-pricing-toggle-grid{grid-template-columns:1fr}}`,
    source: FIXTURE_SOURCE('pricing', 'toggle'),
  },
  {
    id: 'fixture-pricing-single',
    category: 'pricing',
    name: 'Pricing — single',
    tags: ['pricing', 'single', 'flat'],
    html: `<section class="el-fixture-pricing-single-section">
  <div class="el-fixture-pricing-single-card">
    <span class="el-fixture-pricing-single-eyebrow">All-access</span>
    <h2>One plan. Everything included.</h2>
    <p class="el-fixture-pricing-single-amt"><span>$49</span>/mo per seat</p>
    <p class="el-fixture-pricing-single-sub">All features. All integrations. No surprises.</p>
    <ul>
      <li>Unlimited projects</li>
      <li>Priority support</li>
      <li>SSO &amp; SCIM</li>
      <li>Custom contracts</li>
    </ul>
    <a href="#" class="el-fixture-pricing-single-cta">Start free trial →</a>
  </div>
</section>`,
    css: `.el-fixture-pricing-single-section{background:#0d0d0d;padding:80px 24px;font-family:'Inter',system-ui,sans-serif;color:#f5f5f0;display:flex;justify-content:center}
.el-fixture-pricing-single-card{max-width:520px;width:100%;background:#161616;border:1px solid rgba(255,255,255,.08);border-radius:24px;padding:40px;text-align:center}
.el-fixture-pricing-single-eyebrow{display:inline-block;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#c8ff4d;background:rgba(200,255,77,.12);padding:4px 10px;border-radius:999px;margin-bottom:18px}
.el-fixture-pricing-single-card h2{font-family:'Fraunces',serif;font-weight:400;font-size:36px;margin:0 0 16px;letter-spacing:-.02em;line-height:1.1}
.el-fixture-pricing-single-amt{margin:0 0 4px;font-size:56px;font-weight:600;letter-spacing:-.04em;line-height:1}
.el-fixture-pricing-single-amt span{color:#c8ff4d}
.el-fixture-pricing-single-sub{margin:0 0 24px;color:#9a9a92;font-size:14px}
.el-fixture-pricing-single-card ul{list-style:none;padding:0;margin:0 0 28px;display:flex;flex-direction:column;gap:10px;text-align:left;font-size:14px;color:#b8b8ae}
.el-fixture-pricing-single-card ul li{padding-left:22px;position:relative}
.el-fixture-pricing-single-card ul li::before{content:'✓';position:absolute;left:0;color:#c8ff4d}
.el-fixture-pricing-single-cta{display:inline-block;background:#c8ff4d;color:#0d0d0d;padding:14px 28px;border-radius:999px;text-decoration:none;font-weight:600;font-size:15px;transition:transform .2s ease}
.el-fixture-pricing-single-cta:hover{transform:translateY(-2px)}`,
    source: FIXTURE_SOURCE('pricing', 'single'),
  },
  {
    id: 'fixture-pricing-list',
    category: 'pricing',
    name: 'Pricing — list',
    tags: ['pricing', 'list', 'rows'],
    html: `<section class="el-fixture-pricing-list-section">
  <div class="el-fixture-pricing-list-inner">
    <h2>Services &amp; rates</h2>
    <ul class="el-fixture-pricing-list-rows">
      <li><span class="el-fixture-pricing-list-name">Brand identity</span><span class="el-fixture-pricing-list-desc">Logo, palette, type system, guidelines</span><span class="el-fixture-pricing-list-amt">from $4,500</span></li>
      <li><span class="el-fixture-pricing-list-name">Marketing site</span><span class="el-fixture-pricing-list-desc">Design + build, 5–8 pages, CMS</span><span class="el-fixture-pricing-list-amt">from $12,000</span></li>
      <li><span class="el-fixture-pricing-list-name">Design system</span><span class="el-fixture-pricing-list-desc">Tokens, components, documentation</span><span class="el-fixture-pricing-list-amt">from $18,000</span></li>
      <li><span class="el-fixture-pricing-list-name">Retainer</span><span class="el-fixture-pricing-list-desc">Ongoing design + dev, 20h / mo</span><span class="el-fixture-pricing-list-amt">$5,800 / mo</span></li>
    </ul>
  </div>
</section>`,
    css: `.el-fixture-pricing-list-section{background:#f4ede3;padding:80px 24px;font-family:'Inter',system-ui,sans-serif;color:#111}
.el-fixture-pricing-list-inner{max-width:880px;margin:0 auto}
.el-fixture-pricing-list-section h2{font-family:'Instrument Serif',serif;font-weight:400;font-size:48px;margin:0 0 32px;letter-spacing:-.02em}
.el-fixture-pricing-list-rows{list-style:none;padding:0;margin:0}
.el-fixture-pricing-list-rows li{display:grid;grid-template-columns:1fr 2fr auto;align-items:baseline;gap:24px;padding:22px 0;border-bottom:1px solid rgba(17,17,17,.12);font-size:15px}
.el-fixture-pricing-list-rows li:first-child{border-top:1px solid rgba(17,17,17,.12)}
.el-fixture-pricing-list-name{font-family:'Instrument Serif',serif;font-size:22px;font-weight:400}
.el-fixture-pricing-list-desc{color:#666;font-size:14px}
.el-fixture-pricing-list-amt{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:13px;letter-spacing:.04em;color:#111}
@media (max-width: 720px){.el-fixture-pricing-list-rows li{grid-template-columns:1fr;gap:6px}}`,
    source: FIXTURE_SOURCE('pricing', 'list'),
  },
  {
    id: 'fixture-pricing-enterprise',
    category: 'pricing',
    name: 'Pricing — enterprise',
    tags: ['pricing', 'enterprise', 'contact'],
    html: `<section class="el-fixture-pricing-enterprise-section">
  <div class="el-fixture-pricing-enterprise-card">
    <div>
      <h2>Enterprise</h2>
      <p>For teams of 50+ with custom security, procurement, and integration needs.</p>
    </div>
    <ul>
      <li>SSO, SCIM, audit log</li>
      <li>Private cloud &amp; on-prem</li>
      <li>24/7 dedicated CSM</li>
      <li>Custom SLA</li>
    </ul>
    <a href="#" class="el-fixture-pricing-enterprise-cta">Talk to sales →</a>
  </div>
</section>`,
    css: `.el-fixture-pricing-enterprise-section{background:#111;padding:64px 24px;font-family:'Inter',system-ui,sans-serif;color:#f5f5f0;display:flex;justify-content:center}
.el-fixture-pricing-enterprise-card{max-width:880px;width:100%;background:linear-gradient(135deg,#1a1a1a,#0a0a0a);border:1px solid rgba(255,255,255,.1);border-radius:24px;padding:48px;display:grid;grid-template-columns:1fr 1fr;gap:32px;align-items:center}
.el-fixture-pricing-enterprise-card h2{font-family:'Fraunces',serif;font-weight:400;font-size:36px;margin:0 0 12px;letter-spacing:-.02em}
.el-fixture-pricing-enterprise-card p{color:#a8a8a0;margin:0;font-size:15px;line-height:1.5}
.el-fixture-pricing-enterprise-card ul{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:8px;font-size:14px;color:#d4d4cc;grid-column:2}
.el-fixture-pricing-enterprise-card ul li{padding-left:18px;position:relative}
.el-fixture-pricing-enterprise-card ul li::before{content:'—';position:absolute;left:0;color:#c8ff4d}
.el-fixture-pricing-enterprise-cta{grid-column:1/-1;display:inline-block;background:#c8ff4d;color:#0a0a0a;padding:14px 28px;border-radius:999px;text-decoration:none;font-weight:600;font-size:15px;justify-self:start}
@media (max-width: 720px){.el-fixture-pricing-enterprise-card{grid-template-columns:1fr;gap:18px}}`,
    source: FIXTURE_SOURCE('pricing', 'enterprise'),
  },
];

// ---------------------------------------------------------------------------
// FAQ — 7 hand-authored variants
// ---------------------------------------------------------------------------

const faq = [
  {
    id: 'fixture-faq-details',
    category: 'faq',
    name: 'FAQ — accordion (details)',
    tags: ['faq', 'accordion', 'details'],
    html: `<section class="el-fixture-faq-details-section">
  <div class="el-fixture-faq-details-inner">
    <h2>Frequently asked</h2>
    <div class="el-fixture-faq-details-list">
      <details class="el-fixture-faq-details-item" open>
        <summary>How does the free trial work?</summary>
        <p>You get full access for 14 days. No credit card required. At the end of the trial you can pick a plan or your workspace freezes (we keep your data for 60 days).</p>
      </details>
      <details class="el-fixture-faq-details-item">
        <summary>Can I cancel any time?</summary>
        <p>Yes. Plans are month-to-month. Cancel from your dashboard and you'll keep access until the end of the current billing period.</p>
      </details>
      <details class="el-fixture-faq-details-item">
        <summary>Do you offer student discounts?</summary>
        <p>Yes — 50% off any plan with a valid .edu email. Send your details to students@studio.com and we'll set it up within a business day.</p>
      </details>
      <details class="el-fixture-faq-details-item">
        <summary>Is my data secure?</summary>
        <p>All data is encrypted at rest (AES-256) and in transit (TLS 1.3). We're SOC 2 Type II certified. Audit logs and SSO are available on the Team plan and above.</p>
      </details>
    </div>
  </div>
</section>`,
    css: `.el-fixture-faq-details-section{background:#f7f6f2;padding:88px 24px;font-family:'Inter',system-ui,sans-serif;color:#111}
.el-fixture-faq-details-inner{max-width:760px;margin:0 auto}
.el-fixture-faq-details-section h2{font-family:'Instrument Serif',serif;font-weight:400;font-size:48px;margin:0 0 32px;letter-spacing:-.02em}
.el-fixture-faq-details-list{display:flex;flex-direction:column;gap:8px}
.el-fixture-faq-details-item{background:#fff;border:1px solid #e5e2da;border-radius:14px;padding:20px 24px;transition:border-color .2s ease}
.el-fixture-faq-details-item[open]{border-color:#111}
.el-fixture-faq-details-item summary{font-family:'Instrument Serif',serif;font-size:20px;font-weight:400;cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;gap:16px}
.el-fixture-faq-details-item summary::-webkit-details-marker{display:none}
.el-fixture-faq-details-item summary::after{content:'+';font-family:'JetBrains Mono',monospace;font-size:18px;color:#666;transition:transform .2s}
.el-fixture-faq-details-item[open] summary::after{content:'−'}
.el-fixture-faq-details-item p{margin:14px 0 0;color:#555;font-size:15px;line-height:1.6}`,
    source: FIXTURE_SOURCE('faq', 'details'),
  },
  {
    id: 'fixture-faq-2col',
    category: 'faq',
    name: 'FAQ — two column',
    tags: ['faq', '2-column'],
    html: `<section class="el-fixture-faq-2col-section">
  <div class="el-fixture-faq-2col-inner">
    <div class="el-fixture-faq-2col-head">
      <span class="el-fixture-faq-2col-eyebrow">FAQ</span>
      <h2>Questions, answered</h2>
    </div>
    <div class="el-fixture-faq-2col-grid">
      <div class="el-fixture-faq-2col-item">
        <h3>Where is my data stored?</h3>
        <p>On EU-West servers in Frankfurt, Germany. We never replicate to the US.</p>
      </div>
      <div class="el-fixture-faq-2col-item">
        <h3>Can I export my work?</h3>
        <p>Yes — full Markdown, JSON, and ZIP exports are available on every plan.</p>
      </div>
      <div class="el-fixture-faq-2col-item">
        <h3>Do you have an API?</h3>
        <p>Yes. A REST API with bearer tokens is available on the Team plan and above.</p>
      </div>
      <div class="el-fixture-faq-2col-item">
        <h3>How do refunds work?</h3>
        <p>30-day money-back, no questions asked. Email billing@studio.com.</p>
      </div>
    </div>
  </div>
</section>`,
    css: `.el-fixture-faq-2col-section{background:#0d0d0d;color:#f5f5f0;padding:88px 24px;font-family:'Inter',system-ui,sans-serif}
.el-fixture-faq-2col-inner{max-width:1040px;margin:0 auto}
.el-fixture-faq-2col-head{margin-bottom:36px}
.el-fixture-faq-2col-eyebrow{display:inline-block;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#c8ff4d;background:rgba(200,255,77,.12);padding:4px 10px;border-radius:999px;margin-bottom:18px}
.el-fixture-faq-2col-head h2{font-family:'Fraunces',serif;font-weight:400;font-size:48px;margin:0;letter-spacing:-.02em}
.el-fixture-faq-2col-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}
.el-fixture-faq-2col-item{background:#161616;border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:24px}
.el-fixture-faq-2col-item h3{margin:0 0 8px;font-family:'Fraunces',serif;font-weight:400;font-size:20px;color:#fff}
.el-fixture-faq-2col-item p{margin:0;color:#a8a8a0;font-size:14px;line-height:1.6}
@media (max-width: 720px){.el-fixture-faq-2col-grid{grid-template-columns:1fr}}`,
    source: FIXTURE_SOURCE('faq', '2col'),
  },
  {
    id: 'fixture-faq-single',
    category: 'faq',
    name: 'FAQ — single column',
    tags: ['faq', 'single-column'],
    html: `<section class="el-fixture-faq-single-section">
  <div class="el-fixture-faq-single-inner">
    <h2>Common questions</h2>
    <dl class="el-fixture-faq-single-list">
      <dt>How fast is shipping?</dt>
      <dd>Most orders ship within 24 hours. Express orders before noon go out same-day from our Brooklyn warehouse.</dd>
      <dt>Do you ship internationally?</dt>
      <dd>Yes — to 60+ countries. Duties and import taxes are calculated at checkout.</dd>
      <dt>What's your return policy?</dt>
      <dd>Free returns within 30 days. Items must be unworn and in original packaging.</dd>
      <dt>Can I change or cancel my order?</dt>
      <dd>Within 2 hours of placing it, yes. After that, please email support@studio.com.</dd>
    </dl>
  </div>
</section>`,
    css: `.el-fixture-faq-single-section{background:#fff;padding:80px 24px;font-family:'Inter',system-ui,sans-serif;color:#111}
.el-fixture-faq-single-inner{max-width:720px;margin:0 auto}
.el-fixture-faq-single-section h2{font-family:'Instrument Serif',serif;font-weight:400;font-size:48px;margin:0 0 32px;letter-spacing:-.02em}
.el-fixture-faq-single-list{margin:0;display:flex;flex-direction:column;gap:24px}
.el-fixture-faq-single-list dt{font-family:'Instrument Serif',serif;font-size:22px;margin:0 0 6px}
.el-fixture-faq-single-list dd{margin:0;color:#555;font-size:15px;line-height:1.6;border-bottom:1px solid #eee;padding-bottom:20px}
.el-fixture-faq-single-list dt+dd{border-top:0}
.el-fixture-faq-single-list dt:first-of-type{border-top:1px solid #eee;padding-top:20px}`,
    source: FIXTURE_SOURCE('faq', 'single'),
  },
  {
    id: 'fixture-faq-narrow',
    category: 'faq',
    name: 'FAQ — narrow',
    tags: ['faq', 'compact', 'narrow'],
    html: `<section class="el-fixture-faq-narrow-section">
  <h2>FAQ</h2>
  <details class="el-fixture-faq-narrow-item" open><summary>Refund policy?</summary><p>30 days, no questions asked.</p></details>
  <details class="el-fixture-faq-narrow-item"><summary>Shipping times?</summary><p>2–5 business days in the US.</p></details>
  <details class="el-fixture-faq-narrow-item"><summary>International orders?</summary><p>We ship to 60+ countries.</p></details>
  <details class="el-fixture-faq-narrow-item"><summary>Wholesale inquiries?</summary><p>Email wholesale@studio.com.</p></details>
</section>`,
    css: `.el-fixture-faq-narrow-section{background:#faf8f3;padding:64px 24px;max-width:600px;margin:0 auto;font-family:'Inter',system-ui,sans-serif;color:#111}
.el-fixture-faq-narrow-section h2{font-family:'Instrument Serif',serif;font-weight:400;font-size:36px;margin:0 0 24px}
.el-fixture-faq-narrow-item{border-top:1px solid #e5e2da;padding:14px 0}
.el-fixture-faq-narrow-item:last-of-type{border-bottom:1px solid #e5e2da}
.el-fixture-faq-narrow-item summary{font-size:15px;cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center}
.el-fixture-faq-narrow-item summary::-webkit-details-marker{display:none}
.el-fixture-faq-narrow-item summary::after{content:'↓';font-size:11px;color:#888}
.el-fixture-faq-narrow-item[open] summary::after{content:'↑'}
.el-fixture-faq-narrow-item p{margin:8px 0 0;font-size:14px;color:#555;line-height:1.5}`,
    source: FIXTURE_SOURCE('faq', 'narrow'),
  },
  {
    id: 'fixture-faq-categorized',
    category: 'faq',
    name: 'FAQ — categorized',
    tags: ['faq', 'tabs', 'categorized'],
    html: `<section class="el-fixture-faq-categorized-section">
  <div class="el-fixture-faq-categorized-inner">
    <h2>Help center</h2>
    <div class="el-fixture-faq-categorized-tabs">
      <button class="el-fixture-faq-categorized-tab el-fixture-faq-categorized-on">Billing</button>
      <button class="el-fixture-faq-categorized-tab">Account</button>
      <button class="el-fixture-faq-categorized-tab">Product</button>
    </div>
    <div class="el-fixture-faq-categorized-list">
      <details class="el-fixture-faq-categorized-item" open>
        <summary>When do I get billed?</summary>
        <p>On the same calendar day each month as your initial signup. Annual plans are billed once on signup.</p>
      </details>
      <details class="el-fixture-faq-categorized-item">
        <summary>Can I switch plans?</summary>
        <p>Yes, any time. Upgrades are prorated to the day. Downgrades take effect at the next renewal.</p>
      </details>
      <details class="el-fixture-faq-categorized-item">
        <summary>Do you accept purchase orders?</summary>
        <p>Yes — for annual plans of $5,000+ and 12+ months. Email billing@studio.com.</p>
      </details>
    </div>
  </div>
</section>`,
    css: `.el-fixture-faq-categorized-section{background:#fff;padding:88px 24px;font-family:'Inter',system-ui,sans-serif;color:#111;border-top:1px solid #eee;border-bottom:1px solid #eee}
.el-fixture-faq-categorized-inner{max-width:880px;margin:0 auto}
.el-fixture-faq-categorized-section h2{font-family:'Instrument Serif',serif;font-weight:400;font-size:48px;margin:0 0 32px;letter-spacing:-.02em}
.el-fixture-faq-categorized-tabs{display:flex;gap:4px;border-bottom:1px solid #eee;margin-bottom:24px}
.el-fixture-faq-categorized-tab{background:transparent;border:0;padding:12px 18px;font-size:14px;color:#888;cursor:pointer;border-bottom:2px solid transparent;font-weight:500;transition:all .2s}
.el-fixture-faq-categorized-tab:hover{color:#111}
.el-fixture-faq-categorized-on{color:#111;border-bottom-color:#111}
.el-fixture-faq-categorized-list{display:flex;flex-direction:column;gap:0}
.el-fixture-faq-categorized-item{padding:18px 0;border-bottom:1px solid #f0f0f0}
.el-fixture-faq-categorized-item summary{font-size:17px;cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;gap:16px}
.el-fixture-faq-categorized-item summary::-webkit-details-marker{display:none}
.el-fixture-faq-categorized-item summary::after{content:'+';font-family:'JetBrains Mono',monospace;font-size:16px;color:#888}
.el-fixture-faq-categorized-item[open] summary::after{content:'−'}
.el-fixture-faq-categorized-item p{margin:12px 0 0;color:#555;font-size:15px;line-height:1.6}`,
    source: FIXTURE_SOURCE('faq', 'categorized'),
  },
  {
    id: 'fixture-faq-aside',
    category: 'faq',
    name: 'FAQ — with contact CTA',
    tags: ['faq', 'contact', 'aside'],
    html: `<section class="el-fixture-faq-aside-section">
  <div class="el-fixture-faq-aside-grid">
    <div class="el-fixture-faq-aside-faq">
      <h2>FAQ</h2>
      <details class="el-fixture-faq-aside-item" open><summary>Do you offer refunds?</summary><p>Yes — 30-day money-back guarantee on all plans.</p></details>
      <details class="el-fixture-faq-aside-item"><summary>How do I delete my account?</summary><p>Settings → Account → Delete. We erase all your data within 7 days.</p></details>
      <details class="el-fixture-faq-aside-item"><summary>Can I invite my team?</summary><p>Yes, on the Team plan and above. Up to 50 seats included.</p></details>
      <details class="el-fixture-faq-aside-item"><summary>Is there a free plan?</summary><p>Yes — the Personal plan is free forever for individual use.</p></details>
    </div>
    <aside class="el-fixture-faq-aside-side">
      <h3>Still have questions?</h3>
      <p>Our team replies in under 2 hours during business days.</p>
      <a href="mailto:hello@studio.com">hello@studio.com</a>
      <a href="#" class="el-fixture-faq-aside-cta">Book a call →</a>
    </aside>
  </div>
</section>`,
    css: `.el-fixture-faq-aside-section{background:#faf8f3;padding:80px 24px;font-family:'Inter',system-ui,sans-serif;color:#111}
.el-fixture-faq-aside-grid{max-width:1040px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr;gap:48px;align-items:start}
.el-fixture-faq-aside-section h2{font-family:'Instrument Serif',serif;font-weight:400;font-size:48px;margin:0 0 32px;letter-spacing:-.02em}
.el-fixture-faq-aside-item{padding:18px 0;border-bottom:1px solid #e5e2da}
.el-fixture-faq-aside-item summary{font-size:17px;cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;gap:16px}
.el-fixture-faq-aside-item summary::-webkit-details-marker{display:none}
.el-fixture-faq-aside-item summary::after{content:'+';font-family:'JetBrains Mono',monospace;font-size:16px;color:#888}
.el-fixture-faq-aside-item[open] summary::after{content:'−'}
.el-fixture-faq-aside-item p{margin:12px 0 0;color:#555;font-size:15px;line-height:1.6}
.el-fixture-faq-aside-side{background:#111;color:#f5f5f0;border-radius:18px;padding:32px;display:flex;flex-direction:column;gap:14px;position:sticky;top:24px}
.el-fixture-faq-aside-side h3{margin:0;font-family:'Instrument Serif',serif;font-weight:400;font-size:24px}
.el-fixture-faq-aside-side p{margin:0;color:#a8a8a0;font-size:14px}
.el-fixture-faq-aside-side a{color:#c8ff4d;text-decoration:none;font-family:'JetBrains Mono',monospace;font-size:13px}
.el-fixture-faq-aside-cta{display:inline-block;background:#c8ff4d;color:#111;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:600;font-size:14px;align-self:start}
@media (max-width: 720px){.el-fixture-faq-aside-grid{grid-template-columns:1fr}}`,
    source: FIXTURE_SOURCE('faq', 'aside'),
  },
  {
    id: 'fixture-faq-support',
    category: 'faq',
    name: 'FAQ — support grid',
    tags: ['faq', 'support', 'grid'],
    html: `<section class="el-fixture-faq-support-section">
  <div class="el-fixture-faq-support-inner">
    <h2>How can we help?</h2>
    <div class="el-fixture-faq-support-grid">
      <a class="el-fixture-faq-support-tile" href="#">
        <span class="el-fixture-faq-support-ic">●</span>
        <h3>Getting started</h3>
        <p>Quick setup, first project, invite your team.</p>
      </a>
      <a class="el-fixture-faq-support-tile" href="#">
        <span class="el-fixture-faq-support-ic">●</span>
        <h3>Billing &amp; plans</h3>
        <p>Upgrades, invoices, payment methods.</p>
      </a>
      <a class="el-fixture-faq-support-tile" href="#">
        <span class="el-fixture-faq-support-ic">●</span>
        <h3>Security</h3>
        <p>SSO, audit logs, compliance, certifications.</p>
      </a>
      <a class="el-fixture-faq-support-tile" href="#">
        <span class="el-fixture-faq-support-ic">●</span>
        <h3>API &amp; integrations</h3>
        <p>REST, webhooks, Zapier, custom apps.</p>
      </a>
      <a class="el-fixture-faq-support-tile" href="#">
        <span class="el-fixture-faq-support-ic">●</span>
        <h3>Account</h3>
        <p>Profile, password, deletion, transfers.</p>
      </a>
      <a class="el-fixture-faq-support-tile" href="#">
        <span class="el-fixture-faq-support-ic">●</span>
        <h3>Troubleshooting</h3>
        <p>Common errors and quick fixes.</p>
      </a>
    </div>
  </div>
</section>`,
    css: `.el-fixture-faq-support-section{background:#faf8f3;padding:80px 24px;font-family:'Inter',system-ui,sans-serif;color:#111}
.el-fixture-faq-support-inner{max-width:1040px;margin:0 auto}
.el-fixture-faq-support-section h2{font-family:'Instrument Serif',serif;font-weight:400;font-size:48px;margin:0 0 36px;letter-spacing:-.02em}
.el-fixture-faq-support-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.el-fixture-faq-support-tile{background:#fff;border:1px solid #e8e3d8;border-radius:14px;padding:24px;text-decoration:none;color:inherit;display:flex;flex-direction:column;gap:10px;transition:transform .2s,border-color .2s}
.el-fixture-faq-support-tile:hover{transform:translateY(-2px);border-color:#111}
.el-fixture-faq-support-ic{color:#c8ff4d;font-size:20px;line-height:1}
.el-fixture-faq-support-tile h3{margin:0;font-family:'Instrument Serif',serif;font-weight:400;font-size:20px}
.el-fixture-faq-support-tile p{margin:0;color:#666;font-size:14px;line-height:1.5}
@media (max-width: 880px){.el-fixture-faq-support-grid{grid-template-columns:1fr 1fr}}
@media (max-width: 540px){.el-fixture-faq-support-grid{grid-template-columns:1fr}}`,
    source: FIXTURE_SOURCE('faq', 'support'),
  },
];

// ---------------------------------------------------------------------------
// Divider — 8 hand-authored variants (no <hr> in the source corpus)
// ---------------------------------------------------------------------------

const divider = [
  {
    id: 'fixture-divider-hr',
    category: 'divider',
    name: 'Divider — hr',
    tags: ['divider', 'hr', 'rule'],
    html: `<hr class="el-fixture-divider-hr-rule" />`,
    css: `.el-fixture-divider-hr-rule{border:0;border-top:1px solid rgba(17,17,17,.12);margin:48px auto;max-width:1080px}`,
    source: FIXTURE_SOURCE('divider', 'hr'),
  },
  {
    id: 'fixture-divider-dotted',
    category: 'divider',
    name: 'Divider — dotted',
    tags: ['divider', 'dotted'],
    html: `<hr class="el-fixture-divider-dotted-rule" />`,
    css: `.el-fixture-divider-dotted-rule{border:0;border-top:1px dotted rgba(17,17,17,.4);margin:48px auto;max-width:1080px}`,
    source: FIXTURE_SOURCE('divider', 'dotted'),
  },
  {
    id: 'fixture-divider-ornament',
    category: 'divider',
    name: 'Divider — ornament',
    tags: ['divider', 'ornament', 'centered'],
    html: `<div class="el-fixture-divider-ornament-rule" aria-hidden="true">
  <span class="el-fixture-divider-ornament-line"></span>
  <span class="el-fixture-divider-ornament-mark">✦</span>
  <span class="el-fixture-divider-ornament-line"></span>
</div>`,
    css: `.el-fixture-divider-ornament-rule{display:flex;align-items:center;gap:18px;margin:48px auto;max-width:720px}
.el-fixture-divider-ornament-line{flex:1;height:1px;background:rgba(17,17,17,.18)}
.el-fixture-divider-ornament-mark{font-family:'Instrument Serif',serif;font-size:20px;color:#111}`,
    source: FIXTURE_SOURCE('divider', 'ornament'),
  },
  {
    id: 'fixture-divider-thick',
    category: 'divider',
    name: 'Divider — thick',
    tags: ['divider', 'thick', 'bold'],
    html: `<hr class="el-fixture-divider-thick-rule" />`,
    css: `.el-fixture-divider-thick-rule{border:0;border-top:3px solid #111;margin:64px auto;max-width:1080px}`,
    source: FIXTURE_SOURCE('divider', 'thick'),
  },
  {
    id: 'fixture-divider-gradient',
    category: 'divider',
    name: 'Divider — gradient',
    tags: ['divider', 'gradient', 'fade'],
    html: `<hr class="el-fixture-divider-gradient-rule" />`,
    css: `.el-fixture-divider-gradient-rule{border:0;height:1px;background:linear-gradient(90deg,transparent,rgba(17,17,17,.4),transparent);margin:48px auto;max-width:1080px}`,
    source: FIXTURE_SOURCE('divider', 'gradient'),
  },
  {
    id: 'fixture-divider-text',
    category: 'divider',
    name: 'Divider — text',
    tags: ['divider', 'text', 'label'],
    html: `<div class="el-fixture-divider-text-rule" aria-label="Section break">
  <span>Featured</span>
</div>`,
    css: `.el-fixture-divider-text-rule{display:flex;align-items:center;gap:18px;margin:48px auto;max-width:1080px;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#888}
.el-fixture-divider-text-rule::before,.el-fixture-divider-text-rule::after{content:'';flex:1;height:1px;background:rgba(17,17,17,.12)}`,
    source: FIXTURE_SOURCE('divider', 'text'),
  },
  {
    id: 'fixture-divider-wave',
    category: 'divider',
    name: 'Divider — wave',
    tags: ['divider', 'wave', 'svg'],
    html: `<div class="el-fixture-divider-wave-wrap" aria-hidden="true">
  <svg class="el-fixture-divider-wave-svg" viewBox="0 0 1200 80" preserveAspectRatio="none">
    <path d="M0,40 C200,80 400,0 600,40 C800,80 1000,0 1200,40 L1200,80 L0,80 Z" fill="currentColor" opacity="0.12"/>
  </svg>
</div>`,
    css: `.el-fixture-divider-wave-wrap{color:#111;line-height:0}
.el-fixture-divider-wave-svg{width:100%;height:60px;display:block}`,
    source: FIXTURE_SOURCE('divider', 'wave'),
  },
  {
    id: 'fixture-divider-dots',
    category: 'divider',
    name: 'Divider — dots',
    tags: ['divider', 'dots', 'minimal'],
    html: `<div class="el-fixture-divider-dots-rule" aria-hidden="true">
  <span></span><span></span><span></span>
</div>`,
    css: `.el-fixture-divider-dots-rule{display:flex;align-items:center;justify-content:center;gap:10px;margin:48px auto;max-width:1080px}
.el-fixture-divider-dots-rule span{width:4px;height:4px;border-radius:50%;background:rgba(17,17,17,.4)}`,
    source: FIXTURE_SOURCE('divider', 'dots'),
  },
];

// ---------------------------------------------------------------------------
// Extras — a couple of hand-authored entries for categories that are
// thin enough we want to guarantee depth even when the corpus shifts.
// ---------------------------------------------------------------------------

const extras = [
  // Stats — 3-up number row (samples mostly use this exact pattern in
  // resn.html, igloo-inc.html, etc., so this gives a clean canonical
  // baseline).
  {
    id: 'fixture-stats-3up',
    category: 'stats',
    name: 'Stats — 3-up',
    tags: ['stats', '3-column', 'numbers'],
    html: `<section class="el-fixture-stats-3up-section">
  <div class="el-fixture-stats-3up-inner">
    <div class="el-fixture-stats-3up-item">
      <div class="el-fixture-stats-3up-num">240+</div>
      <div class="el-fixture-stats-3up-key">Awards</div>
      <div class="el-fixture-stats-3up-sub">Awwwards, FWA, CSSDA, Lovie, Webby</div>
    </div>
    <div class="el-fixture-stats-3up-item">
      <div class="el-fixture-stats-3up-num">38</div>
      <div class="el-fixture-stats-3up-key">Humans</div>
      <div class="el-fixture-stats-3up-sub">Strategists, designers, engineers</div>
    </div>
    <div class="el-fixture-stats-3up-item">
      <div class="el-fixture-stats-3up-num">2004</div>
      <div class="el-fixture-stats-3up-key">Founded</div>
      <div class="el-fixture-stats-3up-sub">Wellington, New Zealand</div>
    </div>
  </div>
</section>`,
    css: `.el-fixture-stats-3up-section{background:#0a0a0a;color:#f5f5f0;padding:80px 24px;font-family:'Inter',system-ui,sans-serif}
.el-fixture-stats-3up-inner{max-width:1040px;margin:0 auto;display:grid;grid-template-columns:repeat(3,1fr);gap:32px}
.el-fixture-stats-3up-item{border-top:1px solid rgba(255,255,255,.12);padding-top:24px}
.el-fixture-stats-3up-num{font-family:'Instrument Serif',serif;font-size:clamp(56px,7vw,96px);font-weight:400;letter-spacing:-.04em;line-height:1;margin-bottom:12px;color:#fff}
.el-fixture-stats-3up-key{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#888;margin-bottom:6px}
.el-fixture-stats-3up-sub{font-size:14px;color:#b8b8ae;line-height:1.5}
@media (max-width: 720px){.el-fixture-stats-3up-inner{grid-template-columns:1fr;gap:24px}}`,
    source: FIXTURE_SOURCE('stats', '3up'),
  },
  // Contact — full split contact section
  {
    id: 'fixture-contact-split',
    category: 'contact',
    name: 'Contact — split',
    tags: ['contact', 'split', 'form'],
    html: `<section class="el-fixture-contact-split-section">
  <div class="el-fixture-contact-split-grid">
    <div class="el-fixture-contact-split-info">
      <span class="el-fixture-contact-split-eyebrow">Contact</span>
      <h2>Let's build something.</h2>
      <p>We reply within one business day. For urgent matters, ping us on the live chat.</p>
      <ul>
        <li><strong>Email</strong><a href="mailto:hello@studio.com">hello@studio.com</a></li>
        <li><strong>Phone</strong><a href="tel:+15551234567">+1 (555) 123-4567</a></li>
        <li><strong>Office</strong><span>21 Bond St, Wellington 6011</span></li>
      </ul>
    </div>
    <form class="el-fixture-contact-split-form" onsubmit="event.preventDefault();this.querySelector('button').textContent='Sent ✓';this.querySelector('button').disabled=true">
      <input type="text" placeholder="Name" required>
      <input type="email" placeholder="Email" required>
      <input type="text" placeholder="Company">
      <textarea placeholder="Tell us about your project" rows="5" required></textarea>
      <button type="submit">Send message →</button>
    </form>
  </div>
</section>`,
    css: `.el-fixture-contact-split-section{background:#f7f6f2;padding:96px 24px;font-family:'Inter',system-ui,sans-serif;color:#111}
.el-fixture-contact-split-grid{max-width:1120px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:start}
.el-fixture-contact-split-eyebrow{display:inline-block;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#666;background:#fff;border:1px solid #e5e2da;padding:4px 10px;border-radius:999px;margin-bottom:18px}
.el-fixture-contact-split-info h2{font-family:'Instrument Serif',serif;font-weight:400;font-size:clamp(40px,5vw,64px);margin:0 0 12px;letter-spacing:-.02em;line-height:1.05}
.el-fixture-contact-split-info p{color:#666;font-size:15px;line-height:1.6;margin:0 0 32px}
.el-fixture-contact-split-info ul{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:14px}
.el-fixture-contact-split-info li{display:grid;grid-template-columns:80px 1fr;gap:16px;font-size:14px;align-items:baseline}
.el-fixture-contact-split-info strong{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#888;font-weight:500}
.el-fixture-contact-split-info a{color:#111;text-decoration:none;border-bottom:1px solid rgba(17,17,17,.2)}
.el-fixture-contact-split-info a:hover{border-bottom-color:#111}
.el-fixture-contact-split-form{display:flex;flex-direction:column;gap:12px;background:#fff;border:1px solid #e5e2da;border-radius:18px;padding:28px}
.el-fixture-contact-split-form input,.el-fixture-contact-split-form textarea{font:inherit;border:1px solid #e5e2da;border-radius:10px;padding:12px 14px;font-size:14px;background:#fafaf7;font-family:inherit}
.el-fixture-contact-split-form input:focus,.el-fixture-contact-split-form textarea:focus{outline:0;border-color:#111;background:#fff}
.el-fixture-contact-split-form textarea{resize:vertical;min-height:120px}
.el-fixture-contact-split-form button{background:#111;color:#f5f5f0;border:0;border-radius:999px;padding:14px 22px;font-weight:600;font-size:14px;cursor:pointer;font-family:inherit;transition:transform .2s}
.el-fixture-contact-split-form button:hover:not(:disabled){transform:translateY(-1px)}
.el-fixture-contact-split-form button:disabled{background:#c8ff4d;color:#111;cursor:default}
@media (max-width: 880px){.el-fixture-contact-split-grid{grid-template-columns:1fr;gap:32px}}`,
    source: FIXTURE_SOURCE('contact', 'split'),
  },
  // Logos — clean static logo grid (text)
  {
    id: 'fixture-logos-grid',
    category: 'logos',
    name: 'Logo grid — text',
    tags: ['logos', 'grid', 'text'],
    html: `<section class="el-fixture-logos-grid-section">
  <p class="el-fixture-logos-grid-eyebrow">Trusted by teams at</p>
  <div class="el-fixture-logos-grid-grid">
    <span>QUANTUM</span>
    <span>KINDRED</span>
    <span>AIR&nbsp;NZ</span>
    <span>GOOGLE</span>
    <span>BBC</span>
    <span>LEGO</span>
    <span>WEBBY</span>
    <span>FWA</span>
  </div>
</section>`,
    css: `.el-fixture-logos-grid-section{background:#fff;padding:64px 24px;font-family:'Inter',system-ui,sans-serif;text-align:center}
.el-fixture-logos-grid-eyebrow{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#888;margin:0 0 24px}
.el-fixture-logos-grid-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:32px 16px;align-items:center;justify-items:center;max-width:880px;margin:0 auto}
.el-fixture-logos-grid-grid span{font-family:'Fraunces',serif;font-weight:600;font-size:18px;letter-spacing:.04em;color:#1a1a1a;opacity:.65;transition:opacity .2s}
.el-fixture-logos-grid-grid span:hover{opacity:1}
@media (max-width: 720px){.el-fixture-logos-grid-grid{grid-template-columns:repeat(2,1fr)}}`,
    source: FIXTURE_SOURCE('logos', 'grid'),
  },
  // Banner — cookie banner
  {
    id: 'fixture-banner-cookie',
    category: 'banner',
    name: 'Banner — cookie',
    tags: ['banner', 'cookie', 'consent'],
    html: `<div class="el-fixture-banner-cookie-bar" role="region" aria-label="Cookie consent">
  <p>We use cookies to improve your experience. By continuing, you agree to our <a href="#">privacy policy</a>.</p>
  <div class="el-fixture-banner-cookie-actions">
    <button type="button" class="el-fixture-banner-cookie-btn el-fixture-banner-cookie-deny">Deny</button>
    <button type="button" class="el-fixture-banner-cookie-btn el-fixture-banner-cookie-accept">Accept all</button>
  </div>
</div>`,
    css: `.el-fixture-banner-cookie-bar{position:fixed;left:24px;bottom:24px;max-width:420px;background:#111;color:#f5f5f0;border-radius:14px;padding:18px 20px;display:flex;flex-direction:column;gap:14px;font-family:'Inter',system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.3);z-index:50}
.el-fixture-banner-cookie-bar p{margin:0;font-size:13px;line-height:1.5;color:#d4d4cc}
.el-fixture-banner-cookie-bar a{color:#c8ff4d}
.el-fixture-banner-cookie-actions{display:flex;gap:8px;justify-content:flex-end}
.el-fixture-banner-cookie-btn{font:inherit;border:0;padding:8px 14px;border-radius:999px;font-size:12px;font-weight:500;cursor:pointer;transition:background .2s}
.el-fixture-banner-cookie-deny{background:transparent;color:#f5f5f0;border:1px solid rgba(255,255,255,.2)}
.el-fixture-banner-cookie-accept{background:#c8ff4d;color:#111}`,
    source: FIXTURE_SOURCE('banner', 'cookie'),
  },
];

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------

export const FIXTURES = [
  ...pricing,
  ...faq,
  ...divider,
  ...extras,
];

export default FIXTURES;
