'use strict';
require('dotenv').config();

process.on('unhandledRejection', function(reason) {
  console.error('[CRASH GUARD] Unhandled rejection:', reason && reason.message ? reason.message : reason);
});
process.on('uncaughtException', function(err) {
  console.error('[CRASH GUARD] Uncaught exception:', err.message);
});

const express = require('express');
const path = require('path');
const cron = require('node-cron');
const fs = require('fs');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3004;

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { success: false, error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, error: 'Rate limit exceeded for this endpoint' }
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/api/', apiLimiter);

if (process.env.NODE_ENV === 'production') {
  app.use(function(req, res, next) {
    if (req.headers['x-forwarded-proto'] !== 'https' && !req.secure) {
      return res.redirect(301, 'https://' + req.headers.host + req.url);
    }
    next();
  });
}

app.use(function(req, res, next) {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

const { readJSON, writeJSON } = require('./services/store');
const { sendEmail, emailStyle, eRow, eCard, eBtn, eWrap } = require('./services/email');
const { AM_EMAILS, CC_EMAIL, HOD_EMAIL, CEO_EMAIL, TRAINING_EMAIL, MAINTENANCE_EMAIL } = require('./services/constants');

const usageLog = path.join(__dirname, 'data', 'usage.log');
app.use(function(req, res, next) {
  if (req.path.endsWith('.html') || req.path === '/') {
    res.on('finish', function() {
      var ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip;
      var entry = new Date().toISOString() + ' | ' + res.statusCode + ' | ' + req.path + ' | ' + ip + ' | ' + (req.get('user-agent') || '-') + '\n';
      fs.appendFile(usageLog, entry, function(err) {
        if (err) console.error('usage log write failed:', err.message);
      });
    });
  }
  next();
});

// Web push crons — IST timezone
const { sendToAll: pushAll } = require('./routes/push');

// 9:00 AM IST — morning briefing
cron.schedule('0 9 * * *', function() {
  var subs = readJSON('push_subscriptions.json', []);
  if (!subs.length) return;
  var day = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
  pushAll(subs, { title: 'Good morning! ☀️', body: 'Your ' + day + ' briefing is ready. Check today\'s checklist and store targets.', tag: 'briefing', url: '/' }, function(r) {
    console.log('[PUSH] Morning briefing sent:', r);
  });
}, { timezone: 'Asia/Kolkata' });

// Monday 9:00 AM IST — weekly maintenance digest
function buildMaintenanceDigest(isTest) {
  var tickets = readJSON('maintenance_tickets.json', []);
  var now = new Date();
  var weekAgo    = new Date(now.getTime() - 7 * 86400000).toISOString();
  var monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  var weekTix    = tickets.filter(function(t) { return t.submittedAt >= weekAgo; });
  var mtdTix     = tickets.filter(function(t) { return t.submittedAt >= monthStart; });

  function fmt(n) { return Number(n || 0).toLocaleString('en-IN'); }
  function pct(a, b) { return b > 0 ? Math.round(a / b * 100) + '%' : '0%'; }
  function tat(t) {
    if (!t.resolvedAt) return '—';
    var h = Math.round((new Date(t.resolvedAt) - new Date(t.submittedAt)) / 3600000);
    return h < 24 ? h + 'h' : Math.round(h / 24) + 'd';
  }
  function statusBadge(s) {
    var map = { open: ['#FF9500','#FFF3CD','🟡 Open'], resolved: ['#007AFF','#D1ECF1','🔵 Resolved'], closed: ['#34C759','#D4EDDA','✅ Closed'] };
    var m = map[s] || ['#8E8E93','#F5F5F7', s];
    return '<span style="display:inline-block;padding:2px 8px;border-radius:5px;font-size:11px;font-weight:700;color:'+m[0]+';background:'+m[1]+';">'+m[2]+'</span>';
  }
  function priBadge(p) {
    if (p === 'p1')     return '<span style="display:inline-block;padding:2px 7px;border-radius:5px;font-size:10px;font-weight:700;color:#fff;background:#C8102E;">⚡ P1 Critical</span>';
    if (p === 'urgent') return '<span style="display:inline-block;padding:2px 7px;border-radius:5px;font-size:10px;font-weight:700;color:#C8102E;background:#FEE8E8;">🔴 Urgent</span>';
    return '<span style="display:inline-block;padding:2px 7px;border-radius:5px;font-size:10px;font-weight:700;color:#1B7A3A;background:#D4EDDA;">🟢 Normal</span>';
  }
  function statRow(tiles) {
    var w = Math.floor(100 / tiles.length);
    var cells = tiles.map(function(t) {
      return '<td width="' + w + '%" style="padding:5px;">'
        + '<table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>'
        + '<td style="background:' + t.bg + ';border-radius:10px;padding:16px 8px;text-align:center;">'
        + '<div style="font-size:10px;font-weight:700;color:' + t.lc + ';text-transform:uppercase;letter-spacing:0.6px;margin-bottom:6px;">' + t.label + '</div>'
        + '<div style="font-size:' + (t.big ? '30' : '24') + 'px;font-weight:800;color:' + t.vc + ';line-height:1;">' + t.value + '</div>'
        + (t.sub ? '<div style="font-size:10px;color:' + t.lc + ';margin-top:5px;">' + t.sub + '</div>' : '')
        + '</td></tr></table></td>';
    }).join('');
    return '<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:4px;"><tr>' + cells + '</tr></table>';
  }
  function sectionHdr(icon, title, sub) {
    return '<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:20px 0 10px;">'
      + '<tr><td style="padding:10px 14px;background:#F5F5F7;border-radius:8px;border-left:4px solid #C8102E;">'
      + '<span style="font-size:13px;font-weight:700;color:#1C1C1E;">' + icon + ' ' + title + '</span>'
      + (sub ? '<span style="font-size:11px;color:#8E8E93;margin-left:8px;">' + sub + '</span>' : '')
      + '</td></tr></table>';
  }
  function ticketTable(list) {
    if (!list.length) return '<p style="font-size:13px;color:#8E8E93;text-align:center;padding:16px 0;">No tickets in this period.</p>';
    var th = 'padding:9px 10px;font-size:10px;font-weight:700;color:#8E8E93;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #E5E5EA;text-align:left;white-space:nowrap;';
    var td = 'padding:9px 10px;font-size:12px;color:#1C1C1E;border-bottom:1px solid #F0F0F5;vertical-align:top;';
    var rows = list.map(function(t, i) {
      var bg = i % 2 === 0 ? '#fff' : '#FAFAFA';
      var mainRow = '<tr style="background:' + bg + ';">'
        + '<td style="' + td + '"><strong>' + t.store + '</strong><br><span style="font-size:10px;color:#8E8E93;">' + t.am + '</span></td>'
        + '<td style="' + td + ';color:#3A3A3C;">' + t.category + '</td>'
        + '<td style="' + td + '">' + priBadge(t.priority) + '</td>'
        + '<td style="' + td + '">' + statusBadge(t.status) + '</td>'
        + '<td style="' + td + ';text-align:center;font-size:11px;color:#8E8E93;">' + tat(t) + '</td>'
        + '<td style="' + td + ';text-align:right;font-weight:700;color:' + (t.totalCost > 0 ? '#C8102E' : '#8E8E93') + ';">' + (t.totalCost > 0 ? '₹' + fmt(t.totalCost) : '—') + '</td>'
        + '</tr>';
      var photoRow = '';
      if (t.photos && t.photos.length) {
        var imgs = t.photos.map(function(p) {
          var url = 'https://opsaihub.in' + p;
          return '<a href="' + url + '" target="_blank" style="display:inline-block;margin:3px;">'
            + '<img src="' + url + '" width="130" height="100" style="border-radius:6px;border:1px solid #E5E5EA;display:block;" alt="photo">'
            + '</a>';
        }).join('');
        photoRow = '<tr style="background:' + bg + ';">'
          + '<td colspan="6" style="padding:4px 10px 10px;border-bottom:1px solid #F0F0F5;">'
          + '<div style="font-size:10px;color:#8E8E93;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px;">📷 Issue Photos</div>'
          + imgs + '</td></tr>';
      }
      return mainRow + photoRow;
    }).join('');
    return '<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;border-radius:10px;overflow:hidden;border:1px solid #E5E5EA;">'
      + '<thead><tr style="background:#F5F5F7;">'
      + '<th style="' + th + '">Store / AM</th><th style="' + th + '">Category</th><th style="' + th + '">Priority</th>'
      + '<th style="' + th + '">Status</th><th style="' + th + ';text-align:center;">TAT</th><th style="' + th + ';text-align:right;">Cost</th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table>';
  }
  function costTable(rows, col1) {
    if (!rows.length) return '<p style="font-size:13px;color:#8E8E93;text-align:center;padding:12px 0;">No data.</p>';
    var max = Math.max.apply(null, rows.map(function(r) { return r.cost; }));
    var th = 'padding:8px 10px;font-size:10px;font-weight:700;color:#8E8E93;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #E5E5EA;text-align:left;';
    var td = 'padding:9px 10px;font-size:12px;color:#1C1C1E;border-bottom:1px solid #F0F0F5;';
    var r = rows.map(function(row, i) {
      var bar = max > 0 ? Math.round(row.cost / max * 100) : 0;
      return '<tr style="background:' + (i % 2 === 0 ? '#fff' : '#FAFAFA') + ';">'
        + '<td style="' + td + '"><strong>' + row.name + '</strong>' + (row.sub ? '<br><span style="font-size:10px;color:#8E8E93;">' + row.sub + '</span>' : '') + '</td>'
        + '<td style="' + td + ';text-align:center;"><span style="font-size:11px;background:#F5F5F7;border-radius:5px;padding:2px 7px;">' + row.count + ' ticket' + (row.count !== 1 ? 's' : '') + '</span></td>'
        + '<td style="' + td + ';width:35%;">'
        + '<table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>'
        + '<td style="width:' + bar + '%;background:linear-gradient(90deg,#C8102E,#E8485C);height:8px;border-radius:4px;"></td>'
        + '<td style="width:' + (100 - bar) + '%;background:#F0F0F5;height:8px;border-radius:4px;"></td>'
        + '</tr></table>'
        + '<div style="font-size:12px;font-weight:700;color:#C8102E;margin-top:4px;">₹' + fmt(row.cost) + '</div>'
        + '</td></tr>';
    }).join('');
    return '<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;border-radius:10px;overflow:hidden;border:1px solid #E5E5EA;">'
      + '<thead><tr style="background:#F5F5F7;"><th style="' + th + '">' + col1 + '</th><th style="' + th + ';text-align:center;">Tickets</th><th style="' + th + '">Cost</th></tr></thead>'
      + '<tbody>' + r + '</tbody></table>';
  }

  var wClosed = weekTix.filter(function(t) { return t.status === 'closed'; }).length;
  var wCost   = weekTix.reduce(function(s, t) { return s + (t.totalCost || 0); }, 0);
  var mClosed = mtdTix.filter(function(t) { return t.status === 'closed'; }).length;
  var mOpen   = mtdTix.filter(function(t) { return t.status === 'open'; }).length;
  var mRes    = mtdTix.filter(function(t) { return t.status === 'resolved'; }).length;
  var mCost   = mtdTix.reduce(function(s, t) { return s + (t.totalCost || 0); }, 0);
  var monthLabel = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  var dateLabel  = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  var storeCost = {};
  mtdTix.forEach(function(t) {
    if (!storeCost[t.store]) storeCost[t.store] = { name: t.store, sub: t.am, cost: 0, count: 0 };
    storeCost[t.store].cost += t.totalCost || 0;
    storeCost[t.store].count++;
  });
  var amCost = {};
  mtdTix.forEach(function(t) {
    var am = t.am || 'Unassigned';
    if (!amCost[am]) amCost[am] = { name: am, cost: 0, count: 0 };
    amCost[am].cost += t.totalCost || 0;
    amCost[am].count++;
  });

  var body = ''
    + '<table width="100%" cellpadding="0" cellspacing="0" role="presentation">'
    + '<tr><td style="background:linear-gradient(135deg,#1A0508 0%,#C8102E 100%);padding:28px 28px 24px;border-radius:12px 12px 0 0;">'
    + '<table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>'
    + '<td><div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.6);letter-spacing:2px;text-transform:uppercase;margin-bottom:5px;">Tim Hortons India &nbsp;·&nbsp; OpsAIHub</div>'
    + '<div style="font-size:24px;font-weight:800;color:#fff;letter-spacing:-0.5px;">🔧 Maintenance Report</div>'
    + '<div style="font-size:13px;color:rgba(255,255,255,0.65);margin-top:5px;">' + (isTest ? '[TEST] ' : '') + dateLabel + '</div></td>'
    + '<td style="text-align:right;vertical-align:top;">'
    + '<div style="background:rgba(255,255,255,0.15);border-radius:10px;padding:10px 16px;display:inline-block;text-align:center;">'
    + '<div style="font-size:10px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.5px;">MTD Total Cost</div>'
    + '<div style="font-size:26px;font-weight:800;color:#fff;">₹' + fmt(mCost) + '</div>'
    + '<div style="font-size:10px;color:rgba(255,255,255,0.5);">' + monthLabel + '</div>'
    + '</div></td></tr></table></td></tr></table>'
    + '<div style="padding:20px 24px;">'
    + sectionHdr('📅', 'This Week', 'Last 7 days')
    + statRow([
        { label: 'Raised',   value: weekTix.length, bg: '#F5F5F7', lc: '#8E8E93', vc: '#1C1C1E' },
        { label: 'Closed',   value: wClosed,         bg: '#D4EDDA', lc: '#1B7A3A', vc: '#1B7A3A' },
        { label: 'Pending',  value: weekTix.length - wClosed, bg: '#FFF3CD', lc: '#856404', vc: '#856404' },
        { label: 'Cost',     value: '₹' + fmt(wCost), bg: '#FEE8E8', lc: '#C8102E', vc: '#C8102E' }
      ])
    + sectionHdr('📋', 'Ticket Details', 'This Week')
    + ticketTable(weekTix)
    + sectionHdr('📆', 'Month to Date', monthLabel)
    + statRow([
        { label: 'Total',      value: mtdTix.length, bg: '#F5F5F7', lc: '#8E8E93', vc: '#1C1C1E' },
        { label: 'Closed',     value: mClosed,        bg: '#D4EDDA', lc: '#1B7A3A', vc: '#1B7A3A', sub: pct(mClosed, mtdTix.length) + ' closure rate' },
        { label: 'Open',       value: mOpen,          bg: '#FEE8E8', lc: '#C8102E', vc: '#C8102E' },
        { label: 'Pending AM', value: mRes,           bg: '#D1ECF1', lc: '#0C5460', vc: '#0C5460' }
      ])
    + sectionHdr('🏪', 'Cost by Store', monthLabel)
    + costTable(Object.values(storeCost).sort(function(a, b) { return b.cost - a.cost; }), 'Store')
    + sectionHdr('👤', 'Cost by Area Manager', monthLabel)
    + costTable(Object.values(amCost).sort(function(a, b) { return b.cost - a.cost; }), 'Area Manager')
    + '<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:20px;">'
    + '<tr><td style="background:linear-gradient(135deg,#1A0508,#C8102E);border-radius:10px;padding:18px 20px;text-align:center;">'
    + '<div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">🇮🇳 India Total — ' + monthLabel + '</div>'
    + '<div style="font-size:36px;font-weight:800;color:#fff;letter-spacing:-1px;">₹' + fmt(mCost) + '</div>'
    + '<div style="font-size:12px;color:rgba(255,255,255,0.5);margin-top:4px;">' + mtdTix.length + ' tickets &nbsp;·&nbsp; ' + mClosed + ' closed &nbsp;·&nbsp; ' + (mOpen + mRes) + ' pending</div>'
    + '</td></tr></table>'
    + '<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:20px;">'
    + '<tr><td style="text-align:center;">'
    + '<a href="https://opsaihub.in/maintenance-dashboard.html" style="display:inline-block;background:#C8102E;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:14px;font-weight:700;">Open Maintenance Dashboard →</a>'
    + '</td></tr></table>'
    + '</div>'
    + '<table width="100%" cellpadding="0" cellspacing="0" role="presentation">'
    + '<tr><td style="padding:16px 24px;border-top:1px solid #E5E5EA;text-align:center;font-size:11px;color:#8E8E93;">'
    + 'Tim Hortons India &nbsp;·&nbsp; OpsAIHub &nbsp;·&nbsp; <a href="https://opsaihub.in" style="color:#C8102E;text-decoration:none;">opsaihub.in</a>'
    + '</td></tr></table>';

  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<style>body{margin:0;padding:0;background:#F0F0F5;font-family:Arial,Helvetica,sans-serif;}table{border-spacing:0;}td{padding:0;}</style>'
    + '</head><body style="margin:0;padding:20px 0;background:#F0F0F5;">'
    + '<table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="center" style="padding:0 16px;">'
    + '<table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">'
    + '<tr><td>' + body + '</td></tr></table></td></tr></table></body></html>';
}

// ─── FDU Daily Digest ────────────────────────────────────────────────────────
function buildFduDailyDigest(targetDate) {
  var fduSubs  = readJSON('fdu_submissions.json', []);
  var fduLinks = readJSON('fdu_links.json', []);
  // Default to today IST — stores submit 00:01–11:30am IST, report runs at 12pm IST
  // Must use IST date: early-morning IST submissions (e.g. 1am IST = 7:30pm UTC previous day)
  // would be misclassified as yesterday if we compare raw UTC dates
  var IST_OFFSET = 5.5 * 3600000;
  var dateStr  = targetDate || new Date(Date.now() + IST_OFFSET).toISOString().slice(0, 10);
  var dateLabel = new Date(dateStr + 'T12:00:00+05:30').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Latest submission per store for that date (handles duplicates)
  // Compare by IST date so late-night IST submissions aren't misclassified by UTC rollover
  var storeMap = {};
  fduSubs.forEach(function(s) {
    var submittedIST = new Date(new Date(s.submittedAt).getTime() + IST_OFFSET).toISOString().slice(0, 10);
    if (submittedIST !== dateStr) return;
    if (!storeMap[s.store] || s.submittedAt > storeMap[s.store].submittedAt) storeMap[s.store] = s;
  });

  var totalExpected = fduLinks.length;
  var submitted     = Object.keys(storeMap).length;
  var passed        = Object.values(storeMap).filter(function(s) { return s.overallPass; }).length;
  var failed        = submitted - passed;
  var missed        = totalExpected - submitted;
  var compRate      = Math.round(passed / totalExpected * 100);

  // AM breakdown
  var amMap = {};
  fduLinks.forEach(function(link) {
    var am = link.am || 'Unassigned';
    if (!amMap[am]) amMap[am] = { am: am, total: 0, sub: 0, pass: 0, fail: 0, miss: 0 };
    amMap[am].total++;
    var s = storeMap[link.store];
    if (s) { amMap[am].sub++; s.overallPass ? amMap[am].pass++ : amMap[am].fail++; }
    else amMap[am].miss++;
  });

  function pctNum(a, b) { return b > 0 ? Math.round(a / b * 100) : 0; }
  function pctBadge(p) {
    var c  = p >= 90 ? '#34C759' : p >= 70 ? '#FF9500' : '#C8102E';
    var bg = p >= 90 ? '#D4EDDA' : p >= 70 ? '#FFF3CD' : '#FEE8E8';
    return '<span style="display:inline-block;padding:2px 8px;border-radius:5px;font-size:11px;font-weight:700;color:' + c + ';background:' + bg + ';">' + p + '%</span>';
  }
  function statRow4(tiles) {
    var w = Math.floor(100 / tiles.length);
    return '<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:4px;"><tr>'
      + tiles.map(function(t) {
          return '<td width="' + w + '%" style="padding:5px;">'
            + '<table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>'
            + '<td style="background:' + t.bg + ';border-radius:10px;padding:14px 8px;text-align:center;">'
            + '<div style="font-size:10px;font-weight:700;color:' + t.lc + ';text-transform:uppercase;letter-spacing:0.6px;margin-bottom:6px;">' + t.label + '</div>'
            + '<div style="font-size:26px;font-weight:800;color:' + t.vc + ';line-height:1;">' + t.value + '</div>'
            + (t.sub ? '<div style="font-size:10px;color:' + t.lc + ';margin-top:4px;">' + t.sub + '</div>' : '')
            + '</td></tr></table></td>';
        }).join('')
      + '</tr></table>';
  }
  function secHdr(icon, title, sub) {
    return '<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:20px 0 10px;">'
      + '<tr><td style="padding:10px 14px;background:#F5F5F7;border-radius:8px;border-left:4px solid #C8102E;">'
      + '<span style="font-size:13px;font-weight:700;color:#1C1C1E;">' + icon + ' ' + title + '</span>'
      + (sub ? '<span style="font-size:11px;color:#8E8E93;margin-left:8px;">' + sub + '</span>' : '')
      + '</td></tr></table>';
  }

  var th = 'padding:9px 10px;font-size:10px;font-weight:700;color:#8E8E93;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #E5E5EA;text-align:left;white-space:nowrap;';
  var td = 'padding:9px 10px;font-size:12px;color:#1C1C1E;border-bottom:1px solid #F0F0F5;';

  var amRows = Object.values(amMap).filter(function(a) { return a.am !== 'Unassigned'; })
    .sort(function(a, b) { return pctNum(b.pass, b.total) - pctNum(a.pass, a.total); })
    .map(function(a, i) {
      var cp = pctNum(a.pass, a.total);
      return '<tr style="background:' + (i % 2 === 0 ? '#fff' : '#FAFAFA') + ';">'
        + '<td style="' + td + '"><strong>' + a.am + '</strong></td>'
        + '<td style="' + td + ';text-align:center;">' + a.total + '</td>'
        + '<td style="' + td + ';text-align:center;">' + a.sub + '</td>'
        + '<td style="' + td + ';text-align:center;color:#34C759;font-weight:700;">' + a.pass + '</td>'
        + '<td style="' + td + ';text-align:center;color:' + (a.fail > 0 ? '#C8102E' : '#8E8E93') + ';font-weight:700;">' + a.fail + '</td>'
        + '<td style="' + td + ';text-align:center;color:' + (a.miss > 0 ? '#FF9500' : '#8E8E93') + ';font-weight:700;">' + a.miss + '</td>'
        + '<td style="' + td + ';text-align:center;">' + pctBadge(cp) + '</td>'
        + '</tr>';
    }).join('');
  var amTable = '<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;border-radius:10px;overflow:hidden;border:1px solid #E5E5EA;">'
    + '<thead><tr style="background:#F5F5F7;">'
    + '<th style="' + th + '">Area Manager</th><th style="' + th + ';text-align:center;">Expected</th>'
    + '<th style="' + th + ';text-align:center;">Submitted</th><th style="' + th + ';text-align:center;">Pass</th>'
    + '<th style="' + th + ';text-align:center;">Fail</th><th style="' + th + ';text-align:center;">Missed</th>'
    + '<th style="' + th + ';text-align:center;">Compliance</th>'
    + '</tr></thead><tbody>' + amRows + '</tbody></table>';

  // Failed stores
  var failedStores = fduLinks.filter(function(l) { var s = storeMap[l.store]; return s && !s.overallPass; });
  var failedTable = failedStores.length
    ? '<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;border-radius:10px;overflow:hidden;border:1px solid #FEE8E8;">'
      + '<thead><tr style="background:#FFF5F5;"><th style="' + th + '">Store</th><th style="' + th + '">AM</th><th style="' + th + '">Failed Checks</th><th style="' + th + '">AI Summary</th></tr></thead><tbody>'
      + failedStores.map(function(l, i) {
          var s = storeMap[l.store];
          var issues = ['topRow','midRow','timbits','water','tags'].filter(function(f) { return s[f] && s[f] !== 'Pass'; }).join(', ') || '—';
          return '<tr style="background:' + (i%2===0 ? '#fff' : '#FAFAFA') + ';">'
            + '<td style="' + td + '"><strong>' + l.store + '</strong></td>'
            + '<td style="' + td + '">' + l.am + '</td>'
            + '<td style="' + td + ';color:#C8102E;">' + issues + '</td>'
            + '<td style="' + td + ';font-size:11px;color:#3A3A3C;">' + (s.summary || '—') + '</td></tr>';
        }).join('')
      + '</tbody></table>'
    : '<p style="font-size:13px;color:#34C759;text-align:center;padding:12px 0;font-weight:700;">🎉 All submitted stores passed today!</p>';

  // Missed stores
  var missedStores = fduLinks.filter(function(l) { return !storeMap[l.store]; });
  var missedTable = missedStores.length
    ? '<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;border-radius:10px;overflow:hidden;border:1px solid #FFF3CD;">'
      + '<thead><tr style="background:#FFFBF0;"><th style="' + th + '">Store</th><th style="' + th + '">Area Manager</th></tr></thead><tbody>'
      + missedStores.map(function(l, i) {
          return '<tr style="background:' + (i%2===0 ? '#fff' : '#FAFAFA') + ';">'
            + '<td style="' + td + '"><strong>' + l.store + '</strong></td>'
            + '<td style="' + td + '">' + l.am + '</td></tr>';
        }).join('')
      + '</tbody></table>'
    : '<p style="font-size:13px;color:#34C759;text-align:center;padding:12px 0;font-weight:700;">✅ All 44 stores submitted today!</p>';

  var cc = compRate >= 90 ? '#34C759' : compRate >= 70 ? '#FF9500' : '#C8102E';
  var body = '<table width="100%" cellpadding="0" cellspacing="0" role="presentation">'
    + '<tr><td style="background:linear-gradient(135deg,#1A0508,#C8102E);padding:24px 28px;">'
    + '<div style="font-size:20px;font-weight:800;color:#fff;letter-spacing:-0.5px;">☕ FDU Daily Compliance Report</div>'
    + '<div style="font-size:13px;color:rgba(255,255,255,0.7);margin-top:4px;">' + dateLabel + '</div>'
    + '</td></tr></table>'
    + '<div style="padding:16px 16px 0;">'
    + statRow4([
        { label: 'Expected',    value: totalExpected, bg: '#F5F5F7', lc: '#8E8E93', vc: '#1C1C1E' },
        { label: 'Submitted',   value: submitted,     bg: '#EBF5FF', lc: '#007AFF', vc: '#007AFF' },
        { label: 'Passed',      value: passed,        bg: '#EDFBF2', lc: '#1B7A3A', vc: '#34C759' },
        { label: 'Failed',      value: failed,        bg: failed > 0 ? '#FEE8E8' : '#F5F5F7', lc: failed > 0 ? '#C8102E' : '#8E8E93', vc: failed > 0 ? '#C8102E' : '#8E8E93' }
      ])
    + statRow4([
        { label: 'Missed',      value: missed,        bg: missed > 0 ? '#FFF3CD' : '#F5F5F7', lc: missed > 0 ? '#856404' : '#8E8E93', vc: missed > 0 ? '#FF9500' : '#8E8E93' },
        { label: 'Compliance',  value: compRate + '%', bg: cc + '22', lc: cc, vc: cc, sub: 'of all 44 stores' },
        { label: 'On-Time Subs', value: Object.values(storeMap).filter(function(s){return s.onTime;}).length, bg: '#F5F0FF', lc: '#6B21A8', vc: '#9333EA' },
        { label: 'Late Subs',    value: Object.values(storeMap).filter(function(s){return !s.onTime;}).length, bg: '#F5F5F7', lc: '#8E8E93', vc: '#3A3A3C' }
      ])
    + secHdr('👤', 'Area Manager Summary', dateLabel)
    + amTable
    + secHdr('❌', 'Failed Stores', failed + ' store' + (failed !== 1 ? 's' : '') + ' failed checks')
    + failedTable
    + secHdr('⏳', 'Missed Submissions', missed + ' store' + (missed !== 1 ? 's' : '') + ' did not submit today')
    + missedTable
    + '<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:20px;">'
    + '<tr><td style="text-align:center;"><a href="https://opsaihub.in/fdu-dashboard.html" style="display:inline-block;background:#C8102E;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:14px;font-weight:700;">Open FDU Dashboard →</a></td></tr></table>'
    + '</div>'
    + '<table width="100%" cellpadding="0" cellspacing="0" role="presentation">'
    + '<tr><td style="padding:16px 24px;border-top:1px solid #E5E5EA;text-align:center;font-size:11px;color:#8E8E93;">'
    + 'Tim Hortons India &nbsp;·&nbsp; OpsAIHub &nbsp;·&nbsp; <a href="https://opsaihub.in" style="color:#C8102E;text-decoration:none;">opsaihub.in</a>'
    + '</td></tr></table>';

  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<style>body{margin:0;padding:0;background:#F0F0F5;font-family:Arial,Helvetica,sans-serif;}table{border-spacing:0;}td{padding:0;}</style>'
    + '</head><body style="margin:0;padding:20px 0;background:#F0F0F5;">'
    + '<table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="center" style="padding:0 16px;">'
    + '<table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">'
    + '<tr><td>' + body + '</td></tr></table></td></tr></table></body></html>';
}

// ─── FDU Monthly Digest ───────────────────────────────────────────────────────
function buildFduMonthlyDigest(forYear, forMonth) {
  var fduSubs  = readJSON('fdu_submissions.json', []);
  var fduLinks = readJSON('fdu_links.json', []);
  var now = new Date();
  // default = previous calendar month
  var refDate  = new Date(forYear || now.getFullYear(), forMonth != null ? forMonth : now.getMonth() - 1, 1);
  var y = refDate.getFullYear(), m = refDate.getMonth();
  var monthStart  = new Date(y, m, 1).toISOString().slice(0, 10);
  var monthEnd    = new Date(y, m + 1, 0).toISOString().slice(0, 10);
  var daysInMonth = new Date(y, m + 1, 0).getDate();
  var monthLabel  = new Date(y, m, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  // Deduplicate: latest sub per store per day
  var dayStoreMap = {};
  fduSubs.forEach(function(s) {
    var d = (s.submittedAt || '').slice(0, 10);
    if (d < monthStart || d > monthEnd) return;
    var key = d + '|' + s.store;
    if (!dayStoreMap[key] || s.submittedAt > dayStoreMap[key].submittedAt) dayStoreMap[key] = s;
  });
  var uniqSubs = Object.values(dayStoreMap);

  var totalSubs = uniqSubs.length;
  var totalPass = uniqSubs.filter(function(s) { return s.overallPass; }).length;
  var totalFail = totalSubs - totalPass;
  var maxExpected = fduLinks.length * daysInMonth;
  var compRate = Math.round(totalPass / maxExpected * 100);
  var submitRate = Math.round(totalSubs / maxExpected * 100);

  // AM map
  var amMap = {};
  fduLinks.forEach(function(l) {
    var am = l.am || 'Unassigned';
    if (!amMap[am]) amMap[am] = { am: am, stores: 0, subs: 0, pass: 0, fail: 0 };
    amMap[am].stores++;
  });
  uniqSubs.forEach(function(s) {
    var link = fduLinks.find(function(l) { return l.store === s.store; });
    var am = link ? (link.am || 'Unassigned') : 'Unassigned';
    if (!amMap[am]) amMap[am] = { am: am, stores: 0, subs: 0, pass: 0, fail: 0 };
    amMap[am].subs++;
    s.overallPass ? amMap[am].pass++ : amMap[am].fail++;
  });

  // Store map
  var storeMap = {};
  fduLinks.forEach(function(l) { storeMap[l.store] = { store: l.store, am: l.am, subs: 0, pass: 0, fail: 0 }; });
  uniqSubs.forEach(function(s) {
    if (!storeMap[s.store]) storeMap[s.store] = { store: s.store, am: s.am || '', subs: 0, pass: 0, fail: 0 };
    storeMap[s.store].subs++;
    s.overallPass ? storeMap[s.store].pass++ : storeMap[s.store].fail++;
  });

  // Category failures
  var cats = { topRow: 0, midRow: 0, timbits: 0, water: 0, tags: 0 };
  var catLabels = { topRow: 'Top Row', midRow: 'Mid Row', timbits: 'Timbits', water: 'Water', tags: 'Tags' };
  uniqSubs.forEach(function(s) {
    Object.keys(cats).forEach(function(c) { if (s[c] && s[c] !== 'Pass') cats[c]++; });
  });

  function pctNum(a, b) { return b > 0 ? Math.round(a / b * 100) : 0; }
  function pctBadge(p) {
    var c  = p >= 90 ? '#34C759' : p >= 70 ? '#FF9500' : '#C8102E';
    var bg = p >= 90 ? '#D4EDDA' : p >= 70 ? '#FFF3CD' : '#FEE8E8';
    return '<span style="display:inline-block;padding:2px 8px;border-radius:5px;font-size:11px;font-weight:700;color:' + c + ';background:' + bg + ';">' + p + '%</span>';
  }
  function statRow4(tiles) {
    var w = Math.floor(100 / tiles.length);
    return '<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:4px;"><tr>'
      + tiles.map(function(t) {
          return '<td width="' + w + '%" style="padding:5px;">'
            + '<table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>'
            + '<td style="background:' + t.bg + ';border-radius:10px;padding:14px 8px;text-align:center;">'
            + '<div style="font-size:10px;font-weight:700;color:' + t.lc + ';text-transform:uppercase;letter-spacing:0.6px;margin-bottom:6px;">' + t.label + '</div>'
            + '<div style="font-size:26px;font-weight:800;color:' + t.vc + ';line-height:1;">' + t.value + '</div>'
            + (t.sub ? '<div style="font-size:10px;color:' + t.lc + ';margin-top:4px;">' + t.sub + '</div>' : '')
            + '</td></tr></table></td>';
        }).join('')
      + '</tr></table>';
  }
  function secHdr(icon, title, sub) {
    return '<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:20px 0 10px;">'
      + '<tr><td style="padding:10px 14px;background:#F5F5F7;border-radius:8px;border-left:4px solid #C8102E;">'
      + '<span style="font-size:13px;font-weight:700;color:#1C1C1E;">' + icon + ' ' + title + '</span>'
      + (sub ? '<span style="font-size:11px;color:#8E8E93;margin-left:8px;">' + sub + '</span>' : '')
      + '</td></tr></table>';
  }

  var th = 'padding:9px 10px;font-size:10px;font-weight:700;color:#8E8E93;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #E5E5EA;text-align:left;white-space:nowrap;';
  var td = 'padding:9px 10px;font-size:12px;color:#1C1C1E;border-bottom:1px solid #F0F0F5;';

  // AM table
  var amTable = '<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;border-radius:10px;overflow:hidden;border:1px solid #E5E5EA;">'
    + '<thead><tr style="background:#F5F5F7;">'
    + '<th style="' + th + '">Area Manager</th><th style="' + th + ';text-align:center;">Submissions</th>'
    + '<th style="' + th + ';text-align:center;">Pass</th><th style="' + th + ';text-align:center;">Fail</th>'
    + '<th style="' + th + ';text-align:center;">Pass%</th><th style="' + th + ';text-align:center;">Submit%</th>'
    + '</tr></thead><tbody>'
    + Object.values(amMap).filter(function(a) { return a.am !== 'Unassigned'; })
        .sort(function(a, b) { return pctNum(b.pass, b.subs) - pctNum(a.pass, a.subs); })
        .map(function(a, i) {
          var cp   = pctNum(a.pass, a.subs);
          var subP = pctNum(a.subs, a.stores * daysInMonth);
          return '<tr style="background:' + (i%2===0?'#fff':'#FAFAFA') + ';">'
            + '<td style="' + td + '"><strong>' + a.am + '</strong><br><span style="font-size:10px;color:#8E8E93;">' + a.stores + ' stores</span></td>'
            + '<td style="' + td + ';text-align:center;">' + a.subs + '</td>'
            + '<td style="' + td + ';text-align:center;color:#34C759;font-weight:700;">' + a.pass + '</td>'
            + '<td style="' + td + ';text-align:center;color:' + (a.fail > 0 ? '#C8102E' : '#8E8E93') + ';font-weight:700;">' + a.fail + '</td>'
            + '<td style="' + td + ';text-align:center;">' + pctBadge(cp) + '</td>'
            + '<td style="' + td + ';text-align:center;font-size:11px;color:#8E8E93;">' + subP + '%</td></tr>';
        }).join('')
    + '</tbody></table>';

  // Store table (worst pass% first)
  var storeTable = '<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;border-radius:10px;overflow:hidden;border:1px solid #E5E5EA;">'
    + '<thead><tr style="background:#F5F5F7;">'
    + '<th style="' + th + '">Store</th><th style="' + th + ';text-align:center;">Submissions</th>'
    + '<th style="' + th + ';text-align:center;">Pass</th><th style="' + th + ';text-align:center;">Fail</th>'
    + '<th style="' + th + ';text-align:center;">Pass%</th><th style="' + th + ';text-align:center;">Submit%</th>'
    + '</tr></thead><tbody>'
    + Object.values(storeMap)
        .sort(function(a, b) { return pctNum(a.pass, a.subs || 1) - pctNum(b.pass, b.subs || 1); })
        .map(function(s, i) {
          var cp   = s.subs > 0 ? pctNum(s.pass, s.subs) : 0;
          var subP = pctNum(s.subs, daysInMonth);
          return '<tr style="background:' + (i%2===0?'#fff':'#FAFAFA') + ';">'
            + '<td style="' + td + '"><strong>' + s.store + '</strong><br><span style="font-size:10px;color:#8E8E93;">' + (s.am || '—') + '</span></td>'
            + '<td style="' + td + ';text-align:center;">' + s.subs + '</td>'
            + '<td style="' + td + ';text-align:center;color:#34C759;font-weight:700;">' + s.pass + '</td>'
            + '<td style="' + td + ';text-align:center;color:' + (s.fail > 0 ? '#C8102E' : '#8E8E93') + ';font-weight:700;">' + s.fail + '</td>'
            + '<td style="' + td + ';text-align:center;">' + pctBadge(cp) + '</td>'
            + '<td style="' + td + ';text-align:center;font-size:11px;color:#8E8E93;">' + subP + '%</td></tr>';
        }).join('')
    + '</tbody></table>';

  // Category failures
  var maxCat = Math.max.apply(null, Object.values(cats));
  var catTable = '<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;border-radius:10px;overflow:hidden;border:1px solid #E5E5EA;">'
    + '<thead><tr style="background:#F5F5F7;"><th style="' + th + '">Check Category</th><th style="' + th + ';text-align:center;">Failures</th><th style="' + th + '">Distribution</th></tr></thead><tbody>'
    + Object.keys(cats).sort(function(a, b) { return cats[b] - cats[a]; }).map(function(c, i) {
        var bar = maxCat > 0 ? Math.round(cats[c] / maxCat * 100) : 0;
        return '<tr style="background:' + (i%2===0?'#fff':'#FAFAFA') + ';">'
          + '<td style="' + td + '"><strong>' + catLabels[c] + '</strong></td>'
          + '<td style="' + td + ';text-align:center;font-weight:700;color:' + (cats[c] > 0 ? '#C8102E' : '#8E8E93') + ';">' + cats[c] + '</td>'
          + '<td style="' + td + ';width:50%;">'
          + '<table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>'
          + '<td style="width:' + bar + '%;background:linear-gradient(90deg,#C8102E,#E8485C);height:8px;border-radius:4px;"></td>'
          + '<td style="width:' + (100-bar) + '%;background:#F0F0F5;height:8px;border-radius:4px;"></td>'
          + '</tr></table></td></tr>';
      }).join('')
    + '</tbody></table>';

  var cc = compRate >= 80 ? '#34C759' : compRate >= 60 ? '#FF9500' : '#C8102E';
  var body = '<table width="100%" cellpadding="0" cellspacing="0" role="presentation">'
    + '<tr><td style="background:linear-gradient(135deg,#1A0508,#C8102E);padding:24px 28px;">'
    + '<div style="font-size:20px;font-weight:800;color:#fff;letter-spacing:-0.5px;">☕ FDU Monthly Performance Report</div>'
    + '<div style="font-size:13px;color:rgba(255,255,255,0.7);margin-top:4px;">' + monthLabel + ' — Full Month Review</div>'
    + '</td></tr></table>'
    + '<div style="padding:16px 16px 0;">'
    + statRow4([
        { label: 'Total Submissions', value: totalSubs,  bg: '#EBF5FF', lc: '#007AFF', vc: '#007AFF', sub: 'unique store-days' },
        { label: 'Passed',           value: totalPass,  bg: '#EDFBF2', lc: '#1B7A3A', vc: '#34C759' },
        { label: 'Failed',           value: totalFail,  bg: totalFail > 0 ? '#FEE8E8' : '#F5F5F7', lc: totalFail > 0 ? '#C8102E' : '#8E8E93', vc: totalFail > 0 ? '#C8102E' : '#8E8E93' },
        { label: 'Compliance%',      value: compRate + '%', bg: cc + '22', lc: cc, vc: cc, sub: 'of max possible' }
      ])
    + statRow4([
        { label: 'Days in Month',    value: daysInMonth, bg: '#F5F5F7', lc: '#8E8E93', vc: '#1C1C1E' },
        { label: 'Stores Active',    value: fduLinks.length, bg: '#F5F0FF', lc: '#6B21A8', vc: '#9333EA' },
        { label: 'Submit Rate',      value: submitRate + '%', bg: '#FFF3CD', lc: '#856404', vc: '#FF9500', sub: 'vs expected' },
        { label: 'Fail Rate',        value: Math.round(totalFail / (totalSubs || 1) * 100) + '%', bg: '#F5F5F7', lc: '#8E8E93', vc: '#3A3A3C', sub: 'of submitted' }
      ])
    + secHdr('👤', 'Area Manager Performance', monthLabel)
    + amTable
    + secHdr('🏪', 'Store-wise Compliance', 'Worst performers first · ' + daysInMonth + ' days in month')
    + storeTable
    + secHdr('📊', 'Failure Category Breakdown', monthLabel)
    + catTable
    + '<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:20px;">'
    + '<tr><td style="text-align:center;"><a href="https://opsaihub.in/fdu-dashboard.html" style="display:inline-block;background:#C8102E;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:14px;font-weight:700;">Open FDU Dashboard →</a></td></tr></table>'
    + '</div>'
    + '<table width="100%" cellpadding="0" cellspacing="0" role="presentation">'
    + '<tr><td style="padding:16px 24px;border-top:1px solid #E5E5EA;text-align:center;font-size:11px;color:#8E8E93;">'
    + 'Tim Hortons India &nbsp;·&nbsp; OpsAIHub &nbsp;·&nbsp; <a href="https://opsaihub.in" style="color:#C8102E;text-decoration:none;">opsaihub.in</a>'
    + '</td></tr></table>';

  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<style>body{margin:0;padding:0;background:#F0F0F5;font-family:Arial,Helvetica,sans-serif;}table{border-spacing:0;}td{padding:0;}</style>'
    + '</head><body style="margin:0;padding:20px 0;background:#F0F0F5;">'
    + '<table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="center" style="padding:0 16px;">'
    + '<table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">'
    + '<tr><td>' + body + '</td></tr></table></td></tr></table></body></html>';
}

function fduRecipients() {
  var r = Object.values(AM_EMAILS).filter(Boolean);
  r.push(HOD_EMAIL, CEO_EMAIL);
  return r.filter(function(e, i, a) { return a.indexOf(e) === i; });
}

// 12:00 PM IST daily — FDU daily report
cron.schedule('0 12 * * *', function() {
  try {
    var html = buildFduDailyDigest(null);
    var now  = new Date();
    var subj = '☕ FDU Daily Report — ' + now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    fduRecipients().forEach(function(e) { sendEmail(e, subj, html); });
    console.log('[CRON] FDU daily digest sent');
  } catch (err) { console.error('[CRON] FDU daily digest error:', err.message); }
}, { timezone: 'Asia/Kolkata' });

// 9:00 AM IST on 1st of every month — FDU monthly report (covers previous month)
cron.schedule('0 9 1 * *', function() {
  try {
    var html = buildFduMonthlyDigest(null, null);
    var prev = new Date(); prev.setDate(0); // last day of prev month
    var subj = '☕ FDU Monthly Report — ' + prev.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    fduRecipients().forEach(function(e) { sendEmail(e, subj, html); });
    console.log('[CRON] FDU monthly digest sent');
  } catch (err) { console.error('[CRON] FDU monthly digest error:', err.message); }
}, { timezone: 'Asia/Kolkata' });

cron.schedule('0 9 * * 1', function() {
  try {
    var html = buildMaintenanceDigest(false);
    var now  = new Date();
    var recipients = Object.values(AM_EMAILS).filter(Boolean);
    recipients.push(MAINTENANCE_EMAIL, HOD_EMAIL, CEO_EMAIL);
    var unique = recipients.filter(function(e, i, a) { return a.indexOf(e) === i; });
    var subject = '🔧 Maintenance Weekly Report — ' + now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    unique.forEach(function(email) { sendEmail(email, subject, html); });
    console.log('[CRON] Maintenance digest sent to', unique.length, 'recipients');
    // Delete all maintenance photos post-digest to reclaim storage
    var maintDir = path.join(__dirname, 'uploads', 'maintenance');
    fs.readdir(maintDir, function(err, files) {
      if (err || !files || !files.length) return;
      var deleted = 0;
      files.forEach(function(f) {
        fs.unlink(path.join(maintDir, f), function(e) { if (!e) deleted++; });
      });
      // Clear photos arrays in all tickets so dashboard doesn't show broken links
      var tickets = readJSON('maintenance_tickets.json', []);
      var changed = false;
      tickets.forEach(function(t) { if (t.photos && t.photos.length) { t.photos = []; changed = true; } });
      if (changed) writeJSON('maintenance_tickets.json', tickets);
      console.log('[CLEANUP] Deleted maintenance photos:', files.length, 'files');
    });
  } catch (err) {
    console.error('[CRON] Maintenance digest error:', err.message);
  }
}, { timezone: 'Asia/Kolkata' });

// 10:00 AM IST every Wednesday — Udeep open-ticket closure reminder
cron.schedule('0 10 * * 3', function() {
  try {
    var tickets = readJSON('maintenance_tickets.json', []);
    var open = tickets.filter(function(t) { return t.status === 'open'; });
    var resolved = tickets.filter(function(t) { return t.status === 'resolved'; });
    var totalOpen = open.length + resolved.length;
    if (!totalOpen) return;

    var p1 = open.filter(function(t) { return t.priority === 'p1'; });
    var urgent = open.filter(function(t) { return t.priority === 'urgent'; });
    var normal = open.filter(function(t) { return t.priority === 'normal'; });

    function fmt(n) { return Number(n || 0).toLocaleString('en-IN'); }
    function priBadge(p) {
      if (p === 'p1') return '<span style="display:inline-block;padding:2px 7px;border-radius:5px;font-size:10px;font-weight:700;color:#fff;background:#C8102E;">⚡ P1</span>';
      if (p === 'urgent') return '<span style="display:inline-block;padding:2px 7px;border-radius:5px;font-size:10px;font-weight:700;color:#C8102E;background:#FEE8E8;">🔴 Urgent</span>';
      return '<span style="display:inline-block;padding:2px 7px;border-radius:5px;font-size:10px;font-weight:700;color:#1B7A3A;background:#D4EDDA;">🟢 Normal</span>';
    }
    function daysSince(iso) {
      if (!iso) return '—';
      return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) + 'd';
    }
    function ticketRow(t) {
      return '<tr>'
        + '<td style="padding:8px 10px;border-bottom:1px solid #F0F0F5;font-size:12px;"><strong>' + t.store + '</strong><br><span style="font-size:10px;color:#8E8E93;">' + (t.am || 'Unassigned') + '</span></td>'
        + '<td style="padding:8px 10px;border-bottom:1px solid #F0F0F5;font-size:12px;">' + t.category + '</td>'
        + '<td style="padding:8px 10px;border-bottom:1px solid #F0F0F5;">' + priBadge(t.priority) + '</td>'
        + '<td style="padding:8px 10px;border-bottom:1px solid #F0F0F5;font-size:12px;color:#8E8E93;">' + daysSince(t.submittedAt) + '</td>'
        + '<td style="padding:8px 10px;border-bottom:1px solid #F0F0F5;font-size:11px;color:#3A3A3C;">' + (t.description || '').substring(0, 80) + '</td>'
        + '</tr>';
    }

    var th = 'padding:9px 10px;font-size:10px;font-weight:700;color:#8E8E93;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #E5E5EA;text-align:left;';
    var allRows = open.map(ticketRow).join('') + resolved.map(ticketRow).join('');

    var html = eWrap(
      '<div style="font-size:22px;font-weight:800;color:#1C1C1E;margin-bottom:4px;">🔧 Weekly Maintenance Closure Reminder</div>'
      + '<div style="font-size:13px;color:#8E8E93;margin-bottom:20px;">Hi Udeep — these tickets are still open and need your attention.</div>'

      + '<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:20px;"><tr>'
      + '<td width="33%" style="padding:5px;"><table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>'
      + '<td style="background:#C8102E;border-radius:10px;padding:16px 8px;text-align:center;">'
      + '<div style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:6px;">Open Tickets</div>'
      + '<div style="font-size:30px;font-weight:800;color:#fff;line-height:1;">' + open.length + '</div>'
      + (p1.length ? '<div style="font-size:11px;color:#FFD60A;margin-top:5px;">⚡ ' + p1.length + ' P1 Critical</div>' : '')
      + '</td></tr></table></td>'
      + '<td width="33%" style="padding:5px;"><table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>'
      + '<td style="background:#FF9500;border-radius:10px;padding:16px 8px;text-align:center;">'
      + '<div style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:6px;">Awaiting Verification</div>'
      + '<div style="font-size:30px;font-weight:800;color:#fff;line-height:1;">' + resolved.length + '</div>'
      + '</td></tr></table></td>'
      + '<td width="33%" style="padding:5px;"><table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>'
      + '<td style="background:#34C759;border-radius:10px;padding:16px 8px;text-align:center;">'
      + '<div style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:6px;">Urgent Open</div>'
      + '<div style="font-size:30px;font-weight:800;color:#fff;line-height:1;">' + urgent.length + '</div>'
      + '</td></tr></table></td>'
      + '</tr></table>'

      + '<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;border-radius:10px;overflow:hidden;border:1px solid #E5E5EA;margin-bottom:20px;">'
      + '<thead><tr style="background:#F5F5F7;">'
      + '<th style="' + th + '">Store / AM</th><th style="' + th + '">Category</th><th style="' + th + '">Priority</th>'
      + '<th style="' + th + '">Age</th><th style="' + th + '">Issue</th>'
      + '</tr></thead><tbody>' + allRows + '</tbody></table>'

      + '<p style="font-size:13px;color:#3A3A3C;line-height:1.6;">Please resolve these tickets and update the dashboard. P1 Critical tickets need <strong>immediate attention</strong>.</p>'
      + eBtn('Open Maintenance Dashboard', 'https://opsaihub.in/maintenance-dashboard.html'),
      "Tim's Ops Connect", 'Weekly Maintenance Reminder'
    );

    var now = new Date();
    var subject = '🔧 [' + totalOpen + ' Open] Maintenance Closure Reminder — Week of ' + now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    sendEmail(MAINTENANCE_EMAIL, subject, html);
    console.log('[CRON] Maintenance closure reminder sent to Udeep —', totalOpen, 'open tickets');
  } catch (err) {
    console.error('[CRON] Maintenance reminder error:', err.message);
  }
}, { timezone: 'Asia/Kolkata' });

// 3:00 PM IST — afternoon checklist reminder
cron.schedule('0 15 * * *', function() {
  var subs = readJSON('push_subscriptions.json', []);
  if (!subs.length) return;
  pushAll(subs, { title: 'Afternoon check-in 📋', body: 'Don\'t forget to submit your afternoon checklist before end of day.', tag: 'checklist', url: '/index.html', requireInteraction: true }, function(r) {
    console.log('[PUSH] Checklist reminder sent:', r);
  });
}, { timezone: 'Asia/Kolkata' });

app.get('/api/fy27-targets', function(req, res) {
  try { var data = readJSON('fy27_targets.json', {}); res.json(data); }
  catch(err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/delivery', function(req, res) {
  try {
    var data = readJSON('delivery.json', []);
    var month = req.query.month;
    if (month) data = data.filter(function(d) { return d.month === month; });
    res.json({ success: true, data: data });
  } catch(err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/delivery', function(req, res) {
  try {
    var data = readJSON('delivery.json', []);
    var payload = req.body;
    if (!payload.store || !payload.month) {
      return res.status(400).json({ success: false, error: 'Missing required fields: store, month' });
    }
    payload.id = Date.now().toString();
    var idx = data.findIndex(function(d) { return d.store === payload.store && d.month === payload.month; });
    if (idx >= 0) data[idx] = payload;
    else data.push(payload);
    writeJSON('delivery.json', data);
    res.json({ success: true });
  } catch(err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/issues', function(req, res) {
  try { res.json({ success: true, data: readJSON('issues.json', []) }); }
  catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('/api/health-scores', function(req, res) {
  try { res.json({ success: true, data: (readJSON('health_scores.json', {})).stores || [] }); }
  catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('/api/world-events', function(req, res) {
  try {
    var data = readJSON('world_events.json', { events: [] });
    res.json({ success: true, data: data.events, lastUpdated: data.lastUpdated });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('/health', function(req, res) {
  res.json({ status: 'ok', env: process.env.NODE_ENV || 'staging', port: PORT, uptime: Math.floor(process.uptime()), timestamp: new Date().toISOString() });
});

app.get('/api/checklist/:day', function(req, res) {
  try {
    const items = readJSON('checklist-items.json', {});
    const day = req.params.day.toLowerCase();
    res.json({ success: true, day: day, data: items[day] || [] });
  } catch(err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/performance', function(req, res) {
  try {
    let data = readJSON('performance.json', []);
    if (req.query.am) data = data.filter(function(p) { return p.am === req.query.am; });
    res.json({ success: true, data: data });
  } catch(err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/coverage', function(req, res) {
  try {
    var all = readJSON('coverage.json', []);
    var am = req.query.am;
    var month = req.query.month;
    var filtered = all;
    if (am) filtered = filtered.filter(function(c) { return c.am === am; });
    if (month) {
      var monthFiltered = filtered.filter(function(c) { return c.month === month; });
      if (monthFiltered.length === 0 && filtered.length > 0) {
        filtered.sort(function(a, b) { return b.month.localeCompare(a.month); });
        var latestMonth = filtered[0].month;
        monthFiltered = filtered.filter(function(c) { return c.month === latestMonth; });
        res.json({ success: true, data: monthFiltered, note: 'No data for ' + month + ', showing ' + latestMonth });
        return;
      }
      filtered = monthFiltered;
    }
    res.json({ success: true, data: filtered });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/coverage', function(req, res) {
  try {
    const coverage = readJSON('coverage.json', []);
    const am = req.body.am, month = req.body.month, store = req.body.store, day = req.body.day;
    if (!am || !month || !store || !day) {
      return res.status(400).json({ success: false, error: 'Missing required fields: am, month, store, day' });
    }
    let amRec = null;
    for (var i = 0; i < coverage.length; i++) { if (coverage[i].am === am && coverage[i].month === month) { amRec = coverage[i]; break; } }
    if (!amRec) { amRec = { am: am, month: month, stores: [] }; coverage.push(amRec); }
    let storeRec = null;
    for (var j = 0; j < amRec.stores.length; j++) { if (amRec.stores[j].store === store) { storeRec = amRec.stores[j]; break; } }
    if (!storeRec) { storeRec = { store: store, wed: false, fri: false, sat: false, sun: false }; amRec.stores.push(storeRec); }
    if (day === 'wed' || day === 'fri' || day === 'sat' || day === 'sun') storeRec[day] = true;
    if (!writeJSON('coverage.json', coverage)) return res.status(500).json({ success: false, error: 'Save failed' });
    res.json({ success: true });
  } catch(err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/products', function(req, res) {
  try { res.json({ success: true, data: readJSON('products.json', []) }); }
  catch(err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/products', function(req, res) {
  try {
    if (!req.body.name) {
      return res.status(400).json({ success: false, error: 'Missing required field: name' });
    }
    var data = readJSON('products.json', []);
    data.unshift(req.body);
    writeJSON('products.json', data);
    res.json({ success: true });
  } catch(err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/projects', function(req, res) {
  try { res.json({ success: true, data: readJSON('projects.json', []) }); }
  catch(err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/projects', function(req, res) {
  try {
    if (!req.body.name) {
      return res.status(400).json({ success: false, error: 'Missing required field: name' });
    }
    var data = readJSON('projects.json', []);
    data.push(req.body);
    writeJSON('projects.json', data);
    res.json({ success: true });
  } catch(err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/training', function(req, res) {
  try { res.json({ success: true, data: readJSON('training.json', []) }); }
  catch(err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/training', function(req, res) {
  try {
    var payload = req.body;
    if (!payload.store || !payload.am) {
      return res.status(400).json({ success: false, error: 'Missing required fields: store, am' });
    }
    var data = readJSON('training.json', []);
    var idx = data.findIndex(function(d) { return d.store === payload.store; });
    if (idx >= 0) data[idx] = payload; else data.push(payload);
    writeJSON('training.json', data);
    res.json({ success: true });
  } catch(err) { res.status(500).json({ success: false, error: err.message }); }
});

const uploadsDir = path.join(__dirname, 'uploads', 'checklist');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

app.use('/uploads/profiles', express.static('uploads/profiles'));
app.use('/uploads/events', express.static('uploads/events'));
app.use('/uploads/feed', express.static('uploads/feed'));
app.use('/uploads/checklist', express.static('uploads/checklist'));
app.use('/uploads/fdu', express.static(path.join(__dirname, 'uploads/fdu')));
app.use('/uploads/donuts', express.static(path.join(__dirname, 'uploads/donuts')));
app.use('/uploads/sap', express.static('uploads/sap'));
app.use('/uploads/task-proof', express.static('uploads/task-proof'));
app.use('/uploads/maintenance', express.static(path.join(__dirname, 'uploads/maintenance')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/maintenance', require('./routes/maintenance'));
app.use('/api/submissions', require('./routes/submissions'));
app.use('/api/stores', require('./routes/stores'));
app.use('/api/fdu', require('./routes/fdu'));

// FDU digest test endpoints (HOD_SECRET in .env, or fixed fallback)
var FDU_SECRET = process.env.HOD_SECRET || 'opsaihub2025';
app.get('/api/fdu/test-daily-digest', function(req, res) {
  if (req.query.secret !== FDU_SECRET) return res.status(401).json({ success: false, error: 'Unauthorized' });
  try {
    var date = req.query.date || null; // optional ?date=2026-06-26
    var html = buildFduDailyDigest(date);
    var subj = '☕ [TEST] FDU Daily Report — ' + (date || new Date().toISOString().slice(0, 10));
    fduRecipients().forEach(function(e) { sendEmail(e, subj, html); });
    res.json({ success: true, sent: fduRecipients().length });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});
app.get('/api/fdu/test-monthly-digest', function(req, res) {
  if (req.query.secret !== FDU_SECRET) return res.status(401).json({ success: false, error: 'Unauthorized' });
  try {
    // optional ?year=2026&month=5 (0-based month, so 5=June)
    var year  = req.query.year  ? parseInt(req.query.year)  : null;
    var month = req.query.month ? parseInt(req.query.month) : null;
    var html  = buildFduMonthlyDigest(year, month);
    var prev  = month != null ? new Date(year || new Date().getFullYear(), month, 1) : (function(){ var d=new Date(); d.setDate(0); return d; })();
    var subj  = '☕ [TEST] FDU Monthly Report — ' + prev.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    fduRecipients().forEach(function(e) { sendEmail(e, subj, html); });
    res.json({ success: true, sent: fduRecipients().length });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});
app.use('/api/posts', require('./routes/posts'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/events', require('./routes/events'));
app.use('/api/audits', require('./routes/audits'));
app.use('/api/cash-audit', require('./routes/cash-audit'));
app.use('/api/news', require('./routes/news'));
app.use('/api/push', require('./routes/push').router);

// Profile picture upload
const multer = require('multer');
const profileUpload = multer({
  storage: multer.diskStorage({
    destination: function(req, file, cb) {
      var dir = path.join(__dirname, 'uploads', 'profiles');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: function(req, file, cb) {
      var ext = path.extname(file.originalname) || '.jpg';
      cb(null, Date.now() + '-' + Math.random().toString(36).substr(2,6) + ext);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function(req, file, cb) {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'));
  }
});

app.post('/api/profile/photo', profileUpload.single('photo'), function(req, res) {
  if (!req.file) return res.json({ success: false, error: 'No file uploaded' });
  var url = '/uploads/profiles/' + req.file.filename;
  var am = req.body.am || '';
  if (am) {
    var dataFile = path.join(__dirname, 'data', 'profile-photos.json');
    var photos = {};
    try { photos = JSON.parse(fs.readFileSync(dataFile, 'utf8')); } catch(e) {}
    photos[am] = url;
    fs.writeFileSync(dataFile, JSON.stringify(photos, null, 2));
  }
  res.json({ success: true, url: url });
});

app.get('/api/profile/photo/:am', function(req, res) {
  var dataFile = path.join(__dirname, 'data', 'profile-photos.json');
  var photos = {};
  try { photos = JSON.parse(fs.readFileSync(dataFile, 'utf8')); } catch(e) {}
  var url = photos[req.params.am] || null;
  res.json({ success: true, url: url });
});

app.get('/api/am-profiles', function(req, res) {
  var dataFile = path.join(__dirname, 'data', 'profile-photos.json');
  var photos = {};
  try { photos = JSON.parse(fs.readFileSync(dataFile, 'utf8')); } catch(e) {}
  res.json({ success: true, data: photos });
});

app.post('/api/test-email', strictLimiter, function(req, res) {
  sendEmail(HOD_EMAIL, '[Test] OpsAIHub Email Working', '<p>Test email</p>',
    function(err) { res.json({ success: !err, error: err ? err.message : null }); }
  );
});

app.use('/api/ai-academy', require('./routes/ai-academy'));
app.use('/uploads/challenge', express.static(path.join(__dirname, 'uploads/challenge')));
app.use('/api/challenge', require('./routes/challenge'));
app.use('/api/anomalies', require('./routes/anomalies'));

// Leadership deck stats
app.get('/api/leadership-stats', function(req, res) {
  try {
    var fduSubs   = readJSON('fdu_submissions.json', []);
    var fduDonut  = readJSON('fdu_donut_submissions.json', []);
    var tasksList = readJSON('tasks.json', []);
    var storeList = readJSON('stores.json', []);
    var challenges= readJSON('challenges.json', { history: [], submissions: [] });
    var daysUp    = Math.floor((Date.now() - new Date('2026-04-01').getTime()) / 86400000);
    res.json({
      success: true,
      fduGradings:   fduSubs.length + fduDonut.length,
      storesCovered: storeList.length || 44,
      tasksManaged:  tasksList.length,
      challengeSubs: challenges.submissions.length,
      daysRunning:   daysUp,
      amCount:       10,
      regionsCount:  5
    });
  } catch(err) { res.status(500).json({ success: false }); }
});

// Leadership narrative — NVIDIA Llama, 1-hour cache
var _deckNarrative = null, _deckNarrativeAt = 0;
app.get('/api/leadership-narrative', async function(req, res) {
  if (_deckNarrative && Date.now() - _deckNarrativeAt < 3600000) {
    return res.json({ success: true, narrative: _deckNarrative });
  }
  try {
    var fduSubs  = readJSON('fdu_submissions.json', []);
    var fduDonut = readJSON('fdu_donut_submissions.json', []);
    var daysUp   = Math.floor((Date.now() - new Date('2026-04-01').getTime()) / 86400000);
    var prompt   = 'You are writing a 3-sentence executive summary for a leadership presentation. Context: OpsAIHub is India\'s first AI-powered QSR operations intelligence platform, built entirely by Jahid Inamdar — Head of Operations, Tim Hortons India — a non-technical leader with no software background — starting April 2026, now ' + daysUp + ' days live. The platform covers 44 stores across 5 regions, serves 10 area managers, has processed ' + (fduSubs.length + fduDonut.length) + ' AI-graded photos using NVIDIA Vision AI, and delivers features including daily compliance checklists, store audits, task management, donut quality grading, weekly photo challenges, CEO intelligence reports, push notifications, and a Gemini-powered chatbot. Write 3 powerful flowing sentences — confident, board-level, inspiring — about the innovation, scale, and what this means for operations. No bullet points. No markdown. Just 3 sentences.';
    var resp = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.NVIDIA_API_KEY },
      body: JSON.stringify({ model: 'meta/llama-3.2-90b-vision-instruct', messages: [{ role: 'user', content: prompt }], max_tokens: 280, temperature: 0.75 })
    });
    var data = await resp.json();
    _deckNarrative = data.choices[0].message.content.trim();
    _deckNarrativeAt = Date.now();
    res.json({ success: true, narrative: _deckNarrative });
  } catch(e) {
    res.json({ success: true, narrative: 'OpsAIHub stands as a landmark achievement in QSR operations intelligence — an enterprise-grade platform conceived, built, and deployed by a single operations leader with no software background, now serving 44 stores and 10 area managers across 5 regions of India in under 90 days. Powered by NVIDIA Vision AI and Google Gemini, it delivers real-time compliance grading, intelligent task management, and AI-authored executive reporting at a fraction of the time and cost of any outsourced alternative. This is proof that deep operational expertise, paired with the right AI technologies, can produce outcomes that redefine what field operations management looks like.' });
  }
});

// Test endpoint — sends weekly infographic to Jahid's personal email only
app.get('/api/weekly-infographic/test', async function(req, res) {
  if (req.query.secret !== (process.env.HOD_SECRET || 'opsaihub2025')) return res.status(401).json({ success: false });
  try {
    var html = await buildWeeklyInfographic();
    var subj = '☕ [TEST] Weekly Ops Infographic — ' + new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
    sendEmail('jahidrccl@yahoo.com', subj, html, function(err) {
      res.json({ success: !err, error: err ? err.message : null, sentTo: 'jahidrccl@yahoo.com' });
    });
  } catch(err) { res.status(500).json({ success: false, error: err.message }); }
});

// 404 handler for unknown API routes
app.use('/api', function(req, res) {
  res.status(404).json({ success: false, error: 'API endpoint not found: ' + req.method + ' ' + req.originalUrl });
});

// Global error handler
app.use(function(err, req, res, next) {
  console.error('[ERROR] ' + req.method + ' ' + req.path + ':', err.message);
  
  // Multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, error: 'File too large. Maximum size is 5MB.' });
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ success: false, error: 'Unexpected file field.' });
  }
  
  // JSON parse errors
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, error: 'Invalid JSON in request body.' });
  }
  
  // Default error
  res.status(err.status || 500).json({ 
    success: false, 
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message 
  });
});

app.use(express.static(path.join(__dirname, 'public')));

function cleanupOldPosts() {
  try {
    var postsPath = path.join(__dirname, 'data', 'posts.json');
    var posts = JSON.parse(fs.readFileSync(postsPath, 'utf8'));
    var cutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
    var before = posts.length;
    posts = posts.filter(function(p) {
      var ts = p.timestamp || p.createdAt || '';
      return ts > cutoff;
    });
    if (posts.length < before) {
      fs.writeFileSync(postsPath, JSON.stringify(posts, null, 2));
      console.log('[Cleanup] Removed ' + (before - posts.length) + ' posts older than 180 days');
    }
  } catch(e) {}
}
cleanupOldPosts();
setInterval(cleanupOldPosts, 6 * 60 * 60 * 1000);

function generateAutoRecognitionPost() {
  try {
    var now = new Date();
    var ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    var day = ist.getUTCDay();
    if (day !== 1 && day !== 4) return;

    var todayKey = ist.toISOString().slice(0, 10);
    var posts = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'posts.json'), 'utf8'));
    var alreadyPosted = posts.some(function(p) {
      return p.isAutoPost && (p.timestamp || '').startsWith(todayKey);
    });
    if (alreadyPosted) return;

    var stores = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'stores.json'), 'utf8'));
    var submissions = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'submissions.json'), 'utf8'));

    var weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    var twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
    var weekSubs = submissions.filter(function(s) {
      return s.submittedAt && s.submittedAt > weekAgo;
    });
    var prevWeekSubs = submissions.filter(function(s) {
      return s.submittedAt && s.submittedAt > twoWeeksAgo && s.submittedAt <= weekAgo;
    });

    var amStats = {};
    var prevAmStats = {};
    stores.forEach(function(s) {
      if (s.am && s.am !== 'TBA' && s.am !== 'Unassigned') {
        if (!amStats[s.am]) amStats[s.am] = { am: s.am, total: 0, subs: 0, scores: [] };
        amStats[s.am].total++;
        if (!prevAmStats[s.am]) prevAmStats[s.am] = { am: s.am, total: 0, subs: 0, scores: [] };
        prevAmStats[s.am].total++;
      }
    });
    weekSubs.forEach(function(s) {
      if (amStats[s.am]) {
        amStats[s.am].subs++;
        if (s.score) amStats[s.am].scores.push(s.score);
      }
    });
    prevWeekSubs.forEach(function(s) {
      if (prevAmStats[s.am]) {
        prevAmStats[s.am].subs++;
        if (s.score) prevAmStats[s.am].scores.push(s.score);
      }
    });

    function calcAvg(scores) {
      return scores.length ? Math.round(scores.reduce(function(x, y) { return x + y; }, 0) / scores.length) : 0;
    }

    var ranked = Object.values(amStats).map(function(a) {
      var avg = calcAvg(a.scores);
      var coverage = a.total > 0 ? Math.round(a.subs / a.total * 100) : 0;
      var prev = prevAmStats[a.am] || { scores: [], subs: 0, total: 0 };
      var prevAvg = calcAvg(prev.scores);
      var prevCoverage = prev.total > 0 ? Math.round(prev.subs / prev.total * 100) : 0;
      var scoreDelta = avg - prevAvg;
      var coverageDelta = coverage - prevCoverage;
      return {
        am: a.am, avgScore: avg, coverage: coverage, visits: a.subs,
        prevAvg: prevAvg, prevCoverage: prevCoverage,
        scoreDelta: scoreDelta, coverageDelta: coverageDelta
      };
    }).sort(function(a, b) { return b.avgScore - a.avgScore || b.coverage - a.coverage; });

    var top3 = ranked.slice(0, 3);
    if (!top3.length) return;

    var medals = ['🥇', '🥈', '🥉'];
    var lines = top3.map(function(r, i) {
      var scoreStr = r.prevAvg > 0
        ? r.avgScore + '% (was ' + r.prevAvg + '%, ' + (r.scoreDelta >= 0 ? '+' : '') + r.scoreDelta + '%)'
        : r.avgScore + '%';
      var covStr = r.prevCoverage > 0
        ? r.coverage + '% (was ' + r.prevCoverage + '%, ' + (r.coverageDelta >= 0 ? '+' : '') + r.coverageDelta + '%)'
        : r.coverage + '%';
      return medals[i] + ' ' + r.am + '\n   Score: ' + scoreStr + ' | Coverage: ' + covStr + ' | Visits: ' + r.visits;
    });

    var dayLabel = day === 1 ? 'Monday' : 'Thursday';
    var post = {
      id: 'auto_' + Date.now(),
      author: 'Jahid',
      category: 'recognition',
      store: '',
      taggedPerson: '',
      caption: '🏆 Weekly Top Performers — ' + dayLabel + ' Recognition\n\n' + lines.join('\n\n') + '\n\nOutstanding work from all three! Keep the momentum going 💪🔥 #TopPerformers #TimHortonsIndia',
      photo: '',
      reactions: { '&#x2764;': 0, '&#x1F44D;': 0, '&#x1F44F;': 0 },
      comments: [],
      timestamp: now.toISOString(),
      timeAgo: 'Just now',
      isAutoPost: true
    };

    posts.unshift(post);
    fs.writeFileSync(path.join(__dirname, 'data', 'posts.json'), JSON.stringify(posts, null, 2));
    console.log('[AutoPost] Top 3 recognition posted for ' + dayLabel);
  } catch(e) {
    console.error('[AutoPost] Error:', e.message);
  }
}

generateAutoRecognitionPost();
setInterval(generateAutoRecognitionPost, 60 * 60 * 1000);

// ─── Weekly Ops Infographic ──────────────────────────────────────────────────
async function callGemini(prompt) {
  var key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    var resp = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + key,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      }
    );
    var data = await resp.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch(e) {
    console.error('[Gemini] error:', e.message);
    return null;
  }
}

async function buildWeeklyInfographic() {
  // Date window: last Friday 00:00 IST → last Thursday 23:59 IST
  var now = new Date();
  var ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  var dayOfWeek = ist.getUTCDay(); // 5 = Friday
  var daysToLastFri = ((dayOfWeek + 1) % 7) + 1; // days since last Friday (if today is Fri, this = 7)
  var weekStart = new Date(ist);
  weekStart.setUTCDate(ist.getUTCDate() - daysToLastFri);
  weekStart.setUTCHours(0, 0, 0, 0);
  var weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);

  var startISO = new Date(weekStart.getTime() - 5.5 * 60 * 60 * 1000).toISOString();
  var endISO   = new Date(weekEnd.getTime() - 5.5 * 60 * 60 * 1000).toISOString();

  var weekLabel = weekStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })
    + ' – ' + weekEnd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

  // ── FDU ──
  var fduSubs    = readJSON('fdu_submissions.json', []).filter(function(f) { return f.submittedAt >= startISO && f.submittedAt <= endISO; });
  var fduLinks   = readJSON('fdu_links.json', []);
  var fduTotal   = fduSubs.length;
  var fduPass    = fduSubs.filter(function(f) { return f.overallPass; }).length;
  var fduFail    = fduTotal - fduPass;
  var fduRate    = fduTotal ? Math.round(fduPass / fduTotal * 100) : 0;
  // Per-AM FDU
  var fduByAM = {};
  fduSubs.forEach(function(f) {
    if (!fduByAM[f.am]) fduByAM[f.am] = { pass: 0, total: 0 };
    fduByAM[f.am].total++;
    if (f.overallPass) fduByAM[f.am].pass++;
  });
  var fduTopAM = Object.entries(fduByAM).sort(function(a,b) {
    return (b[1].pass/b[1].total) - (a[1].pass/a[1].total);
  })[0];
  var expectedDays = Math.ceil((weekEnd - weekStart) / 86400000);
  var missedFdu = fduLinks.filter(function(l) { return !fduByAM[l.am] || fduByAM[l.am].total < expectedDays; }).length;

  // ── Checklists ──
  var allSubs = readJSON('submissions.json', []).filter(function(s) { return s.submittedAt >= startISO && s.submittedAt <= endISO; });
  var subsByAM = {};
  allSubs.forEach(function(s) {
    if (!subsByAM[s.am]) subsByAM[s.am] = { count: 0, scoreSum: 0 };
    subsByAM[s.am].count++;
    subsByAM[s.am].scoreSum += (s.score || 0);
  });
  var totalSubs = allSubs.length;
  var avgScore  = totalSubs ? Math.round(allSubs.reduce(function(a,s) { return a + (s.score||0); }, 0) / totalSubs) : 0;
  var topSubAM  = Object.entries(subsByAM).sort(function(a,b) { return b[1].count - a[1].count; })[0];

  // ── Maintenance ──
  var maint = readJSON('maintenance_tickets.json', []);
  var newTickets  = maint.filter(function(t) { return t.submittedAt >= startISO && t.submittedAt <= endISO; });
  var resolvedWk  = maint.filter(function(t) { return t.resolvedAt >= startISO && t.resolvedAt <= endISO; });
  var openTotal   = maint.filter(function(t) { return t.status === 'open'; }).length;
  var p1Open      = maint.filter(function(t) { return t.status === 'open' && t.priority === 'p1'; }).length;
  var urgentOpen  = maint.filter(function(t) { return t.status === 'open' && t.priority === 'urgent'; }).length;

  // ── Recognition ──
  var recLog = readJSON('auto_recognition_log.json', {});
  var weekKeys = Object.keys(recLog).sort();
  var latestRecKey = weekKeys[weekKeys.length - 1];
  var rec = recLog[latestRecKey] || null;

  // ── Gemini narrative ──
  var statsPrompt = 'You are a QSR operations analyst for Tim Hortons India. Write a 3-sentence executive summary for a weekly ops email. Be positive but honest. Stats: FDU compliance ' + fduRate + '% (' + fduPass + ' pass, ' + fduFail + ' fail), checklist submissions ' + totalSubs + ' (avg score ' + avgScore + '%), maintenance ' + newTickets.length + ' new tickets / ' + resolvedWk.length + ' resolved / ' + p1Open + ' P1 open, recognition winner: ' + (rec ? rec.am + ' (' + rec.pct + '% compliance)' : 'none') + '. Do not use markdown. 3 sentences only.';
  var narrative = await callGemini(statsPrompt);
  if (!narrative) narrative = 'This week\'s ops data is ready for your review. Check each section below for store-level details and action items.';

  // ── Build HTML ──
  var fduColor  = fduRate >= 90 ? '#1B7A3A' : fduRate >= 75 ? '#B36200' : '#C8102E';
  var scoreColor = avgScore >= 80 ? '#1B7A3A' : avgScore >= 60 ? '#B36200' : '#C8102E';

  function statBox(label, value, sub, color) {
    return '<td style="width:50%;padding:8px;">'
      + '<div style="background:#F5F5F7;border-radius:10px;padding:16px;text-align:center;">'
      + '<div style="font-size:11px;font-weight:700;color:#8E8E93;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">' + label + '</div>'
      + '<div style="font-size:32px;font-weight:800;color:' + (color||'#1C1C1E') + ';">' + value + '</div>'
      + '<div style="font-size:11px;color:#8E8E93;margin-top:4px;">' + sub + '</div>'
      + '</div></td>';
  }

  function sectionHeader(icon, title, color) {
    return '<div style="background:' + (color||'#C8102E') + ';border-radius:8px 8px 0 0;padding:10px 16px;margin-top:20px;">'
      + '<span style="font-size:14px;font-weight:700;color:#fff;">' + icon + '&nbsp; ' + title + '</span></div>'
      + '<div style="background:#fff;border:1px solid #E5E5EA;border-top:none;border-radius:0 0 8px 8px;padding:14px 16px;">';
  }

  function amTableRow(am, cols) {
    return '<tr style="border-bottom:1px solid #F2F2F7;">'
      + '<td style="padding:7px 8px;font-size:12px;font-weight:600;color:#1C1C1E;">' + am + '</td>'
      + cols.map(function(c) { return '<td style="padding:7px 8px;font-size:12px;text-align:center;color:' + (c.color||'#1C1C1E') + ';">' + c.v + '</td>'; }).join('')
      + '</tr>';
  }

  var amNames = [...new Set([
    ...Object.keys(fduByAM),
    ...Object.keys(subsByAM)
  ])].filter(function(a) { return a && a !== 'Unassigned'; }).sort();

  var amRows = amNames.map(function(am) {
    var fAM = fduByAM[am] || { pass: 0, total: 0 };
    var sAM = subsByAM[am] || { count: 0, scoreSum: 0 };
    var fRate = fAM.total ? Math.round(fAM.pass / fAM.total * 100) : '—';
    var sAvg  = sAM.count ? Math.round(sAM.scoreSum / sAM.count) : '—';
    var fColor = fAM.total ? (fRate >= 90 ? '#1B7A3A' : fRate >= 75 ? '#B36200' : '#C8102E') : '#8E8E93';
    var sColor = sAM.count ? (sAvg >= 80 ? '#1B7A3A' : sAvg >= 60 ? '#B36200' : '#C8102E') : '#8E8E93';
    return amTableRow(am, [
      { v: fAM.total ? fRate + '%' : '—', color: fColor },
      { v: String(fAM.total || '—') },
      { v: sAM.count ? sAvg + '%' : '—', color: sColor },
      { v: String(sAM.count || '—') }
    ]);
  }).join('');

  var body = ''
    // Narrative
    + '<div style="background:linear-gradient(135deg,#C8102E,#8B0B1F);border-radius:10px;padding:20px;margin-bottom:20px;">'
    + '<div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">AI Weekly Insight</div>'
    + '<div style="font-size:14px;color:#fff;line-height:1.6;">' + narrative + '</div>'
    + '</div>'

    // KPI boxes
    + '<table width="100%" cellpadding="0" cellspacing="0"><tr>'
    + statBox('FDU Compliance', fduRate + '%', fduPass + ' pass · ' + fduFail + ' fail', fduColor)
    + statBox('Checklist Avg', avgScore + '%', totalSubs + ' submissions', scoreColor)
    + '</tr><tr>'
    + statBox('Maintenance Open', String(openTotal), p1Open + ' P1 · ' + urgentOpen + ' urgent', p1Open > 0 ? '#C8102E' : '#B36200')
    + statBox('New Tickets', String(newTickets.length), resolvedWk.length + ' resolved this week', newTickets.length > resolvedWk.length ? '#B36200' : '#1B7A3A')
    + '</tr></table>'

    // FDU section
    + sectionHeader('📋', 'FDU Display Compliance', '#C8102E')
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
    + '<span style="background:#E8F5E9;color:#1B7A3A;font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px;">✅ Pass ' + fduPass + '</span>'
    + '<span style="background:#FFEBEE;color:#C8102E;font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px;">❌ Fail ' + fduFail + '</span>'
    + '<span style="background:#FFF3E0;color:#B36200;font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px;">⚠️ Missed ' + missedFdu + ' AM-days</span>'
    + '</div>'
    + (fduTopAM ? '<div style="margin-top:10px;font-size:12px;color:#1C1C1E;">Top AM: <b>' + fduTopAM[0] + '</b> — ' + Math.round(fduTopAM[1].pass / fduTopAM[1].total * 100) + '% (' + fduTopAM[1].pass + '/' + fduTopAM[1].total + ' sessions)</div>' : '')
    + '</div>'

    // Checklist section
    + sectionHeader('✅', 'AM Checklist Submissions', '#1B7A3A')
    + '<div style="font-size:12px;color:#3A3A3C;margin-bottom:10px;">' + totalSubs + ' submissions · avg score <b>' + avgScore + '%</b>'
    + (topSubAM ? ' · most active: <b>' + topSubAM[0] + '</b> (' + topSubAM[1].count + ' subs)' : '') + '</div>'
    + '</div>'

    // Maintenance section
    + sectionHeader('🔧', 'Maintenance', '#B36200')
    + '<div style="font-size:12px;color:#3A3A3C;">'
    + newTickets.length + ' new ticket' + (newTickets.length !== 1 ? 's' : '') + ' raised · '
    + resolvedWk.length + ' resolved · '
    + openTotal + ' total open'
    + (p1Open > 0 ? '<br><span style="color:#C8102E;font-weight:700;">⚡ ' + p1Open + ' P1 ticket' + (p1Open > 1 ? 's' : '') + ' require immediate action</span>' : '')
    + '</div>'
    + '</div>'

    // Recognition section
    + sectionHeader('⭐', 'Recognition Spotlight', '#FF9500')
    + (rec
      ? '<div style="text-align:center;padding:8px 0;">'
        + '<div style="font-size:28px;">🏆</div>'
        + '<div style="font-size:18px;font-weight:800;color:#1C1C1E;margin-top:6px;">' + rec.am + '</div>'
        + '<div style="font-size:12px;color:#8E8E93;margin-top:4px;">AM of the Week · ' + rec.pct + '% compliance</div>'
        + (rec.product ? '<div style="font-size:11px;color:#C8102E;font-weight:600;margin-top:6px;">Featured Product: ' + rec.product + '</div>' : '')
        + '</div>'
      : '<div style="font-size:12px;color:#8E8E93;text-align:center;">No recognition posted this week</div>')
    + '</div>'

    // AM Performance Table
    + '<div style="margin-top:20px;">'
    + '<div style="font-size:11px;font-weight:700;color:#8E8E93;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">AM Performance Breakdown</div>'
    + '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">'
    + '<tr style="background:#F5F5F7;">'
    + '<th style="padding:8px;font-size:11px;text-align:left;color:#8E8E93;font-weight:700;">AM</th>'
    + '<th style="padding:8px;font-size:11px;text-align:center;color:#8E8E93;font-weight:700;">FDU%</th>'
    + '<th style="padding:8px;font-size:11px;text-align:center;color:#8E8E93;font-weight:700;">FDU Sess.</th>'
    + '<th style="padding:8px;font-size:11px;text-align:center;color:#8E8E93;font-weight:700;">Score%</th>'
    + '<th style="padding:8px;font-size:11px;text-align:center;color:#8E8E93;font-weight:700;">Subs</th>'
    + '</tr>'
    + amRows
    + '</table></div>'

    // CTA
    + '<a href="https://opsaihub.in" style="display:block;background:#C8102E;color:#fff;text-decoration:none;text-align:center;padding:14px 24px;border-radius:8px;font-weight:700;font-size:14px;margin-top:24px;">Open OpsAIHub →</a>';

  return eWrap(body,
    '☕ Weekly Ops Infographic',
    'Tim Hortons India · Week of ' + weekLabel
  );
}

// Friday 9:00 AM IST — weekly infographic
cron.schedule('0 9 * * 5', async function() {
  try {
    var html = await buildWeeklyInfographic();
    var subj = '☕ Weekly Ops Infographic — ' + new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
    var recipients = Object.values(AM_EMAILS).filter(Boolean);
    recipients.push(HOD_EMAIL, CEO_EMAIL);
    var unique = [...new Set(recipients)];
    unique.forEach(function(e) { sendEmail(e, subj, html); });
    console.log('[CRON] Weekly infographic sent to ' + unique.length + ' recipients');
  } catch(err) { console.error('[CRON] Weekly infographic error:', err.message); }
}, { timezone: 'Asia/Kolkata' });

app.listen(PORT, function() { console.log('OpsAIHub running on port ' + PORT); });
module.exports = { readJSON: readJSON, writeJSON: writeJSON };
