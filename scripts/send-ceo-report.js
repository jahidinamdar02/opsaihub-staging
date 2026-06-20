'use strict';
// Usage:
//   node send-ceo-report.js           → sends BOTH weekly + monthly right now
//   node send-ceo-report.js weekly    → weekly only
//   node send-ceo-report.js monthly   → monthly only

require('dotenv').config({ path: __dirname + '/../.env' });
var nodemailer = require('nodemailer');
var path       = require('path');
var fs         = require('fs');

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
var CEO_EMAIL = 'tarun.jain@timhortonsindia.com';
var HOD_EMAIL = 'jahid.inamdar@timhortonsindia.com';
var CC_EMAIL  = 'sandeep.yadav@timhortonsindia.com';

var dataDir = path.join(__dirname, '../data');
function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8')); }
  catch(e) { return []; }
}

function buildCeoReport(label, startDate, endDate) {
  var subs       = readJSON('submissions.json');
  var fduSubs    = readJSON('fdu_submissions.json');
  var donutSubs  = readJSON('fdu_donut_submissions.json');
  var storesData = readJSON('stores.json');
  var totalStores = storesData.length;

  function inPeriod(s) {
    var d = new Date(s.submittedAt || s.date || 0);
    return d >= startDate && d <= endDate;
  }
  var periodSubs  = subs.filter(inPeriod);
  var periodFdu   = fduSubs.filter(inPeriod);
  var periodDonut = donutSubs.filter(inPeriod);

  var amStats = {};
  Object.keys(AM_EMAILS).forEach(function(am) {
    var n = storesData.filter(function(s){ return s.am === am; }).length;
    amStats[am] = { am: am, visits: 0, scores: [], storesCovered: {}, totalStores: n };
  });
  periodSubs.forEach(function(s) {
    if (!amStats[s.am]) return;
    amStats[s.am].visits++;
    amStats[s.am].scores.push(s.score || 0);
    amStats[s.am].storesCovered[s.store] = true;
  });
  Object.values(amStats).forEach(function(a) {
    a.avgScore = a.visits > 0
      ? Math.round(a.scores.reduce(function(x,y){return x+y;},0) / a.visits)
      : null;
    a.covered  = Object.keys(a.storesCovered).length;
    a.coveragePct = a.totalStores > 0 ? Math.round(a.covered / a.totalStores * 100) : 0;
  });
  var amRanked = Object.values(amStats).sort(function(a, b) {
    if (a.avgScore === null && b.avgScore === null) return 0;
    if (a.avgScore === null) return 1;
    if (b.avgScore === null) return -1;
    return b.avgScore - a.avgScore;
  });

  var fduStoreSet = {};
  periodFdu.forEach(function(s){ fduStoreSet[s.store] = true; });
  var fduStoreCount = Object.keys(fduStoreSet).length;
  var fduPct = Math.round(fduStoreCount / totalStores * 100);
  var fduByAm = {};
  Object.keys(AM_EMAILS).forEach(function(am){ fduByAm[am] = { submissions: 0 }; });
  periodFdu.forEach(function(s){ if (fduByAm[s.am]) fduByAm[s.am].submissions++; });

  var donutTotal = periodDonut.length;
  var donutPass  = periodDonut.filter(function(s){ return s.overallPass === true; }).length;
  var donutFail  = periodDonut.filter(function(s){ return s.overallPass === false; }).length;
  var donutPct   = donutTotal > 0 ? Math.round(donutPass / donutTotal * 100) : 0;

  function sc(v) { return v===null?'#8E8E93':v>=85?'#1B7A3A':v>=60?'#B36200':'#C8102E'; }
  function row(left, right, col) {
    return '<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #E5E5EA;align-items:center">'
      +'<span style="font-size:13px;color:#1C1C1E">'+left+'</span>'
      +'<span style="font-size:12px;font-weight:700;color:'+(col||'#007AFF')+'">'+right+'</span></div>';
  }
  function card(title, content) {
    return '<div style="background:#F5F5F7;border-radius:10px;padding:16px;margin-bottom:16px">'
      +'<div style="font-size:11px;font-weight:700;color:#8E8E93;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">'+title+'</div>'
      +content+'</div>';
  }
  function medal(i) { return i===0?'🥇':i===1?'🥈':i===2?'🥉':'#'+(i+1); }

  var amRows = amRanked.map(function(a, i) {
    var score = a.avgScore !== null ? a.avgScore+'%' : '— No visits';
    return '<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;margin-bottom:3px;background:'+(i===0&&a.avgScore!==null?'#F0FFF4':'#fff')+';">'
      +'<span style="font-size:18px;width:26px;text-align:center">'+medal(i)+'</span>'
      +'<div style="flex:1">'
        +'<div style="font-size:13px;font-weight:700;color:#1C1C1E">'+a.am+'</div>'
        +'<div style="font-size:11px;color:#8E8E93">'+a.visits+' visit'+(a.visits!==1?'s':'')+' &nbsp;·&nbsp; '+a.covered+'/'+a.totalStores+' stores &nbsp;·&nbsp; Coverage: '+a.coveragePct+'%</div>'
      +'</div>'
      +'<div style="font-size:14px;font-weight:800;color:'+sc(a.avgScore)+'">'+score+'</div>'
    +'</div>';
  }).join('');

  var fduAmRows = Object.keys(fduByAm).map(function(am) {
    var n = fduByAm[am].submissions;
    return row(am, n > 0 ? n+' submissions' : '— None', n > 0 ? '#1B7A3A' : '#C8102E');
  }).join('');

  var inactive = amRanked.filter(function(a){
    return a.visits === 0 && fduByAm[a.am] && fduByAm[a.am].submissions === 0;
  });
  var inactiveBlock = inactive.length > 0
    ? '<div style="background:#FFF8E1;border-left:3px solid #F59E0B;border-radius:0 8px 8px 0;padding:12px 14px;margin-bottom:16px;font-size:13px;color:#78350F;">'
      +'⚠️ <strong>No activity recorded for:</strong> '+inactive.map(function(a){return a.am;}).join(', ')+'</div>'
    : '<div style="background:#F0FFF4;border-left:3px solid #22C55E;border-radius:0 8px 8px 0;padding:10px 14px;margin-bottom:16px;font-size:13px;color:#14532D;">✅ All AMs recorded activity this period.</div>';

  var totalVisits = periodSubs.length;
  var submittedAms = amRanked.filter(function(a){return a.avgScore!==null;});
  var teamAvg = submittedAms.length > 0
    ? Math.round(submittedAms.reduce(function(s,a){return s+a.avgScore;},0) / submittedAms.length)
    : 0;

  var style = '<style>body{margin:0;padding:0;background:#F5F5F7;font-family:Arial,sans-serif}'
    +'.wrap{max-width:620px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)}'
    +'.hdr{background:linear-gradient(135deg,#C8102E,#8B0B1F);padding:24px 28px}'
    +'.hdr-logo{color:#fff;font-size:20px;font-weight:700}.hdr-sub{color:rgba(255,255,255,0.7);font-size:13px;margin-top:4px}'
    +'.body{padding:24px 28px}'
    +'.btn{display:block;background:#C8102E;color:#fff;text-decoration:none;text-align:center;padding:14px 24px;border-radius:8px;font-weight:700;font-size:14px;margin-top:20px}'
    +'.footer{padding:16px 28px;text-align:center;font-size:11px;color:#8E8E93;border-top:1px solid #E5E5EA}</style>';

  return style
    +'<div class="wrap">'
    +'<div class="hdr"><div class="hdr-logo">Tim\'s Ops Connect ☕</div>'
    +'<div class="hdr-sub">Operations Report &mdash; '+label+'</div></div>'
    +'<div class="body">'
    +'<div style="font-size:20px;font-weight:700;color:#1C1C1E;margin-bottom:8px">Operations Update</div>'
    +'<p style="font-size:14px;color:#3C3C43;line-height:1.6;margin-bottom:20px">Area manager store visits, checklist scores, and FDU display discipline for <strong>'+label+'</strong>.</p>'

    +'<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px">'
      +'<div style="flex:1;min-width:110px;background:#F5F5F7;border-radius:10px;padding:14px;text-align:center">'
        +'<div style="font-size:28px;font-weight:800;color:'+sc(teamAvg)+'">'+teamAvg+'%</div>'
        +'<div style="font-size:11px;color:#8E8E93;margin-top:4px">Team Avg Checklist</div></div>'
      +'<div style="flex:1;min-width:110px;background:#F5F5F7;border-radius:10px;padding:14px;text-align:center">'
        +'<div style="font-size:28px;font-weight:800;color:#007AFF">'+totalVisits+'</div>'
        +'<div style="font-size:11px;color:#8E8E93;margin-top:4px">Store Visits</div></div>'
      +'<div style="flex:1;min-width:110px;background:#F5F5F7;border-radius:10px;padding:14px;text-align:center">'
        +'<div style="font-size:28px;font-weight:800;color:'+sc(fduPct)+'">'+fduPct+'%</div>'
        +'<div style="font-size:11px;color:#8E8E93;margin-top:4px">FDU Store Coverage</div></div>'
      +'<div style="flex:1;min-width:110px;background:#F5F5F7;border-radius:10px;padding:14px;text-align:center">'
        +'<div style="font-size:28px;font-weight:800;color:'+sc(donutPct)+'">'+donutPct+'%</div>'
        +'<div style="font-size:11px;color:#8E8E93;margin-top:4px">Donut Quality Pass</div></div>'
    +'</div>'

    +card('📋 AM Checklist Performance', amRows)
    +inactiveBlock
    +card('🖼️ FDU Display Discipline',
        row('Stores submitted FDU photos', fduStoreCount+' / '+totalStores, sc(fduPct))
      + row('Submission rate', fduPct+'%', sc(fduPct))
      + row('Total FDU submissions', periodFdu.length+'', '#007AFF')
      + '<div style="border-top:1px solid #E5E5EA;margin-top:8px;padding-top:8px;font-size:11px;font-weight:700;color:#8E8E93;letter-spacing:0.4px;text-transform:uppercase;margin-bottom:6px">By Area Manager</div>'
      + fduAmRows
    )
    +card('🍩 Donut Quality Checks',
        row('Total quality checks', donutTotal+'', '#007AFF')
      + row('Passed', donutPass+'', '#1B7A3A')
      + row('Failed', donutFail+'', '#C8102E')
      + row('Pass rate', donutPct+'%', sc(donutPct))
      + (donutTotal === 0 ? '<div style="font-size:12px;color:#8E8E93;margin-top:8px">No donut quality check submissions this period.</div>' : '')
    )
    +'<a href="https://opsaihub.in" class="btn">View Live Dashboard &rarr;</a>'
    +'</div>'
    +'<div class="footer">Tim Hortons India &middot; OpsAIHub &middot; Automated Ops Report</div>'
    +'</div>';
}

function send(to, subject, html, label) {
  transporter.sendMail({
    from: '"Tim\'s Ops Connect" <' + process.env.EMAIL_USER + '>',
    to: to,
    cc: CC_EMAIL,
    subject: subject,
    html: html
  }, function(err) {
    if (err) console.error('[Error] ' + label + ':', err.message);
    else     console.log('[Sent] ' + label + ' → ' + to);
  });
}

var mode = process.argv[2] || 'both';
var now  = new Date();

if (mode === 'weekly' || mode === 'both') {
  // Last full Mon–Sun
  var lastMon = new Date(now);
  lastMon.setDate(now.getDate() - ((now.getDay() + 6) % 7) - 7);
  lastMon.setHours(0, 0, 0, 0);
  var lastSun = new Date(lastMon);
  lastSun.setDate(lastMon.getDate() + 6);
  lastSun.setHours(23, 59, 59, 999);
  var wOpts = { day: 'numeric', month: 'short' };
  var wLabel = lastMon.toLocaleDateString('en-IN', wOpts) + ' – ' + lastSun.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  console.log('Building weekly report for:', wLabel);
  var weeklyHtml = buildCeoReport('Week: ' + wLabel, lastMon, lastSun);
  setTimeout(function() {
    send(CEO_EMAIL, '[Tim\'s Ops Connect] Weekly Ops Report — ' + wLabel, weeklyHtml, 'CEO weekly');
    setTimeout(function() {
      send(HOD_EMAIL, '[Tim\'s Ops Connect] Weekly Ops Report — ' + wLabel, weeklyHtml, 'HOD weekly');
    }, 600);
  }, 400);
}

if (mode === 'monthly' || mode === 'both') {
  // Last calendar month
  var lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
  var lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  var mLabel = lastMonthStart.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  console.log('Building monthly report for:', mLabel);
  var monthlyHtml = buildCeoReport(mLabel, lastMonthStart, lastMonthEnd);
  var delay = mode === 'both' ? 1800 : 400;
  setTimeout(function() {
    send(CEO_EMAIL, '[Tim\'s Ops Connect] Monthly Ops Report — ' + mLabel, monthlyHtml, 'CEO monthly');
    setTimeout(function() {
      send(HOD_EMAIL, '[Tim\'s Ops Connect] Monthly Ops Report — ' + mLabel, monthlyHtml, 'HOD monthly');
    }, 600);
  }, delay);
}
