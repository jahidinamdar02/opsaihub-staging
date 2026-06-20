'use strict';
/**
 * fix-audit.js — applies all Hallmark audit fixes
 *
 * C1  Floating orbs (hero/page-header pseudo-elements)
 * C2  Gradient headline in feed.html
 * C3  overflow-x:hidden → clip in index.html
 * C4  Pure-white --card token in index.html
 * C5  Remove competing 80px nav rail from all pages
 * M1  transition:all in fdu-upload.html
 * M2  Purple active nav label in events.html
 * M4  Gradient progress bars → solid fill
 * M5  nav-item:active scale(0.9) → scale(0.97) in index.html
 * m2  feed.html body background:#fff → var(--bg)
 * m3  feed.html --nav-h:56px → 64px
 * m4  performance.html cubic-bezier overshoot → ease-out
 */

const fs = require('fs');
const path = require('path');
const PUB = '/root/th-am-ops-staging/public';

function read(name)  { return fs.readFileSync(path.join(PUB, name), 'utf8'); }
function write(name, html) { fs.writeFileSync(path.join(PUB, name), html, 'utf8'); console.log('✓  ' + name); }
function sub(html, pattern, replacement) { return html.replace(pattern, replacement); }

/* ─────────────────────────────────────────────
   C5 helper — strips nav-only block or nav lines
   from a @media (min-width: 768px) block
   ───────────────────────────────────────────── */

// Matches the whole @media block including any comment header before it
const NAV_ONLY_BLOCK = /\/\*[^*]*DESKTOP BREAKPOINT[^*]*\*\/\s*@media\s*\(min-width:\s*768px\)\s*\{[^}]*(?:\{[^}]*\}[^}]*)*\}\s*/g;

// For pages where ONLY the nav lines live in the block — remove the whole block
function stripNavBlock(html) {
  return html.replace(
    /\/\*[^*]*(?:DESKTOP BREAKPOINT|Mobile styles above)[^*]*\*\/\s*@media\s*\(min-width:\s*768px\)\s*\{[\s\S]*?\n\}/,
    ''
  );
}

// For index.html — remove only nav-specific lines, keep layout CSS
function stripNavLinesFromBlock(html) {
  // Remove :root { --sidenav-w: 80px; }
  html = html.replace(/\s*:root\s*\{\s*--sidenav-w:[^}]+\}\s*/g, '\n');
  // Remove body block inside @media that sets padding-left/padding-bottom
  html = html.replace(/(\s*\/\*[^*]*Body shifts[^*]*\*\/\s*)?\s*body\s*\{\s*padding-bottom:[^}]+padding-left:[^}]+\}/g, '');
  // Remove the nav comment + .bottom-nav/.nav-item/.nav-icon/.nav-label/.nav-dot lines
  html = html.replace(/\s*\/\*[^*]*(?:BOTTOM NAV|Bottom bar)[^*]*\*\/[\s\S]*?\.nav-dot\s*\{[^}]*\}/g, '');
  // Remove brand mark comment + .bottom-nav::before block
  html = html.replace(/\s*\/\*[^*]*Brand mark[^*]*\*\/[\s\S]*?\.bottom-nav::before\s*\{[^}]*\}/g, '');
  return html;
}

// ─── C1: Floating orbs ───────────────────────────────────────────────────────

// index.html — multi-line .hero::before and .hero::after
let idx = read('index.html');
idx = idx.replace(/\.hero::before\s*\{[\s\S]*?\}\n\.hero::after\s*\{[\s\S]*?\}\n/, '');
// Also remove the single-line overflow-x:hidden (C3)
idx = idx.replace('overflow-x: hidden;', 'overflow-x: clip;');
// Fix --card pure white (C4)
idx = idx.replace('--card: #FFFFFF;', '--card: oklch(99.5% 0.003 15);');
// Fix nav-item:active scale (M5)
idx = idx.replace('transform: scale(0.9);', 'transform: scale(0.97);');
// Strip nav lines from desktop block (keep hero/layout CSS)
idx = stripNavLinesFromBlock(idx);
write('index.html', idx);

// feedback.html — single-line hero::before
let fb = read('feedback.html');
fb = fb.replace(/\.hero::before\s*\{[^}]*border-radius:50%[^}]*\}\s*/, '');
// Gradient progress bar (M4)
fb = fb.replace(
  'background:linear-gradient(90deg,var(--red),var(--red-dark)); border-radius:4px; transition:width 0.4s ease',
  'background:var(--red); border-radius:4px; transition:width 0.4s ease-out'
);
fb = stripNavBlock(fb);
write('feedback.html', fb);

// performance.html — page-header::before orb (keep revenue-hero::before ☕ emoji — it's semantic)
let perf = read('performance.html');
perf = perf.replace(/\.page-header::before\s*\{[^}]*border-radius:50%[^}]*\}\s*/, '');
// m4: cubic-bezier overshoot on progress
perf = perf.replace('transition:width 1.2s cubic-bezier(0.25,0,0.3,1)', 'transition:width 1.2s ease-out');
perf = stripNavBlock(perf);
write('performance.html', perf);

// kpi.html — hero::after radial orb
let kpi = read('kpi.html');
kpi = kpi.replace(/\.hero::after\s*\{[^}]*border-radius:50%[^}]*\}\s*/, '');
kpi = stripNavBlock(kpi);
write('kpi.html', kpi);

// tasks.html — ai-hero::before radial orb + gradient progress bar + nav block
let tasks = read('tasks.html');
tasks = tasks.replace(/\.ai-hero::before\s*\{[^}]*radial-gradient[^}]*\}\s*/, '');
tasks = tasks.replace(
  '.progress-bar-fill { height:100%; background:linear-gradient(90deg,var(--red),var(--red-dark)); border-radius:4px; transition:width 0.5s ease; }',
  '.progress-bar-fill { height:100%; background:var(--red); border-radius:4px; transition:width 0.5s ease-out; }'
);
tasks = stripNavBlock(tasks);
write('tasks.html', tasks);

// ─── C2: Gradient headline in feed.html ──────────────────────────────────────
let feed = read('feed.html');
// Replace gradient text-fill logo with solid red
feed = feed.replace(
  /background:linear-gradient\(135deg,#C8102E,#FF6B6B\); -webkit-background-clip:text; -webkit-text-fill-color:transparent;/,
  'color:#C8102E;'
);
// m2: body background #fff → var(--bg)
feed = feed.replace(
  'html,body { background:#fff; color:#1D1D1F; font-family:-apple-system,BlinkMacSystemFont,\'SF Pro Display\',sans-serif; min-height:100%; }',
  'html,body { background:var(--bg,#F5F5F7); color:#1D1D1F; font-family:-apple-system,BlinkMacSystemFont,\'SF Pro Display\',sans-serif; min-height:100%; }'
);
// m3: --nav-h: 56px → 64px
feed = feed.replace('--nav-h:56px;', '--nav-h:64px;');
// C5: strip nav block
feed = stripNavBlock(feed);
write('feed.html', feed);

// ─── M1: transition:all in fdu-upload.html ───────────────────────────────────
let fup = read('fdu-upload.html');
fup = fup.replace('transition:all 0.2s', 'transition:border-color 0.15s ease-out,background 0.15s ease-out');
fup = stripNavBlock(fup);
write('fdu-upload.html', fup);

// ─── M2: Purple active nav in events.html ────────────────────────────────────
let ev = read('events.html');
ev = ev.replace(
  '.nav-item.active .nav-label{color:var(--purple);font-weight:700;}',
  '.nav-item.active .nav-label{color:var(--red);font-weight:700;}'
);
// events.html desktop block has #evFab positioning we want to keep — strip only nav lines
// The block ends with #evFab lines then }
// Remove nav-specific lines, keep #evFab block
ev = ev.replace(
  /\/\*[^*]*(?:DESKTOP BREAKPOINT|Mobile styles above)[^*]*\*\/\s*@media\s*\(min-width:\s*768px\)\s*\{([\s\S]*?)\n\}/,
  (match, inner) => {
    // keep only #evFab block, strip nav lines
    const fabMatch = inner.match(/#evFab\s*\{[^}]+\}/);
    if (!fabMatch) return '';
    return '@media (min-width:768px) {\n  ' + fabMatch[0] + '\n}';
  }
);
write('events.html', ev);

// ─── M4: Gradient progress bar in sap-upload.html ───────────────────────────
let sap = read('sap-upload.html');
sap = sap.replace(
  'background:linear-gradient(90deg,var(--red),#FF6B6B)',
  'background:var(--red)'
);
sap = stripNavBlock(sap);
write('sap-upload.html', sap);

// ─── C5 only: pages with nav-only desktop blocks ─────────────────────────────
for (const name of ['audit.html','ceo.html','delivery.html','hod.html',
                     'performance-fy27.html','targets.html','training.html']) {
  let html = read(name);
  // targets.html: update 80px references in save-btn/saved-badge to use nav-w
  if (name === 'targets.html') {
    html = html.replace('left: calc(80px + 16px)', 'left: calc(var(--nav-w,220px) + 16px)');
    html = html.replace('left: calc(80px + 50%)', 'left: calc(var(--nav-w,220px) + 50%)');
  }
  html = stripNavBlock(html);
  write(name, html);
}

console.log('\nAll audit fixes applied.');
