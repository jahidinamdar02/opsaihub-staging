'use strict';
const express = require('express');
const router = express.Router();
const { readJSON } = require('../services/store');

router.get('/', function(req, res) {
  try { res.json({ success: true, data: readJSON('stores.json', []) }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.get('/am/:amName', function(req, res) {
  try {
    const stores = readJSON('stores.json', []);
    res.json({ success: true, data: stores.filter(function(s) { return s.am.toLowerCase() === req.params.amName.toLowerCase(); }) });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.get('/trend', function(req, res) {
  try {
    var filterAm = req.query.am || '';
    var stores = readJSON('stores.json', []);
    var subs = readJSON('submissions.json', []);
    var now = new Date();
    var weeks = [3, 2, 1, 0].map(function(w) {
      var end = new Date(now.getTime() - w * 7 * 24 * 60 * 60 * 1000);
      var start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { start: start.toISOString(), end: end.toISOString() };
    });
    var buckets = {};
    stores.forEach(function(s) { buckets[s.name] = [[], [], [], []]; });
    subs.forEach(function(s) {
      if (!s.store || s.score === undefined || s.score === null) return;
      var t = s.submittedAt || s.date || '';
      weeks.forEach(function(w, idx) {
        if (t >= w.start && t < w.end) {
          if (buckets[s.store]) buckets[s.store][idx].push(s.score);
        }
      });
    });
    var result = stores
      .filter(function(s) { return !filterAm || s.am === filterAm; })
      .map(function(s) {
        var wkScores = buckets[s.name].map(function(wk) {
          return wk.length ? Math.round(wk.reduce(function(a, b) { return a + b; }, 0) / wk.length) : null;
        });
        var nonNull = wkScores.filter(function(v) { return v !== null; });
        var trend = 'new';
        if (nonNull.length >= 2) {
          var diff = nonNull[nonNull.length - 1] - nonNull[nonNull.length - 2];
          trend = diff >= 5 ? 'up' : diff <= -5 ? 'down' : 'flat';
        }
        var current = nonNull.length ? nonNull[nonNull.length - 1] : null;
        return { store: s.name, am: s.am || '', region: s.region || '', type: s.type || '', scores: wkScores, current: current, trend: trend };
      });
    res.json({ success: true, data: result });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
