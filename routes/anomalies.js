'use strict';
const express = require('express');
const router = express.Router();
const { readJSON, writeJSON } = require('../services/store');
const { authMiddleware } = require('../middleware/auth');

function getStores() {
  return readJSON('stores.json', []);
}

function getAMForStore(storeName, storeList) {
  var s = storeList.find(function(x) { return (x.name || x.store || '').toLowerCase() === (storeName || '').toLowerCase(); });
  return s ? (s.am || 'Unassigned') : 'Unassigned';
}

function getRegionForStore(storeName, storeList) {
  var s = storeList.find(function(x) { return (x.name || x.store || '').toLowerCase() === (storeName || '').toLowerCase(); });
  return s ? (s.region || 'Unknown') : 'Unknown';
}

function detectAnomalies() {
  var now = new Date();
  var today = now.toISOString().slice(0, 10);
  var weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
  var twoWeeksAgo = new Date(now.getTime() - 14 * 86400000).toISOString();
  var storeList = getStores();
  var anomalies = [];
  var seen = {};

  function addAnomaly(type, severity, store, title, detail) {
    var id = type + '_' + store.replace(/\s+/g, '-') + '_' + today;
    if (seen[id]) return;
    seen[id] = true;
    anomalies.push({
      id: id,
      type: type,
      severity: severity,
      store: store,
      am: getAMForStore(store, storeList),
      region: getRegionForStore(store, storeList),
      title: title,
      detail: detail,
      detectedAt: now.toISOString(),
      resolved: false
    });
  }

  // 1. Score drops — stores where latest score is 20+ pts below their 7d avg
  var submissions = readJSON('submissions.json', []);
  var storeScores = {};
  submissions.forEach(function(s) {
    if (!s.store || !s.submittedAt) return;
    if (!storeScores[s.store]) storeScores[s.store] = [];
    if (typeof s.score === 'number') {
      storeScores[s.store].push({ score: s.score, date: s.submittedAt });
    }
  });
  Object.keys(storeScores).forEach(function(store) {
    var entries = storeScores[store].sort(function(a, b) { return a.date > b.date ? -1 : 1; });
    if (entries.length < 3) return;
    var latest = entries[0].score;
    var recent = entries.slice(0, 5);
    var avg = recent.reduce(function(s, e) { return s + e.score; }, 0) / recent.length;
    var historical = entries.slice(5);
    if (historical.length > 0) {
      var histAvg = historical.slice(0, 10).reduce(function(s, e) { return s + e.score; }, 0) / Math.min(historical.length, 10);
      if (histAvg - latest >= 20) {
        addAnomaly('score_drop', 'critical', store,
          store + ' — score dropped ' + Math.round(histAvg - latest) + ' pts',
          'Prev avg: ' + Math.round(histAvg) + ' → Latest: ' + Math.round(latest));
      }
    }
  });

  // 2. No submission in 7+ days
  var allStores = storeList.map(function(s) { return s.name || s.store; }).filter(Boolean);
  var lastSubmission = {};
  submissions.forEach(function(s) {
    if (!s.store) return;
    if (!lastSubmission[s.store] || s.submittedAt > lastSubmission[s.store]) {
      lastSubmission[s.store] = s.submittedAt;
    }
  });
  allStores.forEach(function(store) {
    var last = lastSubmission[store];
    if (!last || last < weekAgo) {
      var detail = last ? 'Last seen: ' + last.slice(0, 10) : 'Last seen: never';
      addAnomaly('no_submission', 'warning', store,
        store + ' — no checklist in 7+ days', detail);
    }
  });

  // 3. Visit gaps — no AM visit in 14+ days
  var visits = readJSON('am_visits.json', []);
  var lastVisit = {};
  visits.forEach(function(v) {
    if (!v.store) return;
    var ts = v.timestamp || v.date;
    if (!lastVisit[v.store] || ts > lastVisit[v.store]) {
      lastVisit[v.store] = ts;
    }
  });
  allStores.forEach(function(store) {
    var last = lastVisit[store];
    if (!last || last < twoWeeksAgo) {
      addAnomaly('visit_gap', 'warning', store,
        store + ' — no AM visit in 14+ days', 'Needs an in-store visit this week');
    }
  });

  // 4. FDU streak — stores with no FDU upload today
  var fduSubs = readJSON('fdu_submissions.json', []);
  var fduToday = {};
  fduSubs.forEach(function(f) {
    if (f.submittedAt && f.submittedAt.slice(0, 10) === today) {
      fduToday[f.store] = true;
    }
  });
  allStores.forEach(function(store) {
    if (!fduToday[store]) {
      addAnomaly('fdu_streak', 'warning', store,
        store + ' — FDU not uploaded today', 'FDU display photo missing today');
    }
  });

  // 5. Machine breakdowns from maintenance tickets
  var tickets = readJSON('maintenance_tickets.json', []);
  tickets.forEach(function(t) {
    if (t.status !== 'open') return;
    if (t.priority === 'p1' || t.priority === 'urgent') {
      addAnomaly('machine_broken', t.priority === 'p1' ? 'critical' : 'warning',
        t.store, t.store + ' — ' + t.category + ' issue',
        t.description ? t.description.substring(0, 100) : 'Open ticket: ' + t.id);
    }
  });

  return anomalies;
}

// GET /api/anomalies — list anomalies (auto-detects then merges with resolved)
router.get('/', authMiddleware, function(req, res) {
  try {
    var detected = detectAnomalies();
    var saved = readJSON('anomalies.json', []);

    // Merge: keep resolved items from saved, replace unresolved with fresh detection
    var savedResolved = saved.filter(function(a) { return a.resolved; });
    var merged = savedResolved.concat(detected);

    // Deduplicate by id
    var seen = {};
    var deduped = [];
    merged.forEach(function(a) {
      if (!seen[a.id]) {
        seen[a.id] = true;
        deduped.push(a);
      }
    });

    // Sort by severity then date
    deduped.sort(function(a, b) {
      var sevOrder = { critical: 0, warning: 1 };
      var sDiff = (sevOrder[a.severity] || 2) - (sevOrder[b.severity] || 2);
      if (sDiff !== 0) return sDiff;
      return (a.detectedAt || '') > (b.detectedAt || '') ? -1 : 1;
    });

    var role = req.user.role;
    var am = req.user.am;
    if (role === 'am') {
      deduped = deduped.filter(function(a) { return a.am === am; });
    }

    res.json({ success: true, data: deduped });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/anomalies/:id/resolve — mark anomaly as resolved
router.post('/:id/resolve', authMiddleware, function(req, res) {
  try {
    var saved = readJSON('anomalies.json', []);
    var a = saved.find(function(x) { return x.id === req.params.id; });
    if (a) {
      a.resolved = true;
      a.resolvedAt = new Date().toISOString();
      writeJSON('anomalies.json', saved);
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/anomalies/refresh — force re-detect and save
router.post('/refresh', authMiddleware, function(req, res) {
  try {
    var detected = detectAnomalies();
    var saved = readJSON('anomalies.json', []);
    var savedResolved = saved.filter(function(a) { return a.resolved; });
    var merged = savedResolved.concat(detected);
    var seen = {};
    var deduped = [];
    merged.forEach(function(a) {
      if (!seen[a.id]) { seen[a.id] = true; deduped.push(a); }
    });
    writeJSON('anomalies.json', deduped);
    res.json({ success: true, count: deduped.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
