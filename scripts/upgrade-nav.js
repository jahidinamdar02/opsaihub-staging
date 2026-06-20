/**
 * upgrade-nav.js
 * Applies laptop-first 220px side-nav to all hub pages.
 * Injects a <style> block before </head> — safe, additive, reversible.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const PUB = '/root/th-am-ops-staging/public';

// Pages that have a .bottom-nav and need upgrading
const TARGETS = [
  'audit.html','ceo.html','delivery.html','events.html',
  'fdu-upload.html','feed.html','feedback.html','hod.html',
  'index.html','kpi.html','performance-fy27.html','performance.html',
  'sap-upload.html','targets.html','tasks.html','training.html'
];

// Sentinel so we never double-inject
const SENTINEL = '<!-- nav-upgrade-v1 -->';

const INJECT = `${SENTINEL}
<style>
/* ═══════════════════════════════════════════════
   LAPTOP-FIRST NAV — 220 px side rail (desktop)
   bottom tab bar restored at ≤ 767 px
   ═══════════════════════════════════════════════ */
:root{--nav-w:220px;}

/* ── desktop body canvas ── */
body{padding-left:var(--nav-w)!important;padding-bottom:0!important;}

/* ── 220 px side rail ── */
.bottom-nav{
  position:fixed!important;top:0!important;left:0!important;
  bottom:auto!important;right:auto!important;
  width:var(--nav-w)!important;height:100dvh!important;
  background:rgba(255,255,255,0.95)!important;
  backdrop-filter:blur(20px)!important;
  border-right:1px solid #E5E5EA!important;
  border-top:none!important;
  display:flex!important;flex-direction:column!important;
  justify-content:flex-start!important;align-items:stretch!important;
  padding:0 10px 20px!important;
  z-index:50!important;overflow-y:auto!important;gap:2px!important;
  transform:translateZ(0)!important;
}
.bottom-nav::before{
  content:'☕  Tim\\2019s Ops'!important;
  font-size:15px!important;font-weight:700!important;
  color:#1D1D1F!important;letter-spacing:-0.3px!important;
  display:block!important;
  padding:20px 10px 16px!important;margin-bottom:6px!important;
  border-bottom:1px solid #E5E5EA!important;flex-shrink:0!important;
}
.nav-item{
  display:flex!important;flex-direction:row!important;
  align-items:center!important;gap:10px!important;
  text-decoration:none!important;
  padding:10px 12px!important;border-radius:10px!important;
  min-width:0!important;
  transition:background 0.15s ease-out!important;
}
.nav-item:hover{background:rgba(200,16,46,0.06)!important;}
.nav-item.active{background:rgba(200,16,46,0.1)!important;}
.nav-icon{font-size:18px!important;flex-shrink:0!important;}
.nav-label{
  font-size:13px!important;font-weight:500!important;
  color:#6E6E73!important;white-space:nowrap!important;
  overflow:hidden!important;text-overflow:ellipsis!important;
}
.nav-item.active .nav-label{color:#C8102E!important;font-weight:600!important;}
.nav-dot{display:none!important;}

/* ── desktop white sticky header ── */
.hdr{
  background:#fff!important;
  border-bottom:1px solid #E5E5EA!important;
  padding:0 32px!important;height:60px!important;
  display:flex!important;align-items:center!important;gap:16px!important;
  position:sticky!important;top:0!important;z-index:89!important;
}
.hdr-ttl,.hdr-title{font-size:20px!important;font-weight:700!important;color:#1D1D1F!important;letter-spacing:-0.3px!important;}
.hdr-eye{font-size:11px!important;font-weight:700!important;color:#6E6E73!important;text-transform:uppercase!important;letter-spacing:1.5px!important;}
.hdr-sub{font-size:12px!important;color:#6E6E73!important;margin-left:auto!important;}
/* neutral content-area padding */
.content{padding:24px 32px!important;max-width:1400px!important;margin:0 auto!important;}

/* ── semantic token fill-in (for pages that lack them) ── */
:root{
  --pass:#1B7A3A;--pass-bg:#E8F8ED;
  --warn:#8B4500;--warn-bg:#FFF3E0;
  --fail-bg:#FEE8E8;
}

/* ═══════════════════════════════════════════════
   MOBILE OVERRIDE ≤ 767 px
   ═══════════════════════════════════════════════ */
@media (max-width:767px){
  body{padding-left:0!important;padding-bottom:calc(var(--nav-h,64px) + 16px)!important;}

  .bottom-nav{
    width:100%!important;height:var(--nav-h,64px)!important;
    top:auto!important;bottom:0!important;left:0!important;right:0!important;
    flex-direction:row!important;justify-content:space-around!important;
    align-items:center!important;
    padding:0 0 env(safe-area-inset-bottom)!important;
    border-right:none!important;border-top:1px solid rgba(0,0,0,0.08)!important;
    overflow-y:visible!important;gap:0!important;
  }
  .bottom-nav::before{display:none!important;}
  .nav-item{
    flex-direction:column!important;gap:3px!important;
    padding:8px 12px!important;border-radius:0!important;
    transition:none!important;
  }
  .nav-item:hover,.nav-item.active{background:transparent!important;}
  .nav-item.active .nav-label{color:#C8102E!important;}
  .nav-icon{font-size:22px!important;}
  .nav-label{font-size:10px!important;}

  /* restore mobile gradient header */
  .hdr{
    background:linear-gradient(150deg,#1A0508 0%,#C8102E 60%,#9B0D22 100%)!important;
    padding:calc(env(safe-area-inset-top,0px) + 44px) 16px 18px!important;
    height:auto!important;position:static!important;
    flex-direction:column!important;align-items:flex-start!important;gap:4px!important;
  }
  .hdr-ttl,.hdr-title{font-size:24px!important;color:#fff!important;}
  .hdr-eye{color:rgba(255,255,255,0.55)!important;}
  .hdr-sub{font-size:12px!important;color:rgba(255,255,255,0.6)!important;margin-left:0!important;}

  /* restore mobile content padding */
  .content{padding:14px 16px!important;max-width:100%!important;}
}
</style>`;

let upgraded = 0;
let skipped = 0;

TARGETS.forEach(function(name) {
  const fp = path.join(PUB, name);
  if (!fs.existsSync(fp)) { console.log('MISSING: ' + name); return; }
  let html = fs.readFileSync(fp, 'utf8');
  if (html.includes(SENTINEL)) { console.log('SKIP (already done): ' + name); skipped++; return; }
  if (!html.includes('</head>')) { console.log('SKIP (no </head>): ' + name); skipped++; return; }
  html = html.replace('</head>', INJECT + '\n</head>');
  fs.writeFileSync(fp, html, 'utf8');
  console.log('UPGRADED: ' + name);
  upgraded++;
});

console.log('\nDone. Upgraded: ' + upgraded + '  Skipped: ' + skipped);
