'use strict';
require('dotenv').config({ path: __dirname + '/../.env' });
var nodemailer = require('nodemailer');
var path = require('path');
var fs = require('fs');

var transporter = nodemailer.createTransport({
  host: 'smtp.hostinger.com',
  port: 465,
  secure: true,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

var AM_EMAILS = {
  'Raman':       'raman.kumar@timhortonsindia.com',
  'Harish':      'harish.solanki@timhortonsindia.com',
  'Rohit':       'rohit.gupta@timhortonsindia.com',
  'Deepak':      'deepak.kumar@timhortonsindia.com',
  'Akash Chavan':'akash.chavan@timhortonsindia.com',
  'Akash Rathod':'akash.rathod@timhortonsindia.com',
  'Jagadeesha':  'jagadeesha.shetty@timhortonsindia.com',
  'Shivam':      'shivam.singh@timhortonsindia.com'
};
var CC_EMAIL  = 'sandeep.yadav@timhortonsindia.com';
var HOD_EMAIL = 'jahid.inamdar@timhortonsindia.com';

var MONTH       = '2026-05';
var MONTH_LABEL = 'May 2026';

// ── helpers ───────────────────────────────────────────────────────────────────
function style() {
  return '<style>body{margin:0;padding:0;background:#F5F5F7;font-family:Arial,sans-serif}' +
    '.wrap{max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)}' +
    '.hdr{background:linear-gradient(135deg,#C8102E,#8B0B1F);padding:24px 28px}' +
    '.hdr-logo{color:#fff;font-size:20px;font-weight:700}.hdr-sub{color:rgba(255,255,255,0.7);font-size:13px;margin-top:4px}' +
    '.body{padding:24px 28px}.greeting{font-size:20px;font-weight:700;color:#1C1C1E;margin-bottom:16px}' +
    '.card{background:#F5F5F7;border-radius:10px;padding:16px;margin-bottom:16px}' +
    '.card-ttl{font-size:11px;font-weight:700;color:#8E8E93;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px}' +
    '.big{font-size:36px;font-weight:800;margin:4px 0}.sub{font-size:12px;color:#8E8E93}' +
    '.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #E5E5EA;align-items:center}' +
    '.row:last-child{border-bottom:none}' +
    '.badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700}' +
    '.badge.green{background:#D1F2D9;color:#1B7A3A}.badge.amber{background:#FFF3CD;color:#B36200}.badge.red{background:#FFE5E5;color:#C8102E}.badge.grey{background:#E5E5EA;color:#6E6E73}' +
    '.ldr-row{display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:8px;margin-bottom:4px}' +
    '.ldr-row.me{background:#FFF0F0;border:1px solid #C8102E}' +
    '.ldr-pos{font-size:18px;width:28px;text-align:center}.ldr-name{flex:1;font-size:14px;font-weight:600;color:#1C1C1E}' +
    '.ldr-score{font-size:13px;font-weight:700}.ldr-meta{font-size:11px;color:#8E8E93}' +
    '.btn{display:block;background:#C8102E;color:#fff;text-decoration:none;text-align:center;padding:14px 24px;border-radius:8px;font-weight:700;font-size:14px;margin-top:16px}' +
    '.footer{padding:16px 28px;text-align:center;font-size:11px;color:#8E8E93;border-top:1px solid #E5E5EA}' +
    '.action{background:#FFF8E1;border-left:3px solid #F59E0B;border-radius:0 8px 8px 0;padding:12px 14px;margin-top:12px;font-size:13px;color:#78350F}' +
    '.action.good{background:#F0FFF4;border-color:#22C55E;color:#14532D}' +
    '</style>';
}

function scoreBadge(score) {
  if (score === null) return '<span class="badge grey">No Data</span>';
  if (score >= 85) return '<span class="badge green">' + score + '%</span>';
  if (score >= 60) return '<span class="badge amber">' + score + '%</span>';
  return '<span class="badge red">' + score + '%</span>';
}

function scoreColor(score) {
  if (score === null) return '#8E8E93';
  if (score >= 85) return '#1B7A3A';
  if (score >= 60) return '#B36200';
  return '#C8102E';
}

function medal(rank) {
  if (rank === 0) return '🥇';
  if (rank === 1) return '🥈';
  if (rank === 2) return '🥉';
  return '#' + (rank + 1);
}

function wrap(body, subtitle) {
  return style() +
    '<div class="wrap">' +
    '<div class="hdr"><div class="hdr-logo">Tim\'s Ops Connect ☕</div>' +
    (subtitle ? '<div class="hdr-sub">' + subtitle + '</div>' : '') + '</div>' +
    '<div class="body">' + body + '</div>' +
    '<div class="footer">Tim Hortons India &middot; OpsAIHub &middot; Automated Monthly Report</div>' +
    '</div>';
}

// ── data ──────────────────────────────────────────────────────────────────────
var allSubs = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/submissions.json'), 'utf8'));
var stores  = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/stores.json'), 'utf8'));

var amStoreCount = {};
stores.forEach(function(s) { amStoreCount[s.am] = (amStoreCount[s.am] || 0) + 1; });

var maySubs = allSubs.filter(function(s) {
  return (s.submittedAt || s.date || '').startsWith(MONTH);
});

var stats = {};
Object.keys(AM_EMAILS).forEach(function(am) {
  stats[am] = { am: am, visits: 0, scores: [], stores: [], totalStores: amStoreCount[am] || 0, entries: [] };
});

maySubs.forEach(function(s) {
  var am = s.am;
  if (!stats[am]) return;
  stats[am].visits++;
  stats[am].scores.push(s.score || 0);
  stats[am].entries.push(s);
  if (!stats[am].stores.includes(s.store)) stats[am].stores.push(s.store);
});

Object.values(stats).forEach(function(a) {
  a.avgScore = a.visits > 0
    ? Math.round(a.scores.reduce(function(x, y) { return x + y; }, 0) / a.visits)
    : null;
});

var ranked = Object.values(stats).sort(function(a, b) {
  if (a.avgScore === null && b.avgScore === null) return 0;
  if (a.avgScore === null) return 1;
  if (b.avgScore === null) return -1;
  return b.avgScore - a.avgScore;
});

// ── leaderboard HTML block (shared across all emails) ─────────────────────────
function leaderboardHtml(currentAm) {
  var rows = ranked.map(function(a, i) {
    var isMe = a.am === currentAm;
    var scoreStr = a.avgScore !== null ? a.avgScore + '%' : '—';
    var visits   = a.visits > 0 ? a.visits + ' visit' + (a.visits !== 1 ? 's' : '') : 'No visits';
    return '<div class="ldr-row' + (isMe ? ' me' : '') + '">' +
      '<div class="ldr-pos">' + medal(i) + '</div>' +
      '<div style="flex:1">' +
        '<div class="ldr-name">' + a.am + (isMe ? ' <span style="font-size:10px;color:#C8102E;">(You)</span>' : '') + '</div>' +
        '<div class="ldr-meta">' + visits + ' &nbsp;·&nbsp; ' + a.stores.length + '/' + a.totalStores + ' stores covered</div>' +
      '</div>' +
      '<div class="ldr-score" style="color:' + scoreColor(a.avgScore) + '">' + scoreStr + '</div>' +
    '</div>';
  }).join('');
  return '<div class="card"><div class="card-ttl">&#x1F3C6; ' + MONTH_LABEL + ' Leaderboard — All AMs</div>' + rows + '</div>';
}

// ── per-visit breakdown ────────────────────────────────────────────────────────
function visitBreakdown(amData) {
  if (amData.entries.length === 0) return '';
  var rows = amData.entries.map(function(e) {
    var dt = (e.date || (e.submittedAt || '').slice(0, 10));
    var day = (e.day || '').charAt(0).toUpperCase() + (e.day || '').slice(1);
    return '<div class="row"><span style="font-size:13px;color:#1C1C1E">' + e.store + ' <span style="color:#8E8E93;font-size:11px;">(' + day + ' ' + dt + ')</span></span>' +
      scoreBadge(e.score) + '</div>';
  }).join('');
  return '<div class="card"><div class="card-ttl">&#x1F4CB; Visit-by-Visit Breakdown</div>' + rows + '</div>';
}

// ── action message ─────────────────────────────────────────────────────────────
function actionBlock(amData, rank) {
  if (amData.avgScore === null) {
    return '<div class="action">&#x26A0;&#xFE0F; <strong>No checklist submissions recorded for ' + MONTH_LABEL + '.</strong> ' +
      'Please ensure store visit checklists are submitted via OpsAIHub after each visit. ' +
      'Your compliance score cannot be calculated without submissions.</div>';
  }
  if (amData.avgScore === 0) {
    return '<div class="action">&#x1F534; <strong>Score is 0% — checklist items are not being marked complete.</strong> ' +
      'Please review the checklist criteria and ensure each item is verified during your store visit before submitting.</div>';
  }
  if (amData.avgScore >= 85) {
    return '<div class="action good">&#x2705; Excellent work! Your average score of ' + amData.avgScore + '% reflects strong operational standards. ' +
      'Keep it up and help bring up the scores across your region.</div>';
  }
  if (amData.stores.length < amData.totalStores) {
    var missing = amData.totalStores - amData.stores.length;
    return '<div class="action">&#x1F4CC; ' + missing + ' store' + (missing > 1 ? 's' : '') + ' in your cluster did not receive a checklist visit this month. ' +
      'Aim for 100% store coverage to improve your ranking.</div>';
  }
  return '<div class="action">&#x1F4C8; Your score of ' + amData.avgScore + '% is developing. Focus on completing all checklist items during each visit. ' +
    'Review any items frequently scored "No" and address them with your team.</div>';
}

// ── build individual AM email ──────────────────────────────────────────────────
function buildAmEmail(amData, rank) {
  var firstName = amData.am.split(' ')[0];
  var rankStr   = rank === 0 ? '1st' : rank === 1 ? '2nd' : rank === 2 ? '3rd' : (rank + 1) + 'th';
  var scoreDisplay = amData.avgScore !== null ? amData.avgScore + '%' : 'N/A';
  var scoreCol = scoreColor(amData.avgScore);

  var body =
    '<div class="greeting">Hi ' + firstName + ' 👋</div>' +
    '<p style="color:#3C3C43;font-size:14px;line-height:1.6;margin-bottom:20px">' +
      'Here\'s your store visit checklist report for <strong>' + MONTH_LABEL + '</strong>. ' +
      'See how you performed and where you stand among the team.' +
    '</p>' +

    // Score card
    '<div class="card"><div class="card-ttl">&#x1F4CA; Your ' + MONTH_LABEL + ' Score</div>' +
      '<div style="display:flex;gap:16px;flex-wrap:wrap">' +
        '<div style="flex:1;min-width:120px"><div class="big" style="color:' + scoreCol + '">' + scoreDisplay + '</div><div class="sub">Average Checklist Score</div></div>' +
        '<div style="flex:1;min-width:120px"><div class="big" style="color:#007AFF">' + amData.visits + '</div><div class="sub">Total Visits This Month</div></div>' +
        '<div style="flex:1;min-width:120px"><div class="big" style="color:#5856D6">' + amData.stores.length + '/' + amData.totalStores + '</div><div class="sub">Stores Covered</div></div>' +
        '<div style="flex:1;min-width:120px"><div class="big" style="color:#FF9500">' + rankStr + '</div><div class="sub">Rank This Month</div></div>' +
      '</div>' +
    '</div>' +

    actionBlock(amData, rank) +
    visitBreakdown(amData) +
    leaderboardHtml(amData.am) +

    '<a href="https://opsaihub.in" class="btn">View Live Dashboard &rarr;</a>';

  return wrap(body, MONTH_LABEL + ' Checklist Performance Report');
}

// ── build HOD summary email ────────────────────────────────────────────────────
function buildHodEmail() {
  var submittedCount = ranked.filter(function(a) { return a.avgScore !== null; }).length;
  var notSubmitted   = ranked.filter(function(a) { return a.avgScore === null; });
  var avgAll = submittedCount > 0
    ? Math.round(ranked.filter(function(a){return a.avgScore!==null;}).reduce(function(s,a){return s+a.avgScore;},0) / submittedCount)
    : 0;

  var leaderRows = ranked.map(function(a, i) {
    var scoreStr = a.avgScore !== null ? a.avgScore + '%' : '— No submissions';
    return '<div class="row">' +
      '<span style="font-size:13px;color:#1C1C1E">' + medal(i) + ' ' + a.am + '</span>' +
      '<div>' +
        scoreBadge(a.avgScore) +
        '<span style="font-size:11px;color:#8E8E93;margin-left:8px">' + a.visits + ' visits &nbsp; ' + a.stores.length + '/' + a.totalStores + ' stores</span>' +
      '</div>' +
    '</div>';
  }).join('');

  var noSubList = notSubmitted.length > 0
    ? '<div class="action">&#x26A0;&#xFE0F; <strong>No submissions from:</strong> ' +
        notSubmitted.map(function(a){return a.am;}).join(', ') +
      '. Follow up required.</div>'
    : '<div class="action good">&#x2705; All AMs submitted checklists this month.</div>';

  var body =
    '<div class="greeting">Monthly Checklist Summary — ' + MONTH_LABEL + '</div>' +
    '<p style="color:#3C3C43;font-size:14px;line-height:1.6;margin-bottom:20px">' +
      submittedCount + ' of ' + ranked.length + ' AMs submitted checklists. ' +
      'Team average score: <strong style="color:' + scoreColor(avgAll) + '">' + avgAll + '%</strong>.' +
    '</p>' +

    '<div class="card"><div class="card-ttl">&#x1F3C6; AM Leaderboard — ' + MONTH_LABEL + '</div>' + leaderRows + '</div>' +
    noSubList +
    '<a href="https://opsaihub.in" class="btn">Open OpsAIHub Dashboard &rarr;</a>';

  return wrap(body, 'HOD Summary — ' + MONTH_LABEL);
}

// ── send ──────────────────────────────────────────────────────────────────────
var queue = ranked.slice(); // copy

function sendNext() {
  if (queue.length === 0) {
    // HOD summary last
    var hodHtml = buildHodEmail();
    transporter.sendMail({
      from: '"Tim\'s Ops Connect" <' + process.env.EMAIL_USER + '>',
      to: HOD_EMAIL,
      subject: '[Tim\'s Ops Connect] ' + MONTH_LABEL + ' Checklist Performance — HOD Summary',
      html: hodHtml
    }, function(err) {
      if (err) console.error('[HOD email error]', err.message);
      else console.log('[HOD summary sent] ' + HOD_EMAIL);
      console.log('\n✅ All emails sent.');
    });
    return;
  }

  var amData = queue.shift();
  var rank   = ranked.indexOf(amData);
  var toEmail = AM_EMAILS[amData.am];
  var html   = buildAmEmail(amData, rank);
  var subject = '[Tim\'s Ops Connect] Your ' + MONTH_LABEL + ' Checklist Report — ' + amData.am;

  transporter.sendMail({
    from: '"Tim\'s Ops Connect" <' + process.env.EMAIL_USER + '>',
    to: toEmail,
    cc: [CC_EMAIL, HOD_EMAIL],
    subject: subject,
    html: html
  }, function(err) {
    if (err) console.error('[Email error] ' + amData.am + ':', err.message);
    else console.log('[Sent] ' + amData.am + ' → ' + toEmail);
    setTimeout(sendNext, 800); // small delay between sends
  });
}

console.log('Sending ' + MONTH_LABEL + ' checklist reports to ' + ranked.length + ' AMs...\n');
sendNext();
