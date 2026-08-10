/**
 * RHOBEAR Designs — Pro entitlement + upgrade/buy flow. 100% client-side, MIT.
 *
 * The free editor is NEVER crippled. Pro unlocks: voice control, generation
 * styles, and the deep-thinking toggle (and, in the hosted build, managed AI).
 *
 * Two unlock paths:
 *   1) A launch/promo CODE from PRO_CONFIG.codes (owner-set) — lets you start
 *      selling the moment your checkout link is live, before any license backend.
 *   2) A SIGNED license key (Ed25519, verified in-browser against the embedded
 *      public key) — the durable path once you issue keys.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * OWNER — the ONLY things left before this sells (nothing here moves money until
 * you fill them; this is the "stops when you get here" boundary):
 *   • PRO_CONFIG.checkoutUrl : your PayPal / Stripe payment LINK. "Get Pro" sends
 *                              the buyer straight there.
 *   • PRO_CONFIG.pubKeyB64   : your license Ed25519 PUBLIC key (raw 32 bytes,
 *                              base64). Sign keys with the private key in the vault.
 *   • PRO_CONFIG.codes       : optional launch codes you email on purchase.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const PRO_CONFIG = {
  productName: 'RHOBEAR Designs Pro',
  priceLabel: '$19 / mo',            // display only — real price is set at checkout
  checkoutUrl: 'https://buy.stripe.com/cNi00c94He31gHN718g7e02',  // LIVE Stripe Payment Link (Designs Pro $19/mo)
  pubKeyB64: '2NG4IJx5yLCk9IrDXDU6h0WHOtMLeZafiOGC0HDDFBs=',  // founder license pubkey (public)
  codes: [],                         // <-- OWNER (optional): ['LAUNCH-2026', ...]
  features: [
    ['Voice control', 'Hold to talk — say what to change and watch the page update.'],
    ['Generation styles', 'Editorial · SaaS-clean · Brutalist · Playful · Luxury presets.'],
    ['Deep thinking', 'Toggle a higher-reasoning pass for complex layouts.'],
    ['Custom & managed models', 'Point at any endpoint (local or premium), or use the hosted house models.'],
  ],
};

const LS_KEY = 'rb-pro';

export function proState() { try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch (_e) { return {}; } }
export function isPro() {
  const s = proState();
  if (!s || !s.pro) return false;
  return s.until === 'forever' || (typeof s.until === 'number' && Date.now() < s.until);
}
function setPro(rec) { try { localStorage.setItem(LS_KEY, JSON.stringify(rec)); } catch (_e) { /* ignore */ } }
export function clearPro() { try { localStorage.removeItem(LS_KEY); } catch (_e) { /* ignore */ } }

// ── signed-license verification (Ed25519 via Web Crypto; fails closed) ────────
function b64ToBytes(b64) {
  const bin = atob(String(b64).replace(/-/g, '+').replace(/_/g, '/'));
  const a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return a;
}
async function verifySignedLicense(license) {
  if (!PRO_CONFIG.pubKeyB64) return null;            // no pubkey configured yet
  const parts = String(license).split('.');
  if (parts.length !== 2) return null;
  const [pB64, sB64] = parts;
  try {
    const key = await crypto.subtle.importKey('raw', b64ToBytes(PRO_CONFIG.pubKeyB64), { name: 'Ed25519' }, false, ['verify']);
    const ok = await crypto.subtle.verify('Ed25519', key, b64ToBytes(sB64), b64ToBytes(pB64));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64ToBytes(pB64)));
    if (payload.exp && Date.now() > payload.exp * 1000) return null;   // expired
    return { pro: true, until: payload.exp ? payload.exp * 1000 : 'forever', plan: payload.plan || 'pro', via: 'license' };
  } catch (_e) { return null; }
}

/** Redeem a promo code or signed license → unlocks Pro. Resolves {ok, message}. */
export async function redeem(codeOrLicense) {
  const v = String(codeOrLicense || '').trim();
  if (!v) return { ok: false, message: 'Enter your code or license key.' };
  if (PRO_CONFIG.codes.length && PRO_CONFIG.codes.map((c) => c.toUpperCase()).includes(v.toUpperCase())) {
    setPro({ pro: true, until: 'forever', plan: 'pro', via: 'code' });
    return { ok: true, message: 'Pro unlocked ✓' };
  }
  const rec = await verifySignedLicense(v);
  if (rec) { setPro(rec); return { ok: true, message: 'Pro license verified ✓' }; }
  return { ok: false, message: PRO_CONFIG.pubKeyB64 ? 'That code / license isn’t valid.' : 'Code not recognized yet.' };
}

/** Run `onAllowed` if Pro; otherwise show the upgrade modal. Returns whether it ran. */
export function requirePro(featureLabel, onAllowed) {
  if (isPro()) { onAllowed(); return true; }
  showUpgrade(featureLabel);
  return false;
}

// ── the upgrade / buy modal (injected — no index.html surgery needed) ─────────
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function buildModal() {
  if (!document.getElementById('rb-pro-modal-style')) {
    const st = document.createElement('style'); st.id = 'rb-pro-modal-style';
    st.textContent = `
      #rb-pro-modal{border:none;background:transparent;padding:0;max-width:460px;width:calc(100% - 2rem);color:#e8eef2;font:inherit}
      #rb-pro-modal::backdrop{background:rgba(6,9,13,.66);backdrop-filter:blur(3px)}
      .rb-pro-card{position:relative;background:linear-gradient(180deg,#131a22,#0d131a);border:1px solid rgba(255,58,42,.28);border-radius:20px;padding:1.5rem 1.5rem 1.35rem;box-shadow:0 24px 60px -12px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.02) inset,0 0 44px -18px rgba(255,58,42,.45)}
      .rb-pro-card__head{display:flex;align-items:flex-start;justify-content:space-between}
      .rb-pro-card__title{font-size:1.2rem;font-weight:700;letter-spacing:-.01em}
      .rb-pro-card__title small{display:block;font-weight:600;font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;color:#C84B4B;margin-bottom:.2rem}
      .rb-pro-card__x{background:transparent;border:0;color:#9db0bb;font-size:1.05rem;cursor:pointer;line-height:1;padding:.15rem .3rem;border-radius:8px}
      .rb-pro-card__x:hover{color:#e8eef2;background:rgba(151,183,196,.1)}
      .rb-pro-note{color:#C84B4B;font-weight:600;margin:.35rem 0 0;font-size:.9rem}
      .rb-pro-feats{list-style:none;padding:0;margin:1rem 0 1.15rem;display:grid;gap:.7rem}
      .rb-pro-feats li{display:grid;grid-template-columns:1rem 1fr;gap:.55rem;align-items:start}
      .rb-pro-feats b.d{color:#C84B4B;font-size:.85rem;line-height:1.55}
      .rb-pro-feats .t{font-weight:600}
      .rb-pro-feats .s{opacity:.62;font-size:.87em;display:block;margin-top:.12rem;line-height:1.4}
      .rb-pro-buy{display:block;text-align:center;text-decoration:none;font-weight:700;color:#fff;background:linear-gradient(135deg,#C84B4B,#a63a3a);border-radius:12px;padding:.85rem 1rem;letter-spacing:.01em;box-shadow:0 8px 24px -8px rgba(200,75,75,.6);transition:transform .12s ease,filter .12s ease}
      .rb-pro-buy:hover{transform:translateY(-1px);filter:brightness(1.06)}
      .rb-pro-redeem{margin-top:1.15rem;border-top:1px solid rgba(151,183,196,.12);padding-top:1rem}
      .rb-pro-redeem label{font-size:.82rem;color:#9db0bb}
      .rb-pro-redeem .row{display:flex;gap:.45rem;margin-top:.45rem}
      .rb-pro-redeem input{flex:1;background:#0a0e13;border:1px solid rgba(151,183,196,.18);border-radius:9px;padding:.55rem .7rem;color:#e8eef2;font-size:.9rem}
      .rb-pro-redeem input:focus{outline:none;border-color:#C84B4B}
      .rb-pro-redeem button{background:transparent;border:1px solid rgba(151,183,196,.28);border-radius:9px;color:#e8eef2;padding:.55rem .95rem;cursor:pointer;transition:border-color .12s ease}
      .rb-pro-redeem button:hover{border-color:#C84B4B}
      .rb-pro-msg{min-height:1.1em;margin:.5rem 0 0;font-size:.88rem}
    `;
    document.head.appendChild(st);
  }
  const d = document.createElement('dialog');
  d.id = 'rb-pro-modal';
  d.innerHTML = `
    <form method="dialog" class="rb-pro-card">
      <div class="rb-pro-card__head">
        <div class="rb-pro-card__title"><small>${esc(PRO_CONFIG.productName).replace(/ Pro$/, '')}</small>Unlock Pro</div>
        <button type="submit" class="rb-pro-card__x" aria-label="Close">✕</button>
      </div>
      <p data-pro-feature class="rb-pro-note"></p>
      <ul class="rb-pro-feats">
        ${PRO_CONFIG.features.map(([t, s]) => `<li><b class="d">◆</b><span><span class="t">${esc(t)}</span><span class="s">${esc(s)}</span></span></li>`).join('')}
      </ul>
      <a data-pro-buy class="rb-pro-buy" href="#" target="_blank" rel="noopener">Get Pro — ${esc(PRO_CONFIG.priceLabel)}</a>
      <div class="rb-pro-redeem">
        <label for="rb-pro-code">Already bought? Redeem your code or license</label>
        <div class="row"><input id="rb-pro-code" placeholder="paste code or license key" /><button type="button" data-pro-redeem>Redeem</button></div>
        <p data-pro-msg class="rb-pro-msg"></p>
      </div>
    </form>`;
  // Buy → owner's checkout (or a clear notice if not configured yet)
  const buy = d.querySelector('[data-pro-buy]');
  buy.addEventListener('click', (e) => {
    if (!PRO_CONFIG.checkoutUrl) {
      e.preventDefault();
      const msg = d.querySelector('[data-pro-msg]');
      if (msg) { msg.textContent = 'Checkout link not set yet — coming today.'; msg.style.color = '#c9922b'; }
    } else { buy.setAttribute('href', PRO_CONFIG.checkoutUrl); }
  });
  const redeemBtn = d.querySelector('[data-pro-redeem]');
  redeemBtn.addEventListener('click', async () => {
    const inp = d.querySelector('#rb-pro-code'); const msg = d.querySelector('[data-pro-msg]');
    const r = await redeem(inp.value);
    if (msg) { msg.textContent = r.message; msg.style.color = r.ok ? '#2e9e6b' : '#C84B4B'; }
    if (r.ok) { setTimeout(() => { try { d.close(); } catch (_e) {} window.dispatchEvent(new Event('rb-pro-changed')); }, 700); }
  });
  return d;
}
export function showUpgrade(featureLabel) {
  let m = document.getElementById('rb-pro-modal');
  if (!m) { m = buildModal(); document.body.appendChild(m); }
  const sub = m.querySelector('[data-pro-feature]');
  if (sub) sub.textContent = featureLabel ? `“${featureLabel}” is a Pro feature.` : '';
  const buy = m.querySelector('[data-pro-buy]');
  if (buy && PRO_CONFIG.checkoutUrl) buy.setAttribute('href', PRO_CONFIG.checkoutUrl);
  if (typeof m.showModal === 'function') m.showModal(); else m.setAttribute('open', '');
}
